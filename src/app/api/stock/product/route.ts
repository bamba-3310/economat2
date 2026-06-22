import { type NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/permissions";
import { deleteProduct } from "@/server/stock-service";

export const runtime = "nodejs";

// WHEN/WHY: delete a product (article). Added with the stock-management feature.
// Requires edit_stock; Django refuses when the product still has history.
export async function DELETE(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    actorId?: string;
    productId?: string;
  };

  if (!body.productId) {
    return NextResponse.json({ error: "productId est requis." }, { status: 400 });
  }

  const access = await requirePermission(body.actorId, ["edit_stock"]);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const result = await deleteProduct({ productId: body.productId });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Suppression impossible.",
      },
      { status: 400 },
    );
  }
}
