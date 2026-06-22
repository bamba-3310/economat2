import { type NextRequest, NextResponse } from "next/server";
import { readDatabase } from "@/server/local-database";
import {
  getActiveActor,
  requirePermission,
  userHasPermission,
} from "@/server/permissions";
import {
  createUserAccount,
  deleteUser,
  requestAccount,
  updateUserProfile,
  updateUserStatus,
} from "@/server/stock-service";
import type { Permission, Role } from "@/types/domain";

export const runtime = "nodejs";

const roles: Role[] = ["Admin", "Gestionnaire", "Agent"];
const permissions: Permission[] = [
  "manage_users",
  "approve_accounts",
  "edit_stock",
  "edit_lots",
  "edit_thresholds",
  "edit_expiration_dates",
  "validate_deliveries",
  "activate_lot",
  "view_all_alerts",
  "manage_categories",
];

export async function GET() {
  const database = await readDatabase();
  return NextResponse.json({
    users: database.users,
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    action?: "approve" | "refuse" | "disable" | "reactivate";
    actorId?: string;
    email?: string;
    name?: string;
    password?: string;
    role?: Role;
    userId?: string;
  };

  if (body.action || body.userId) {
    if (!body.userId || !body.action) {
      return NextResponse.json(
        { error: "userId et action sont requis." },
        { status: 400 },
      );
    }

    const access = await requirePermission(body.actorId, [
      "manage_users",
      "approve_accounts",
    ]);

    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const result = await updateUserStatus({
      action: body.action,
      userId: body.userId,
    });

    if (!result.user) {
      return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
    }

    return NextResponse.json(result);
  }

  if (!body.name?.trim() || !body.email?.trim() || !body.password || !body.role) {
    return NextResponse.json(
      { error: "name, email, password et role sont requis." },
      { status: 400 },
    );
  }

  if (!roles.includes(body.role)) {
    return NextResponse.json({ error: "Rôle invalide." }, { status: 400 });
  }

  // Align with Django's CreateUserSerializer (min_length=8); a shorter password
  // would otherwise be rejected by Django and mislabelled as a duplicate. #3/#8.
  if (body.password.length < 8) {
    return NextResponse.json(
      { error: "Mot de passe trop court (8 caractères minimum)." },
      { status: 400 },
    );
  }

  // Two creation paths share this endpoint. An authenticated admin
  // (manage_users) creates an ACTIVE account with the chosen role through the
  // admin endpoint. Everyone else — including the unauthenticated login-screen
  // "Demande" flow — self-registers a PENDING account an admin later approves.
  // This keeps RegisterView strictly for self-registration and stops the admin
  // path from silently downgrading the role / forcing PENDING. #3.
  const actor = await getActiveActor(body.actorId);
  const isAdminCreate = actor.ok && userHasPermission(actor.user, ["manage_users"]);

  const result = isAdminCreate
    ? await createUserAccount({
        email: body.email,
        name: body.name,
        password: body.password,
        role: body.role,
      })
    : await requestAccount({
        email: body.email,
        name: body.name,
        password: body.password,
        role: body.role,
      });

  if (result.duplicate) {
    return NextResponse.json(
      { error: "Un compte existe déjà avec cet email." },
      { status: 409 },
    );
  }

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as {
    actorId?: string;
    email?: string;
    name?: string;
    permissions?: Permission[];
    photoUrl?: string | null;
    role?: Role;
    userId?: string;
  };

  if (!body.userId) {
    return NextResponse.json({ error: "userId est requis." }, { status: 400 });
  }

  const actor = await getActiveActor(body.actorId);

  if (!actor.ok) {
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  }

  const isSelfEdit = actor.user.id === body.userId;
  const hasSensitivePatch = Boolean(body.role || body.permissions);
  const canManageUsers = userHasPermission(actor.user, ["manage_users"]);

  if ((!isSelfEdit || hasSensitivePatch) && !canManageUsers) {
    return NextResponse.json({ error: "Action non autorisee." }, { status: 403 });
  }

  // A user editing only their own non-sensitive fields goes through the
  // self-service Django endpoint (IsAuthenticated). Admin edits of other users —
  // or any role/permission change — stay on the admin-only endpoint. #1.
  const routeToSelf = isSelfEdit && !hasSensitivePatch;

  const patch: Parameters<typeof updateUserProfile>[0]["patch"] = {};

  if (typeof body.name === "string" && body.name.trim()) {
    patch.name = body.name.trim();
  }

  if (typeof body.email === "string" && body.email.trim()) {
    patch.email = body.email.trim();
  }

  if (body.role && roles.includes(body.role)) {
    patch.role = body.role;
  }

  if (Array.isArray(body.permissions)) {
    patch.permissions = body.permissions.filter((permission) =>
      permissions.includes(permission),
    );
  }

  if (typeof body.photoUrl === "string" || body.photoUrl === null) {
    patch.photoUrl = body.photoUrl;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "Aucune modification valide reçue." },
      { status: 400 },
    );
  }

  const result = await updateUserProfile({
    patch,
    self: routeToSelf,
    userId: body.userId,
  });

  if (!result.user) {
    return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
  }

  return NextResponse.json(result);
}

// WHEN/WHY: admin-only account deletion (frontend Users panel). Django also
// enforces admin + blocks self-deletion; we guard self-deletion here too for a
// clear message.
export async function DELETE(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    actorId?: string;
    userId?: string;
  };

  if (!body.userId) {
    return NextResponse.json({ error: "userId est requis." }, { status: 400 });
  }

  const access = await requirePermission(body.actorId, ["manage_users"]);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  if (access.user.id === body.userId) {
    return NextResponse.json(
      { error: "Vous ne pouvez pas supprimer votre propre compte." },
      { status: 400 },
    );
  }

  const result = await deleteUser({ userId: body.userId });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.message ?? "Suppression impossible." },
      { status: 400 },
    );
  }

  return NextResponse.json(result);
}
