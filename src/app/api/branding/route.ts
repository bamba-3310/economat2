import { type NextRequest, NextResponse } from "next/server";
import { djangoFetch, djangoPublicFetch } from "@/server/django";
import { getActiveActor } from "@/server/permissions";

export const runtime = "nodejs";

// Django shape (snake_case) -> frontend shape (camelCase).
type DjangoBranding = { name: string; default_name: string; is_custom: boolean };
const toClient = (d: DjangoBranding) => ({
  name: d.name,
  defaultName: d.default_name,
  isCustom: d.is_custom,
});

// Public: the login screen (pre-auth) needs the restaurant name.
export async function GET() {
  const result = await djangoPublicFetch<DjangoBranding>("/api/system/branding/");
  if (!result.ok || !result.data) {
    // Let the client fall back to its default constant.
    return NextResponse.json({ name: null, defaultName: null, isCustom: false });
  }
  return NextResponse.json(toClient(result.data));
}

// Admin only: set a custom name, or restore the default (`restore: true`).
export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as { name?: string; restore?: boolean };

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

  if (!body.restore && !body.name?.trim()) {
    return NextResponse.json({ error: "Nom requis." }, { status: 400 });
  }

  const payload = body.restore ? { restore: true } : { name: body.name?.trim() };
  const result = await djangoFetch<DjangoBranding>("/api/system/branding/", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  if (!result.ok || !result.data) {
    return NextResponse.json(
      { error: "Mise à jour impossible." },
      { status: result.status || 400 },
    );
  }
  return NextResponse.json(toClient(result.data));
}
