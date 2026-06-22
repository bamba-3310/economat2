"use client";

import { QRCodeSVG } from "qrcode.react";
import { ScanLine } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useBranding } from "@/lib/branding";
import { formatDate } from "@/lib/format";

export default function QrLabel({
  productName,
  lotCode,
  quantity,
  unit,
  expiration,
  value,
  scannable,
  copyIndex,
  totalCopies = 1,
  onScan,
}: {
  productName: string;
  lotCode: string;
  quantity: string;
  unit: string;
  expiration: string;
  value: string;
  scannable: boolean;
  copyIndex?: number;
  totalCopies?: number;
  onScan?: () => void;
}) {
  const { t } = useI18n();
  const { name: brandName } = useBranding();

  return (
    <div className="qr-label qr-label-card flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="eyebrow eyebrow-ink">{brandName}</div>
          <div className="display mt-1 truncate text-lg">
            {productName || t("Produit")}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`chip ${scannable ? "status-Stable" : ""}`}>
            {scannable ? t("Scanner") : t("À valider")}
          </span>
          {totalCopies > 1 && copyIndex !== undefined ? (
            <span className="text-[0.58rem] uppercase tracking-[0.16em] text-[var(--muted)]">
              {copyIndex + 1}/{totalCopies}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div
          className="shrink-0 rounded-[2px] border border-[var(--line)] p-2"
          style={{ background: "#ffffff" }}
        >
          <QRCodeSVG value={value} size={84} level="M" marginSize={0} />
        </div>
        <dl className="min-w-0 flex-1 text-[0.78rem]">
          <div className="flex justify-between gap-3 border-b border-[var(--line-soft)] py-1.5">
            <dt className="text-[var(--muted)]">{t("Lot")}</dt>
            <dd className="tabular truncate font-medium">{lotCode || "—"}</dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-[var(--line-soft)] py-1.5">
            <dt className="text-[var(--muted)]">{t("Qté")}</dt>
            <dd className="tabular">
              {quantity || "—"} {unit}
            </dd>
          </div>
          <div className="flex justify-between gap-3 py-1.5">
            <dt className="text-[var(--muted)]">{t("Exp.")}</dt>
            <dd className="tabular">{formatDate(expiration)}</dd>
          </div>
        </dl>
      </div>

      <button
        type="button"
        disabled={!scannable}
        onClick={onScan}
        className={`btn btn-sm ${scannable ? "btn-line" : "btn-ghost"} w-full`}
      >
        <ScanLine size={14} strokeWidth={1.5} />
        {scannable ? t("Scanner") : t("À valider")}
      </button>
    </div>
  );
}
