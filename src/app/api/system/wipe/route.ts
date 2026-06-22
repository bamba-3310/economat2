import { NextResponse } from "next/server";
import { djangoFetch } from "@/server/django";
import { getActiveActor } from "@/server/permissions";

export const runtime = "nodejs";

// Admin-only "start fresh": deletes all operational data and non-admin users
// (Django keeps admin accounts + branding). See apps/system WipeDatabaseView.
export async function POST() {
  const actor = await getActiveActor();
  if (!actor.ok) {
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  }
  if (actor.user.role !== "Admin") {
    return NextResponse.json(
      { error: "Action réservée à l'administrateur." },
      { status: 403 },
    );
  }

  const result = await djangoFetch<{
    detail?: string;
    removed_users?: number;
    admins_kept?: number;
  }>("/api/system/wipe/", { method: "POST" });

  if (!result.ok) {
    return NextResponse.json(
      { error: "Réinitialisation impossible." },
      { status: result.status || 400 },
    );
  }
  return NextResponse.json({ ok: true, ...result.data });
}
