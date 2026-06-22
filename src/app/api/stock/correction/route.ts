import { type NextRequest, NextResponse } from "next/server";
import { getActiveActor, userHasPermission } from "@/server/permissions";
import { correctStock } from "@/server/stock-service";
import type { LotStatus, Permission } from "@/types/domain";

export const runtime = "nodejs";

const lotStatuses: LotStatus[] = [
  "En réserve",
  "En service",
  "Bientôt épuisé",
  "Épuisé",
  "Expiré",
];

function readPositiveNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.round(value));
}

function requireEveryPermission(
  permissions: Permission[],
  hasPermission: (permission: Permission) => boolean,
) {
  return permissions.every(hasPermission);
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    actorId?: string;
    expirationDate?: string;
    lotId?: string;
    productId?: string;
    remainingQuantity?: number;
    status?: LotStatus;
    threshold?: number;
  };

  if (!body.productId) {
    return NextResponse.json({ error: "productId est requis." }, { status: 400 });
  }

  const actor = await getActiveActor(body.actorId);

  if (!actor.ok) {
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  }

  const requiredPermissions: Permission[] = [];
  const remainingQuantity = readPositiveNumber(body.remainingQuantity);
  const threshold = readPositiveNumber(body.threshold);
  const hasLotPatch = Boolean(
    body.lotId &&
      (remainingQuantity !== undefined || body.expirationDate || body.status),
  );

  if (threshold !== undefined) requiredPermissions.push("edit_thresholds");
  if (remainingQuantity !== undefined) requiredPermissions.push("edit_stock");
  if (body.expirationDate) requiredPermissions.push("edit_expiration_dates");
  if (body.status) requiredPermissions.push("edit_lots");

  if (requiredPermissions.length === 0 || (threshold === undefined && !hasLotPatch)) {
    return NextResponse.json(
      { error: "Aucune correction valide reçue." },
      { status: 400 },
    );
  }

  if (
    !requireEveryPermission(requiredPermissions, (permission) =>
      userHasPermission(actor.user, [permission]),
    )
  ) {
    return NextResponse.json({ error: "Action non autorisee." }, { status: 403 });
  }

  if (body.status && !lotStatuses.includes(body.status)) {
    return NextResponse.json({ error: "Statut de lot invalide." }, { status: 400 });
  }

  const result = await correctStock({
    actorId: actor.user.id,
    expirationDate: body.expirationDate,
    lotId: body.lotId,
    productId: body.productId,
    remainingQuantity,
    status: body.status,
    threshold,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  if (!result.product && !result.lot) {
    return NextResponse.json({ error: "Produit ou lot introuvable." }, { status: 404 });
  }

  return NextResponse.json(result);
}
