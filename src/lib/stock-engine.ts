import type {
  Alert,
  BusinessDecision,
  Category,
  Lot,
  LotStatus,
  Product,
  StockStatus,
} from "@/types/domain";

function getLocalInputDate() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);

  return localDate.toISOString().slice(0, 10);
}

export const OPERATION_DATE = getLocalInputDate();

const dayInMs = 24 * 60 * 60 * 1000;

const statusPriority: Record<StockStatus, number> = {
  Critique: 0,
  Expiré: 1,
  "Bientôt expiré": 2,
  "Seuil bas": 3,
  Stable: 4,
};

function asDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function dateDiffInDays(from: string, to: string) {
  return Math.ceil((asDate(to).getTime() - asDate(from).getTime()) / dayInMs);
}

export function addDays(date: string, days: number) {
  const next = asDate(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

export function getStatusPriority(status: StockStatus) {
  return statusPriority[status];
}

export function getCategoryForProduct(product: Product, categories: Category[]) {
  return categories.find((category) => category.id === product.categoryId);
}

export function getCategoryRuleLabel(category?: Category) {
  if (!category) return "standard";
  if (category.mode === "FEFO strict") return "FEFO strict";
  if (category.mode === "Multi-lots") return "multi-lots";
  if (category.autoExpirationDays) return `J+${category.autoExpirationDays}`;
  return "standard";
}

export function getProductLots(productId: string, lots: Lot[]) {
  return lots.filter((lot) => lot.productId === productId);
}

export function isLotExpired(lot: Lot, today = OPERATION_DATE) {
  return asDate(lot.expirationDate).getTime() < asDate(today).getTime();
}

export function getRuntimeLotStatus(
  lot: Lot,
  category?: Category,
  today = OPERATION_DATE,
): LotStatus {
  if (lot.remainingQuantity <= 0) return "Épuisé";
  if (isLotExpired(lot, today)) return "Expiré";
  if (lot.status === "En réserve") return "En réserve";

  const lowRatio = lot.remainingQuantity / Math.max(lot.initialQuantity, 1);
  const liquidSwitchReached =
    category?.mode === "Multi-lots" &&
    category.switchThreshold !== undefined &&
    lot.remainingQuantity <= category.switchThreshold;

  if (lot.status === "En service" && (lowRatio <= 0.25 || liquidSwitchReached)) {
    return "Bientôt épuisé";
  }

  return lot.status;
}

export function buildLotsWithRuntimeStatus(
  lots: Lot[],
  products: Product[],
  categories: Category[],
  today = OPERATION_DATE,
) {
  return lots.map((lot) => {
    const product = products.find((item) => item.id === lot.productId);
    const category = product ? getCategoryForProduct(product, categories) : undefined;
    return {
      ...lot,
      status: getRuntimeLotStatus(lot, category, today),
    };
  });
}

export function getRemainingQuantity(productId: string, lots: Lot[]) {
  return getProductLots(productId, lots)
    .filter((lot) => lot.remainingQuantity > 0)
    .reduce((sum, lot) => sum + lot.remainingQuantity, 0);
}

export function getNextExpirationDate(productLots: Lot[]) {
  return productLots
    .filter((lot) => lot.remainingQuantity > 0 && lot.status !== "Expiré")
    .map((lot) => lot.expirationDate)
    .sort((a, b) => asDate(a).getTime() - asDate(b).getTime())[0];
}

export function getProductStatus(
  product: Product,
  lots: Lot[],
  category?: Category,
  today = OPERATION_DATE,
): StockStatus {
  const productLots = getProductLots(product.id, lots);
  const total = getRemainingQuantity(product.id, lots);
  const hasExpiredOpenLot = productLots.some(
    (lot) => lot.remainingQuantity > 0 && isLotExpired(lot, today),
  );
  const nextExpiration = getNextExpirationDate(productLots);
  const criticalThreshold = category?.criticalThreshold ?? Math.ceil(product.threshold / 2);

  if (hasExpiredOpenLot) return "Expiré";
  if (total <= criticalThreshold) return "Critique";

  if (nextExpiration && category) {
    const days = dateDiffInDays(today, nextExpiration);
    if (days >= 0 && days <= category.soonExpiresDays) {
      return "Bientôt expiré";
    }
  }

  if (total <= product.threshold) return "Seuil bas";
  return "Stable";
}

export function buildStockProducts(
  products: Product[],
  lots: Lot[],
  categories: Category[],
  today = OPERATION_DATE,
) {
  return products.map((product) => {
    const category = getCategoryForProduct(product, categories);
    return {
      ...product,
      quantity: getRemainingQuantity(product.id, lots),
      status: getProductStatus(product, lots, category, today),
    };
  });
}

function getFirstUsefulLot(productId: string, lots: Lot[], today: string) {
  return getProductLots(productId, lots)
    .filter((lot) => lot.remainingQuantity > 0 && !isLotExpired(lot, today))
    .sort((a, b) => asDate(a.expirationDate).getTime() - asDate(b.expirationDate).getTime())[0];
}

export function generateStockAlerts(
  products: Product[],
  lots: Lot[],
  categories: Category[],
  today = OPERATION_DATE,
): Alert[] {
  const alerts: Alert[] = [];

  products.forEach((product) => {
    const category = getCategoryForProduct(product, categories);
    const usefulLot = getFirstUsefulLot(product.id, lots, today);

    if (product.status === "Critique") {
      alerts.push({
        id: `alert-${product.id}-critical`,
        type: "Stock critique",
        productId: product.id,
        lotId: usefulLot?.id,
        priority: product.quantity === 0 ? "Bloquant" : "Urgent",
        message: `${product.name} sous seuil critique.`,
      });
    } else if (product.status === "Seuil bas") {
      alerts.push({
        id: `alert-${product.id}-threshold`,
        type: "Seuil bas",
        productId: product.id,
        lotId: usefulLot?.id,
        priority: "Attention",
        message:
          category?.mode === "Multi-lots"
            ? "Prévoir l'activation d'un nouveau lot."
            : `${product.name} proche du seuil.`,
      });
    }

    getProductLots(product.id, lots).forEach((lot) => {
      if (lot.remainingQuantity <= 0) return;

      if (isLotExpired(lot, today)) {
        alerts.push({
          id: `alert-${lot.id}-expired`,
          type: "Produit expiré",
          productId: product.id,
          lotId: lot.id,
          priority: "Bloquant",
          message: `${lot.code} expiré, sortie bloquée.`,
        });
        return;
      }

      if (!category) return;
      const days = dateDiffInDays(today, lot.expirationDate);
      if (days >= 0 && days <= category.soonExpiresDays) {
        alerts.push({
          id: `alert-${lot.id}-soon`,
          type: "Produit bientôt expiré",
          productId: product.id,
          lotId: lot.id,
          priority: days <= 1 ? "Urgent" : "Attention",
          message:
            category.mode === "FEFO strict"
              ? "Lot FEFO à utiliser en priorité."
              : `${lot.code} arrive bientôt à expiration.`,
        });
      }
    });
  });

  return alerts.sort((a, b) => {
    const priorityOrder = { Bloquant: 0, Urgent: 1, Attention: 2 };
    const productA = products.find((product) => product.id === a.productId);
    const productB = products.find((product) => product.id === b.productId);
    return (
      priorityOrder[a.priority] - priorityOrder[b.priority] ||
      (productA ? getStatusPriority(productA.status) : 9) -
        (productB ? getStatusPriority(productB.status) : 9) ||
      (productA?.name ?? "").localeCompare(productB?.name ?? "", "fr")
    );
  });
}

export function getDeliveryExpirationDate({
  category,
  deliveredAt,
  proposedExpiration,
}: {
  category?: Category;
  deliveredAt: string;
  proposedExpiration?: string;
}) {
  if (category?.autoExpirationDays) {
    return addDays(deliveredAt, category.autoExpirationDays);
  }

  return proposedExpiration ?? "";
}

function findOlderFefoLot({
  lot,
  lots,
  today,
}: {
  lot: Lot;
  lots: Lot[];
  today: string;
}) {
  return lots
    .filter(
      (item) =>
        item.id !== lot.id &&
        item.productId === lot.productId &&
        item.remainingQuantity > 0 &&
        !isLotExpired(item, today) &&
        asDate(item.expirationDate).getTime() < asDate(lot.expirationDate).getTime(),
    )
    .sort((a, b) => asDate(a.expirationDate).getTime() - asDate(b.expirationDate).getTime())[0];
}

export function evaluateLotScan({
  category,
  lot,
  lots,
  quantityOut,
  today = OPERATION_DATE,
  unknownScan = false,
}: {
  category?: Category;
  lot: Lot;
  lots: Lot[];
  quantityOut: number;
  today?: string;
  unknownScan?: boolean;
}): BusinessDecision & { olderLot?: Lot; canActivate: boolean; canExit: boolean } {
  const olderLot =
    category?.mode === "FEFO strict"
      ? findOlderFefoLot({ lot, lots, today })
      : undefined;
  const expired = isLotExpired(lot, today) || lot.status === "Expiré";
  const canActivate = lot.status === "En réserve" && !expired && !olderLot;
  const canExit =
    (lot.status === "En service" || lot.status === "Bientôt épuisé") && !expired;
  const quantityError = quantityOut > lot.remainingQuantity;

  if (unknownScan) {
    return {
      allowed: false,
      action: "Créer anomalie",
      reason: "QR absent de la base",
      severity: "warning",
      olderLot,
      canActivate: false,
      canExit: false,
    };
  }

  if (expired) {
    return {
      allowed: false,
      action: "Action bloquée",
      reason: "Lot expiré : sortie et activation interdites",
      severity: "blocked",
      olderLot,
      canActivate: false,
      canExit: false,
    };
  }

  if (olderLot) {
    return {
      allowed: false,
      action: "Action bloquée",
      reason: "Activation refusée : un lot plus ancien doit être utilisé en priorité.",
      severity: "blocked",
      olderLot,
      canActivate: false,
      canExit,
    };
  }

  if (quantityError) {
    return {
      allowed: false,
      action: "Action bloquée",
      reason: "Quantité supérieure au restant",
      severity: "blocked",
      olderLot,
      canActivate,
      canExit: false,
    };
  }

  if (canActivate) {
    return {
      allowed: true,
      action: "Mettre en service",
      reason: "Lot conforme",
      severity: "ok",
      olderLot,
      canActivate,
      canExit,
    };
  }

  if (canExit) {
    const lowLiquidLot =
      category?.mode === "Multi-lots" &&
      category.switchThreshold !== undefined &&
      lot.remainingQuantity <= category.switchThreshold;

    return {
      allowed: true,
      action: "Enregistrer sortie",
      reason: lowLiquidLot ? "Lot faible : activer un autre lot" : "Règles conformes",
      severity: lowLiquidLot ? "warning" : "ok",
      olderLot,
      canActivate,
      canExit,
    };
  }

  return {
    allowed: false,
    action: "Vérifier lot",
    reason: "Aucune action directe pour ce statut",
    severity: "warning",
    olderLot,
    canActivate,
    canExit,
  };
}

export function getSuggestedScanProducts(products: Product[], activeProductId: string) {
  return products
    .filter(
      (product) =>
        product.id !== activeProductId &&
        (product.status === "Critique" ||
          product.status === "Seuil bas" ||
          product.quantity <= product.threshold),
    )
    .sort(
      (a, b) =>
        getStatusPriority(a.status) - getStatusPriority(b.status) ||
        a.quantity - b.quantity,
    )
    .slice(0, 4);
}

export function createLotQrValue(lot: Pick<Lot, "id" | "code"> | string) {
  if (typeof lot === "string") return `lecarre://lot/${lot}`;
  // WHEN/WHY: encode the human lot CODE (e.g. LC-…), not the DB id. The printed
  // label and parseLotQrValue both work off the code; encoding the numeric
  // Django id here made "select via search" produce an unmatchable QR
  // ("QR non référencé"). Falls back to id if a lot has no code.
  return `lecarre://lot/${lot.code || lot.id}`;
}

function safeDecodeLotValue(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseLotQrValue(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return {
      displayValue: "",
      lotCode: undefined,
      lotId: undefined,
    };
  }

  try {
    const payload = JSON.parse(trimmed) as {
      code?: string;
      id?: string;
      lotCode?: string;
      lotId?: string;
    };
    const nestedValue =
      payload.lotCode ?? payload.code ?? payload.lotId ?? payload.id;

    if (nestedValue) {
      return parseLotQrValue(nestedValue);
    }
  } catch {
    // Scanner payloads are usually plain text or URI values.
  }

  let searchable = safeDecodeLotValue(trimmed);

  try {
    const url = new URL(searchable);
    const pathValue = url.pathname.split("/").filter(Boolean).at(-1);
    searchable = safeDecodeLotValue(pathValue ?? url.hostname ?? searchable);
  } catch {
    // Raw lot values are accepted below.
  }

  const compactValue = searchable.replace(/\s+/g, "");
  const lotCode = compactValue.match(/LC-[A-Z0-9-]+/i)?.[0]?.toUpperCase();

  if (lotCode) {
    return {
      displayValue: lotCode,
      lotCode,
      lotId: undefined,
    };
  }

  const lotId = compactValue.match(/lot-[a-z0-9-]+/i)?.[0];

  if (lotId) {
    return {
      displayValue: lotId,
      lotCode: undefined,
      lotId,
    };
  }

  return {
    displayValue: compactValue,
    lotCode: compactValue,
    lotId: undefined,
  };
}
