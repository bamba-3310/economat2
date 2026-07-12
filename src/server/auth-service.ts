/**
 * Authentication against Django (JWT).
 *
 * WHY: this used to verify credentials against the local SQLite credentials
 * table. It now logs in through Django and stores the returned JWT in httpOnly
 * cookies (see django.ts), which every other adapter route forwards.
 * WHEN: rewritten during the Django/PostgreSQL wiring.
 */
import { djangoPublicFetch, djangoFetch, setAuthCookies, clearAuthCookies } from "@/server/django";
import { mapUser } from "@/server/mappers";

function accessMessageForStatus(status?: string) {
  if (status === "pending") return "Compte en attente d’approbation admin.";
  if (status === "rejected") return "Compte refusé.";
  if (status === "disabled") return "Compte désactivé.";
  return "Compte inactif ou introuvable.";
}

export async function verifyLocalLogin({
  email,
  password,
}: {
  email: string;
  password: string;
}) {
  const result = await djangoPublicFetch<{
    access?: string;
    refresh?: string;
    user?: Parameters<typeof mapUser>[0];
    detail?: string;
    status?: string;
  }>("/api/accounts/login/", {
    method: "POST",
    body: JSON.stringify({ email: email.trim(), password }),
  });

  if (result.ok && result.data?.access && result.data.refresh && result.data.user) {
    await setAuthCookies(result.data.access, result.data.refresh);
    return {
      ok: true,
      message: "Connexion validée.",
      user: mapUser(result.data.user),
    };
  }

  if (result.status === 409) {
    // Single-session: another device already holds an active session.
    return { ok: false, message: "Compte déjà connecté sur un autre appareil." };
  }

  if (result.status === 403) {
    return { ok: false, message: accessMessageForStatus(result.data?.status) };
  }

  return { ok: false, message: "Identifiants incorrects." };
}

// Clears the server-side session (frees the single-session lock) and the
// JWT cookies. Best-effort: cookies are cleared even if Django is unreachable.
export async function logoutSession() {
  try {
    await djangoFetch("/api/accounts/logout/", { method: "POST" });
  } finally {
    await clearAuthCookies();
  }
  return { ok: true };
}

export async function changeLocalPassword({
  currentPassword,
  newPassword,
}: {
  currentPassword: string;
  newPassword: string;
  userId: string;
}) {
  const result = await djangoFetch<{ detail?: string; access?: string; refresh?: string }>(
    "/api/accounts/change-password/",
    {
      method: "POST",
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    },
  );

  if (result.ok) {
    // WHEN/WHY: Django rotates the session (`sid`) on password change so tokens
    // minted before the change stop working. It returns a fresh pair for THIS
    // session — store it, otherwise the very next request would 401.
    if (result.data?.access && result.data.refresh) {
      await setAuthCookies(result.data.access, result.data.refresh);
    }
    return { ok: true, message: "Mot de passe mis à jour." };
  }

  const detail = result.data?.detail ?? "";
  if (detail.toLowerCase().includes("too short")) {
    return { ok: false, message: "Mot de passe trop court." };
  }
  if (result.status === 401) {
    return { ok: false, message: "Session utilisateur requise." };
  }
  if (detail.toLowerCase().includes("current password")) {
    return { ok: false, message: "Mot de passe actuel incorrect." };
  }
  // Password-policy rejections (too common, numeric only, similar to the
  // user's own attributes, ...) — surface Django's reason rather than
  // mislabelling it as a wrong current password.
  return { ok: false, message: detail || "Mot de passe actuel incorrect." };
}
