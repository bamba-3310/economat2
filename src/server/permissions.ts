/**
 * Permission checks for the adapter routes.
 *
 * WHY: previously the "actor" was looked up by id in the local SQLite users
 * table. The actor is now the logged-in user identified by the JWT cookie, so
 * we resolve them via Django's /api/accounts/me/ (the `actorId` the frontend
 * still sends is ignored — the cookie is the source of truth). Granular rights
 * come from the mapped user's `permissions`; Django also enforces role-based
 * access server-side as a backstop. WHEN: rewritten during the Django wiring.
 */
import type { AppUser, Permission } from "@/types/domain";
import { djangoFetch } from "@/server/django";
import { mapUser } from "@/server/mappers";

type PermissionResult =
  | { ok: true; user: AppUser }
  | { error: string; ok: false; status: 401 | 403 };

function can(user: AppUser, permissions: Permission[]) {
  return (
    user.role === "Admin" ||
    permissions.some((permission) => user.permissions.includes(permission))
  );
}

export async function getActiveActor(_actorId?: string): Promise<PermissionResult> {
  const me = await djangoFetch<Parameters<typeof mapUser>[0]>("/api/accounts/me/");

  if (!me.ok || !me.data) {
    return { error: "Session utilisateur requise.", ok: false, status: 401 };
  }

  const user = mapUser(me.data);

  if (user.status !== "Actif") {
    return { error: "Compte inactif ou introuvable.", ok: false, status: 403 };
  }

  return { ok: true, user };
}

export async function requirePermission(
  actorId: string | undefined,
  permissions: Permission[],
): Promise<PermissionResult> {
  const actor = await getActiveActor(actorId);

  if (!actor.ok) return actor;

  if (!can(actor.user, permissions)) {
    return { error: "Action non autorisee.", ok: false, status: 403 };
  }

  return actor;
}

export function userHasPermission(user: AppUser, permissions: Permission[]) {
  return can(user, permissions);
}
