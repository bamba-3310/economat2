import { type NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/permissions";
import { recordStockMovement } from "@/server/stock-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    actorId?: string;
    lotId?: string;
    quantity?: number;
    type?: "Activation" | "Sortie";
  };

  if (!body.lotId || !body.type) {
    return NextResponse.json(
      { error: "lotId et type sont requis." },
      { status: 400 },
    );
  }

  const access = await requirePermission(
    body.actorId,
    body.type === "Activation"
      ? ["activate_lot", "edit_lots"]
      : ["edit_stock", "activate_lot"],
  );

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const result = await recordStockMovement({
    actorId: access.user.id,
    lotId: body.lotId,
    quantity: body.quantity,
    type: body.type,
  });

  if (!result.movement) {
    if (result.blockedReason) {
      return NextResponse.json({ error: result.blockedReason }, { status: 409 });
    }

    return NextResponse.json({ error: "Lot introuvable." }, { status: 404 });
  }

  return NextResponse.json(result);
}
