import { cookies, headers } from "next/headers";

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

const DJANGO_URL = (process.env.DJANGO_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

const ACCESS_COOKIE = "lc_access";
const REFRESH_COOKIE = "lc_refresh";

const KNOWN_SLUGS = new Set(["lecarre", "bahiafc"]);

/** Resolve tenant slug from Host (lecarre.kovo-app.net) or env default. */
export function slugFromHost(host: string | null | undefined): string {
  const raw = (host ?? "").split(":")[0].trim().toLowerCase();
  const first = raw.split(".")[0];
  if (KNOWN_SLUGS.has(first)) return first;
  return (process.env.DEFAULT_RESTAURANT_SLUG ?? "lecarre").trim().toLowerCase() || "lecarre";
}

export async function currentRestaurantSlug(): Promise<string> {
  const h = await headers();
  return slugFromHost(h.get("host"));
}

export async function setAuthCookies(access: string, refresh: string) {
  const store = await cookies();
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

async function tenantHeaders(): Promise<Record<string, string>> {
  const slug = await currentRestaurantSlug();
  return { "X-Restaurant-Slug": slug };
}

async function rawFetch<T>(path: string, init: RequestInit, token?: string): Promise<DjangoResult<T>> {
  const restaurantHeaders = await tenantHeaders();
  const requestInit: RequestInit = {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...restaurantHeaders,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    cache: "no-store",
  };

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

async function tryRefresh(): Promise<string | undefined> {
  const refresh = (await cookies()).get(REFRESH_COOKIE)?.value;
  if (!refresh) return undefined;

  const result = await rawFetch<{ access?: string }>(
    "/api/accounts/token/refresh/",
    { method: "POST", body: JSON.stringify({ refresh }) },
  );

  if (result.ok && result.data?.access) {
    const store = await cookies();
    store.set(ACCESS_COOKIE, result.data.access, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    return result.data.access;
  }

  return undefined;
}

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

export function djangoPublicFetch<T = unknown>(path: string, init: RequestInit = {}) {
  return rawFetch<T>(path, init);
}

export { DJANGO_URL };
