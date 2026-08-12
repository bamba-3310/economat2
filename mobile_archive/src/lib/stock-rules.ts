// Port of the scan decision rules from the web app (src/lib/stock-engine.ts,
// evaluateLotScan), rewritten against the raw Django shapes since the mobile
// app has no Next.js adapter layer.

import type { Article, Batch, Category } from "../api/types";

export type ScanDecision = {
  canActivate: boolean;
  canExit: boolean;
  severity: "ok" | "warning" | "blocked";
  // i18n key, resolved by the caller
  reason: string;
  olderLot?: Batch;
};

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isExpired(batch: Batch, today = todayIso()): boolean {
  return Boolean(batch.expiry_date && batch.expiry_date < today);
}

// FEFO strict: a lot cannot be activated while an older usable lot of the
// same article still has remaining quantity.
function findOlderFefoLot(batch: Batch, allBatches: Batch[], today: string): Batch | undefined {
  return allBatches.find(
    (candidate) =>
      candidate.id !== batch.id &&
      candidate.article === batch.article &&
      candidate.quantity > 0 &&
      !isExpired(candidate, today) &&
      candidate.expiry_date !== null &&
      (batch.expiry_date === null || candidate.expiry_date < batch.expiry_date),
  );
}

export function evaluateScan({
  batch,
  category,
  allBatches,
  quantityOut,
  today = todayIso(),
}: {
  batch: Batch;
  article: Article;
  category?: Category;
  allBatches: Batch[];
  quantityOut: number;
  today?: string;
}): ScanDecision {
  const expired = isExpired(batch, today);
  const olderLot =
    category?.mode === "fefo" ? findOlderFefoLot(batch, allBatches, today) : undefined;

  const canActivate = batch.status === "reserve" && !expired && !olderLot;
  const canExit = batch.status === "in_service" && !expired && batch.quantity > 0;

  if (expired) {
    return {
      canActivate: false,
      canExit: false,
      severity: "blocked",
      reason: "Lot expiré : sortie et activation interdites",
    };
  }

  if (olderLot) {
    return {
      canActivate: false,
      canExit,
      severity: "blocked",
      reason: "Activation refusée : un lot plus ancien doit être utilisé en priorité.",
      olderLot,
    };
  }

  if (quantityOut > batch.quantity && canExit) {
    return {
      canActivate,
      canExit: false,
      severity: "blocked",
      reason: "Quantité supérieure au restant",
    };
  }

  if (canActivate) {
    return { canActivate, canExit, severity: "ok", reason: "Lot conforme" };
  }

  if (canExit) {
    const lowMultiLot =
      category?.mode === "multi_lots" &&
      category.switch_threshold !== null &&
      category.switch_threshold !== undefined &&
      batch.quantity <= category.switch_threshold;
    return {
      canActivate,
      canExit,
      severity: lowMultiLot ? "warning" : "ok",
      reason: lowMultiLot ? "Lot faible : activer un autre lot" : "Règles conformes",
    };
  }

  return {
    canActivate: false,
    canExit: false,
    severity: "warning",
    reason: "Aucune action directe pour ce statut",
  };
}

export type ArticleStatus = "Critique" | "Seuil bas" | "Stable";

export function articleStatus(article: Article, category?: Category): ArticleStatus {
  const critical = category?.critical_threshold ?? 0;
  const low = article.min_threshold || category?.default_threshold || 0;
  if (article.stock_quantity === 0 || article.stock_quantity <= critical) return "Critique";
  if (low > 0 && article.stock_quantity <= low) return "Seuil bas";
  return "Stable";
}
