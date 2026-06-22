import { type NextRequest, NextResponse } from "next/server";
import { readDatabase, restoreDatabase } from "@/server/local-database";
import { requirePermission } from "@/server/permissions";

export const runtime = "nodejs";

function buildCounts(database: Awaited<ReturnType<typeof readDatabase>>) {
  return {
    activities: database.activities.length,
    categories: database.categories.length,
    deliveries: database.deliveries.length,
    lots: database.lots.length,
    movements: database.movements.length,
    products: database.products.length,
    suppliers: database.suppliers.length,
    users: database.users.length,
  };
}

export async function GET(request: NextRequest) {
  const actorId = request.nextUrl.searchParams.get("actorId") ?? undefined;
  const access = await requirePermission(actorId, ["manage_users"]);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const database = await readDatabase();

  return NextResponse.json({
    app: "le-carre",
    exportedAt: new Date().toISOString(),
    version: 1,
    counts: buildCounts(database),
    database,
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    actorId?: string;
    database?: unknown;
  } | null;

  if (!body?.database) {
    return NextResponse.json(
      { error: "Sauvegarde manquante." },
      { status: 400 },
    );
  }

  const access = await requirePermission(body.actorId, ["manage_users"]);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  // WHEN/WHY: with the central PostgreSQL database, replacing the whole dataset
  // from an uploaded file is intentionally disabled (restoreDatabase throws).
  try {
    await restoreDatabase(body.database);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Restauration impossible.",
      },
      { status: 400 },
    );
  }
}
