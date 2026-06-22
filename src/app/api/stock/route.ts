import { NextResponse } from "next/server";
import { getStockSnapshot } from "@/server/stock-service";

export const runtime = "nodejs";

export async function GET() {
  const snapshot = await getStockSnapshot();

  return NextResponse.json({
    operationDate: snapshot.operationDate,
    categories: snapshot.database.categories,
    products: snapshot.products,
    lots: snapshot.lots,
    alerts: snapshot.alerts,
    activities: snapshot.database.activities,
    movements: snapshot.database.movements.slice(0, 80),
    counts: {
      products: snapshot.products.length,
      lots: snapshot.lots.length,
      alerts: snapshot.alerts.length,
      activeLots: snapshot.lots.filter((lot) => lot.status === "En service").length,
      reserveLots: snapshot.lots.filter((lot) => lot.status === "En réserve").length,
    },
  });
}
