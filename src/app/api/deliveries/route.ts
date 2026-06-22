import { type NextRequest, NextResponse } from "next/server";
import { readDatabase } from "@/server/local-database";
import { requirePermission } from "@/server/permissions";
import { validateDelivery } from "@/server/stock-service";
import type { DeliveryLineInput } from "@/types/domain";

export const runtime = "nodejs";

export async function GET() {
  const database = await readDatabase();
  return NextResponse.json({
    deliveries: database.deliveries,
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    actorId?: string;
    deliveredAt?: string;
    lines?: DeliveryLineInput[];
    reference?: string;
    supplier?: string;
  };

  if (!body.supplier || !body.reference || !body.deliveredAt || !body.lines?.length) {
    return NextResponse.json(
      { error: "supplier, reference, deliveredAt et lines sont requis." },
      { status: 400 },
    );
  }

  const hasInvalidLine = body.lines.some((line) => {
    const hasProduct = Boolean(line.productId || line.productName?.trim());

    return (
      !hasProduct ||
      !line.lotCode?.trim() ||
      !line.unit?.trim() ||
      typeof line.quantity !== "number" ||
      !Number.isFinite(line.quantity) ||
      line.quantity <= 0
    );
  });

  if (hasInvalidLine) {
    return NextResponse.json(
      { error: "Chaque ligne doit avoir un produit, une quantité, une unité et un lot." },
      { status: 400 },
    );
  }

  const access = await requirePermission(body.actorId, ["validate_deliveries"]);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  let result: Awaited<ReturnType<typeof validateDelivery>>;

  try {
    result = await validateDelivery({
      actorId: access.user.id,
      deliveredAt: body.deliveredAt,
      lines: body.lines,
      reference: body.reference,
      supplier: body.supplier,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Livraison non valide.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json(result, { status: 201 });
}
