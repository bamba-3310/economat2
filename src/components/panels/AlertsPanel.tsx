"use client";

import { useState } from "react";
import { ScanLine } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAppData } from "@/lib/app-data";
import { formatDate } from "@/lib/format";
import type { Alert } from "@/types/domain";
import { Eyebrow } from "@/components/ui/kit";
import PanelShell from "@/components/panels/PanelShell";

const priorityBar: Record<string, string> = {
  Bloquant: "var(--ink)",
  Urgent: "var(--muted)",
  Attention: "var(--faint)",
};

function actionLabel(alert: Alert) {
  if (alert.type === "Produit expiré") return "Bloquer";
  if (alert.type === "Produit bientôt expiré") return "FEFO";
  if (alert.type === "Stock critique") return "Traiter";
  if (alert.type === "Seuil bas") return "Prévoir";
  return "Ouvrir";
}

export default function AlertsPanel({
  onClose,
  onOpenProduct,
  onFocusLot,
}: {
  onClose: () => void;
  onOpenProduct: (productId: string) => void;
  onFocusLot?: (lotId: string) => void;
}) {
  const { t, tm } = useI18n();
  const { alerts, lots, products } = useAppData();
  const [filter, setFilter] = useState<Alert["priority"] | "all">("all");

  const filtered = filter === "all" ? alerts : alerts.filter((a) => a.priority === filter);
  const counts = {
    Bloquant: alerts.filter((a) => a.priority === "Bloquant").length,
    Urgent: alerts.filter((a) => a.priority === "Urgent").length,
    Attention: alerts.filter((a) => a.priority === "Attention").length,
  };
  const leading = alerts[0];
  const leadingProduct = products.find((p) => p.id === leading?.productId);
  const leadingLot = lots.find((l) => l.id === leading?.lotId);

  const summary = [
    { key: "Bloquant" as const, label: t("Bloquantes"), count: counts.Bloquant },
    { key: "Urgent" as const, label: t("Urgentes"), count: counts.Urgent },
    { key: "Attention" as const, label: t("À surveiller"), count: counts.Attention },
  ];

  return (
    <PanelShell eyebrow={t("Alertes")} title={t("File d'intervention")} wide onClose={onClose}>
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[3px] border border-[var(--line)] bg-[var(--line)]">
        {summary.map((item) => {
          const active = filter === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter((value) => (value === item.key ? "all" : item.key))}
              className={`px-4 py-4 text-left transition-colors ${
                active ? "bg-[var(--ink)] text-[var(--bg)]" : "bg-[var(--bg-2)]"
              }`}
            >
              <span className="numeric block text-2xl leading-none">{item.count}</span>
              <span className="mt-2 block text-[0.58rem] uppercase tracking-[0.16em] opacity-70">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {leading && leadingProduct ? (
        <button
          type="button"
          onClick={() => onOpenProduct(leading.productId)}
          className="card mt-5 w-full p-5 text-left"
        >
          <Eyebrow>{t("Prochaine action")}</Eyebrow>
          <div className="mt-2 display text-lg">{leadingProduct.name}</div>
          <p className="mt-1 text-[0.82rem] text-[var(--muted)]">{tm(leading.message)}</p>
          <div className="mt-3 flex items-center gap-4 text-[0.78rem] text-[var(--muted)]">
            <span className="chip">{t(leading.type)}</span>
            <span className="tabular">
              {leadingLot
                ? `${leadingLot.remainingQuantity} ${t("restant")}`
                : `${leadingProduct.quantity} ${leadingProduct.unit}`}
            </span>
            {leadingLot ? (
              <span className="tabular">
                {t("Exp.")} {formatDate(leadingLot.expirationDate)}
              </span>
            ) : null}
          </div>
        </button>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 border-y border-[var(--line)] py-2">
        {(["all", "Bloquant", "Urgent", "Attention"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`text-[0.64rem] uppercase tracking-[0.16em] transition-colors ${
              filter === value
                ? "text-[var(--ink)] underline underline-offset-4"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            {value === "all" ? t("Toutes") : t(value)}
          </button>
        ))}
        <span className="ml-auto text-[0.7rem] text-[var(--faint)]">{filtered.length}</span>
      </div>

      <ul className="mt-2 flex flex-col">
        {filtered.length === 0 ? (
          <li className="py-8 text-center text-sm text-[var(--muted)]">{t("Sous contrôle")}</li>
        ) : (
          filtered.map((alert) => {
            const product = products.find((p) => p.id === alert.productId);
            const lot = lots.find((l) => l.id === alert.lotId);
            return (
              <li
                key={alert.id}
                className="flex items-center justify-between gap-3 border-b border-[var(--line)] py-3.5 last:border-0"
              >
                <button
                  type="button"
                  onClick={() => onOpenProduct(alert.productId)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span
                    className="h-10 w-[2px] shrink-0"
                    style={{ background: priorityBar[alert.priority] ?? "var(--faint)" }}
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[0.92rem]">
                        {product?.name ?? t("Produit")}
                      </span>
                      <span className="shrink-0 text-[0.6rem] uppercase tracking-[0.14em] text-[var(--muted)]">
                        {t(alert.priority)}
                      </span>
                    </span>
                    <span className="block truncate text-[0.74rem] text-[var(--muted)]">
                      {lot?.code ? `${lot.code} · ` : ""}
                      {t(alert.type)} — {tm(alert.message)}
                    </span>
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-[0.6rem] uppercase tracking-[0.14em] text-[var(--muted)]">
                    {t(actionLabel(alert))}
                  </span>
                  {alert.lotId && onFocusLot ? (
                    <button
                      type="button"
                      className="icon-btn h-9 w-9"
                      aria-label={t("Scanner")}
                      onClick={() => onFocusLot(alert.lotId as string)}
                    >
                      <ScanLine size={14} strokeWidth={1.5} />
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })
        )}
      </ul>
    </PanelShell>
  );
}
