import { type NextRequest, NextResponse } from "next/server";
import { readDatabase } from "@/server/local-database";
import { requirePermission } from "@/server/permissions";
// WHEN/WHY: createCategory added so the Settings panel can create categories
// (Django already supports POST /api/categories/; the UI/adapter lacked it).
import { createCategory, deleteCategory, updateCategorySettings } from "@/server/stock-service";
import type { Category, CategoryMode } from "@/types/domain";

export const runtime = "nodejs";

const categoryModes: CategoryMode[] = ["Standard", "FEFO strict", "Multi-lots"];

type CategoryPatch = Partial<
  Pick<
    Category,
    | "autoExpirationDays"
    | "criticalThreshold"
    | "defaultThreshold"
    | "mode"
    | "soonExpiresDays"
    | "switchThreshold"
  >
>;

function readPositiveNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.round(value));
}

export async function GET() {
  const database = await readDatabase();

  return NextResponse.json({
    categories: database.categories,
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as CategoryPatch & {
    actorId?: string;
    name?: string;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Nom de catégorie requis." }, { status: 400 });
  }

  const access = await requirePermission(body.actorId, [
    "manage_categories",
    "edit_thresholds",
  ]);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const result = await createCategory({
      name: body.name,
      mode: body.mode && categoryModes.includes(body.mode) ? body.mode : undefined,
      defaultThreshold: readPositiveNumber(body.defaultThreshold),
      criticalThreshold: readPositiveNumber(body.criticalThreshold),
      soonExpiresDays: readPositiveNumber(body.soonExpiresDays),
      switchThreshold: readPositiveNumber(body.switchThreshold),
      autoExpirationDays: readPositiveNumber(body.autoExpirationDays),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Catégorie non créée." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as CategoryPatch & {
    actorId?: string;
    categoryId?: string;
  };

  if (!body.categoryId || body.categoryId === "all") {
    return NextResponse.json(
      { error: "categoryId métier requis." },
      { status: 400 },
    );
  }

  const patch: CategoryPatch = {};

  if (body.mode && categoryModes.includes(body.mode)) {
    patch.mode = body.mode;
  }

  const defaultThreshold = readPositiveNumber(body.defaultThreshold);
  const criticalThreshold = readPositiveNumber(body.criticalThreshold);
  const soonExpiresDays = readPositiveNumber(body.soonExpiresDays);
  const switchThreshold = readPositiveNumber(body.switchThreshold);
  const autoExpirationDays = readPositiveNumber(body.autoExpirationDays);

  if (defaultThreshold !== undefined) patch.defaultThreshold = defaultThreshold;
  if (criticalThreshold !== undefined) patch.criticalThreshold = criticalThreshold;
  if (soonExpiresDays !== undefined) patch.soonExpiresDays = soonExpiresDays;
  if (switchThreshold !== undefined) patch.switchThreshold = switchThreshold;
  if (autoExpirationDays !== undefined) {
    patch.autoExpirationDays = autoExpirationDays;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "Aucun réglage valide reçu." },
      { status: 400 },
    );
  }

  const access = await requirePermission(body.actorId, [
    "manage_categories",
    "edit_thresholds",
  ]);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const result = await updateCategorySettings({
    categoryId: body.categoryId,
    patch,
  });

  if (!result.category) {
    return NextResponse.json({ error: "Catégorie introuvable." }, { status: 404 });
  }

  return NextResponse.json(result);
}

// WHEN/WHY: delete an (empty) category from the Stock page. Only categories with
// no linked product can be removed (the service enforces it; the UI only offers
// the button on empty categories).
export async function DELETE(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    actorId?: string;
    categoryId?: string;
  };

  if (!body.categoryId || body.categoryId === "all") {
    return NextResponse.json({ error: "categoryId requis." }, { status: 400 });
  }

  const access = await requirePermission(body.actorId, [
    "manage_categories",
    "edit_thresholds",
  ]);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const result = await deleteCategory({ categoryId: body.categoryId });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.message ?? "Suppression impossible." },
      { status: 400 },
    );
  }

  return NextResponse.json(result);
}
