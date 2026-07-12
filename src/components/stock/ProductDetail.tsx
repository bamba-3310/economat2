"use client";

import { useState } from "react";
import { ScanLine, SlidersHorizontal } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAppData, hasClientPermission } from "@/lib/app-data";
import { getCategoryRuleLabel, getNextExpirationDate } from "@/lib/stock-engine";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Lot, Product, StockMovement } from "@/types/domain";
import { Eyebrow, LotStatusChip, StatusChip } from "@/components/ui/kit";
import StockCorrectionPanel from "@/components/stock/StockCorrectionPanel";

function signedQuantity(movement: StockMovement) {
  if (movement.type === "Sortie") return `-${Math.abs(movement.quantity)}`;
  if (movement.type === "Correction")
    return `${movement.quantity > 0 ? "+" : ""}${movement.quantity}`;
  return `+${Math.abs(movement.quantity)}`;
}

export default function ProductDetail({
  product,
  lots,
  categoryName,
  onFocusLot,
}: {
  product: Product;
  lots: Lot[];
  categoryName: string;
  onFocusLot: (lotId: string) => void;
}) {
  const { t } = useI18n();
  const { categories, currentUser, movements, users } = useAppData();
  const category = categories.find((item) => item.id === product.categoryId);
  const ruleLabel = getCategoryRuleLabel(category);

  const activeLots = lots.filter((lot) => lot.status === "En service");
  const reserveLots = lots.filter((lot) => lot.status === "En réserve");
  const nextExpiration = getNextExpirationDate(lots);
  const earliestExpiration = [...lots]
    .map((lot) => lot.expirationDate)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))[0];
  const displayedExpiration = nextExpiration ?? earliestExpiration;
  const isExpiredProduct = product.status === "Expiré";

  const productMovements = movements
    .filter((movement) => movement.productId === product.id)
    .slice(0, 4);

  const ratio = product.threshold
    ? Math.min(1, product.quantity / (product.threshold * 1.5))
    : 1;

  const canEditProduct = hasClientPermission(currentUser, [
    "edit_stock",
    "edit_thresholds",
    "edit_lots",
    "edit_expiration_dates",
  ]);
  const [showCorrection, setShowCorrection] = useState(false);

  return (
    <section className="flex flex-col gap-3">
      {/* Summary */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Eyebrow>
              {t(categoryName)} · {t(ruleLabel)}
            </Eyebrow>
            <h2 className="display mt-2 text-2xl leading-tight">{product.name}</h2>
          </div>
          <StatusChip status={product.status} />
        </div>

        <div className="mt-6 flex items-baseline gap-3">
          <span className="numeric text-[3rem] leading-none">{product.quantity}</span>
          <span className="text-sm text-[var(--muted)]">{product.unit}</span>
          <span className="ml-auto text-[0.72rem] uppercase tracking-[0.16em] text-[var(--muted)]">
            {t("Seuil")} {product.threshold}
          </span>
        </div>

        <div className="mt-3 h-[2px] w-full bg-[var(--line)]">
          <div
            className="h-full bg-[var(--ink)] transition-[width] duration-500"
            style={{ width: `${Math.max(4, ratio * 100)}%` }}
          />
        </div>

        <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-[2px] border border-[var(--line)] bg-[var(--line)]">
          <Stat label={t("Service")} value={String(activeLots.length)} />
          <Stat label={t("Réserve")} value={String(reserveLots.length)} />
          <Stat
            label={isExpiredProduct ? t("Expiration") : t("Prochaine expiration")}
            value={displayedExpiration ? formatDate(displayedExpiration) : "—"}
            danger={isExpiredProduct}
          />
        </div>
      </div>

      {/* Lots */}
      <div className="card p-6">
        <div className="flex items-center justify-between gap-3">
          <Eyebrow>{t("Lots")}</Eyebrow>
          <button
            type="button"
            disabled={!canEditProduct}
            onClick={() => setShowCorrection((value) => !value)}
            className="btn btn-line btn-sm disabled:opacity-40"
          >
            <SlidersHorizontal size={13} strokeWidth={1.5} />
            {showCorrection ? t("Fermer") : t("Modifier")}
          </button>
        </div>
        <ul className="mt-3 flex flex-col">
          {lots.length === 0 ? (
            <li className="py-4 text-sm text-[var(--muted)]">{t("Aucun lot ouvert")}</li>
          ) : (
            lots.map((lot) => {
              const percent = Math.max(
                6,
                (lot.remainingQuantity / Math.max(lot.initialQuantity, 1)) * 100,
              );
              return (
                <li
                  key={lot.id}
                  className="border-b border-[var(--line)] py-3 last:border-0"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="tabular truncate text-[0.86rem]">{lot.code}</div>
                      <div className="text-[0.72rem] text-[var(--muted)]">
                        {lot.remainingQuantity}/{lot.initialQuantity} {product.unit} ·{" "}
                        {t("Exp.")} {formatDate(lot.expirationDate)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <LotStatusChip status={lot.status} />
                      <button
                        type="button"
                        className="icon-btn h-9 w-9"
                        aria-label={t("Scanner")}
                        title={t("Scanner")}
                        onClick={() => onFocusLot(lot.id)}
                      >
                        <ScanLine size={14} strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 h-[2px] w-full bg-[var(--line)]">
                    <div
                      className="h-full bg-[var(--ink)]"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>

      {/* Correction (gated) */}
      {showCorrection && canEditProduct ? (
        <StockCorrectionPanel key={product.id} product={product} lots={lots} />
      ) : null}

      {/* Traceability */}
      {productMovements.length > 0 ? (
        <div className="card p-6">
          <Eyebrow>{t("Traçabilité")}</Eyebrow>
          <ul className="mt-3 flex flex-col">
            {productMovements.map((movement) => {
              const lotCode = lots.find((lot) => lot.id === movement.lotId)?.code;
              // Prefer the server-side name snapshot: it survives account
              // deletion and works for non-admins (who can't fetch the users
              // list). The live lookup is only a fallback for legacy rows.
              const userName =
                movement.actorName ||
                (users.find((user) => user.id === movement.actorId)?.name ??
                  t("Système"));
              const quantityLabel =
                movement.type === "Activation"
                  ? t("Activation")
                  : `${signedQuantity(movement)} ${movement.unit}`;
              return (
                <li
                  key={movement.id}
                  className="flex items-baseline justify-between gap-4 border-b border-[var(--line)] py-3 last:border-0"
                >
                  <span className="min-w-0">
                    <span className="block text-[0.86rem]">{t(movement.type)}</span>
                    <span className="block truncate text-[0.72rem] text-[var(--muted)]">
                      {lotCode ?? t("Lot")} · {userName} ·{" "}
                      {formatDateTime(movement.createdAt)}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-[0.8rem]">{quantityLabel}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function Stat({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="bg-[var(--bg-2)] px-4 py-3">
      <div className="text-[0.6rem] uppercase tracking-[0.16em] text-[var(--muted)]">
        {label}
      </div>
      <div
        className={`tabular mt-1 text-sm ${danger ? "text-[var(--critical)]" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
