import { cookies } from "next/headers";

/**
 * Server-side client for the Django REST API (the single source of truth,
 * backed by PostgreSQL).
 *
 * WHY: the Next.js /api/* routes used to read/write a local SQLite file
 * (a collaborator's throwaway test DB). They now act as a thin adapter in front
 * of Django: they forward the logged-in user's JWT (kept in httpOnly cookies)
 * and translate between Django's shape (int ids, snake_case, English enums) and
 * the frontend domain shape. WHEN: added when wiring the app to Django/Postgres.
 */

// WHEN/WHY: use 127.0.0.1 (IPv4) rather than "localhost". Node resolves
// "localhost" to IPv6 ::1 first, but Django's runserver listens on IPv4 only,
// so server-side fetches to localhost intermittently failed with ECONNREFUSED
// (random 500s on /api/stock, /api/suppliers, ...). Forcing IPv4 fixes it.
const DJANGO_URL = (process.env.DJANGO_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

const ACCESS_COOKIE = "lc_access";
const REFRESH_COOKIE = "lc_refresh";

// WHEN/WHY: the auth cookies are intentionally *session-scoped* (no maxAge /
// expires). The browser drops them when it is fully closed, so closing the
// window / quitting the app logs the user out on the next open — while a plain
// page reload (browser still running) keeps them, so refreshing does NOT log
// you out. The JWTs still carry their own server-side lifetimes (8h / 7d in
// SIMPLE_JWT); the cookie scope only controls how long the *browser* holds them.
export async function setAuthCookies(access: string, refresh: string) {
  const store = await cookies();
  // No maxAge -> session cookie.
  const base = { httpOnly: true, sameSite: "lax" as const, path: "/" };
  store.set(ACCESS_COOKIE, access, base);
  store.set(REFRESH_COOKIE, refresh, base);
}

export async function clearAuthCookies() {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

export async function getAccessToken() {
  return (await cookies()).get(ACCESS_COOKIE)?.value;
}

export type DjangoResult<T> = {
  ok: boolean;
  status: number;
  data: T;
};

async function rawFetch<T>(path: string, init: RequestInit, token?: string): Promise<DjangoResult<T>> {
  const requestInit: RequestInit = {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    cache: "no-store",
  };

  // WHEN/WHY: readDatabase() fans out ~8 parallel calls; Django's dev server can
  // reset some connections under that burst (ECONNRESET). Retry transient
  // network failures once, and NEVER throw — return ok:false so the caller (e.g.
  // Promise.all in readDatabase) degrades gracefully instead of 500-ing.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(`${DJANGO_URL}${path}`, requestInit);
      const data = (await response.json().catch(() => null)) as T;
      return { ok: response.ok, status: response.status, data };
    } catch {
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 120));
        continue;
      }
    }
  }
  return { ok: false, status: 0, data: null as T };
}

/** Try to mint a fresh access token from the refresh cookie. Returns it or undefined. */
async function tryRefresh(): Promise<string | undefined> {
  const refresh = (await cookies()).get(REFRESH_COOKIE)?.value;
  if (!refresh) return undefined;

  const result = await rawFetch<{ access?: string }>(
    "/api/accounts/token/refresh/",
    { method: "POST", body: JSON.stringify({ refresh }) },
  );

  if (result.ok && result.data?.access) {
    const store = await cookies();
    // Session-scoped, matching setAuthCookies (see note there).
    store.set(ACCESS_COOKIE, result.data.access, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    return result.data.access;
  }

  return undefined;
}

/**
 * Authenticated call to Django using the user's cookie token, with one
 * automatic refresh-and-retry on a 401.
 */
export async function djangoFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<DjangoResult<T>> {
  const token = await getAccessToken();
  let result = await rawFetch<T>(path, init, token);

  if (result.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      result = await rawFetch<T>(path, init, refreshed);
    }
  }

  return result;
}

/** Unauthenticated call (login / register / token refresh). */
export function djangoPublicFetch<T = unknown>(path: string, init: RequestInit = {}) {
  return rawFetch<T>(path, init);
}

export { DJANGO_URL };
