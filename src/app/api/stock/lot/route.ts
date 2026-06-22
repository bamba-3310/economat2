import { type NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/permissions";
import { deleteLot } from "@/server/stock-service";

export const runtime = "nodejs";

// WHEN/WHY: delete a lot (e.g. an expired one). Added with the lot-management
// feature. Requires the edit_lots permission.
export async function DELETE(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    actorId?: string;
    lotId?: string;
  };

  if (!body.lotId) {
    return NextResponse.json({ error: "lotId est requis." }, { status: 400 });
  }

  const access = await requirePermission(body.actorId, ["edit_lots"]);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const result = await deleteLot({ lotId: body.lotId });

  if (!result.ok) {
    // A message means Django rejected the delete/audit (surface it as 400); no
    // message means the lot was simply not found.
    return NextResponse.json(
      { error: result.message ?? "Lot introuvable." },
      { status: result.message ? 400 : 404 },
    );
  }

  return NextResponse.json(result);
}
