import { type NextRequest, NextResponse } from "next/server";
import { readDatabase } from "@/server/local-database";
import { requirePermission } from "@/server/permissions";
import { createSupplier, updateSupplier } from "@/server/stock-service";

export const runtime = "nodejs";

export async function GET() {
  const database = await readDatabase();

  return NextResponse.json({
    suppliers: database.suppliers,
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    actorId?: string;
    contact?: string;
    email?: string;
    name?: string;
    phone?: string;
  };

  if (!body.name?.trim()) {
    return NextResponse.json(
      { error: "name est requis." },
      { status: 400 },
    );
  }

  const access = await requirePermission(body.actorId, ["validate_deliveries"]);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const result = await createSupplier({
    contact: body.contact,
    email: body.email,
    name: body.name,
    phone: body.phone,
  });

  return NextResponse.json(result, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as {
    active?: boolean;
    actorId?: string;
    contact?: string;
    email?: string;
    name?: string;
    phone?: string;
    supplierId?: string;
  };

  if (!body.supplierId) {
    return NextResponse.json(
      { error: "supplierId est requis." },
      { status: 400 },
    );
  }

  const access = await requirePermission(body.actorId, ["validate_deliveries"]);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  let result: Awaited<ReturnType<typeof updateSupplier>>;

  try {
    result = await updateSupplier({
      active: body.active,
      contact: body.contact,
      email: body.email,
      name: body.name,
      phone: body.phone,
      supplierId: body.supplierId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fournisseur non modifié." },
      { status: 400 },
    );
  }

  return NextResponse.json(result);
}
