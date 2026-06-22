import { NextResponse } from "next/server";
// WHEN/WHY: storage now points at Django/PostgreSQL, not a local SQLite file.
import { storageLabel, readDatabase } from "@/server/local-database";

export const runtime = "nodejs";

export async function GET() {
  const database = await readDatabase();

  return NextResponse.json({
    ok: true,
    service: "Le Carré · Django/PostgreSQL",
    storage: storageLabel,
    updatedAt: database.updatedAt,
    counts: {
      categories: database.categories.length,
      products: database.products.length,
      lots: database.lots.length,
      users: database.users.length,
      suppliers: database.suppliers.length,
      deliveries: database.deliveries.length,
      movements: database.movements.length,
    },
  });
}
