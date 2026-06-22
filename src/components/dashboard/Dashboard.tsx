"use client";

import { useEffect, useState } from "react";
import { ScanLine } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAppData } from "@/lib/app-data";
import { getCategoryRuleLabel } from "@/lib/stock-engine";
import { formatDate, getServiceLabel, getTodayInputDate } from "@/lib/format";
import { Eyebrow } from "@/components/ui/kit";

// Mono priority hierarchy: blocking = ink, urgent = muted, attention = faint.
const priorityBar: Record<string, string> = {
  Bloquant: "var(--ink)",
  Urgent: "var(--muted)",
  Attention: "var(--faint)",
};

export default function Dashboard({
  onOpenProduct,
  onFocusLot,
}: {
  onOpenProduct: (productId: string) => void;
  onFocusLot?: (lotId: string) => void;
}) {
  const { t } = useI18n();
  const {
    activities,
    alerts,
    categories,
    deliveries,
    lots,
    movements,
    operationDate,
    products,
    users,
  } = useAppData();

  const stockAlerts = alerts.filter(
    (alert) => alert.type === "Seuil bas" || alert.type === "Stock critique",
  );
  const urgentAlerts = alerts.filter(
    (alert) => alert.priority === "Urgent" || alert.priority === "Bloquant",
  );
  const pendingAccounts = users.filter(
    (user) => user.status === "En attente",
  ).length;

  const today = getTodayInputDate();
  const deliveriesToday = deliveries.filter(
    (delivery) => delivery.deliveredAt === today,
  );
  const movementsToday = movements.filter(
    (movement) => movement.createdAt.slice(0, 10) === today,
  );
  const deliveryCount = deliveriesToday.length;
  const deliveredLotCount = deliveriesToday.reduce(
    (sum, delivery) => sum + delivery.lines.length,
    0,
  );
  const scanCount = movementsToday.filter(
    (movement) => movement.type === "Activation" || movement.type === "Sortie",
  ).length;
  const activationCount = movementsToday.filter(
    (movement) => movement.type === "Activation",
  ).length;
  const outputCount = movementsToday
    .filter((movement) => movement.type === "Sortie")
    .reduce((sum, movement) => sum + Math.abs(movement.quantity), 0);

  const urgentAlert = alerts[0];
  const urgentProduct =
    products.find((product) => product.id === urgentAlert?.productId) ??
    products[0];
  const urgentLot = lots.find((lot) => lot.id === urgentAlert?.lotId);

  const metrics = [
    {
      label: t("Alertes seuil"),
      value: stockAlerts.length,
      detail: `${urgentAlerts.length} ${t("urgentes")}`,
    },
    {
      label: t("Livraisons du jour"),
      value: deliveryCount,
      detail: `${deliveredLotCount} ${t("lots créés")}`,
    },
    {
      label: t("Scans du jour"),
      value: scanCount,
      detail: `${activationCount} ${t("activations")}`,
    },
    {
      label: t("Sorties du jour"),
      value: outputCount,
      detail: t("unités sorties"),
    },
  ];

  const ruleCategories = categories.filter((category) => category.id !== "all");
  const priorityWidth = Math.min(
    100,
    Math.max(
      6,
      Math.round(
        ((urgentProduct?.quantity ?? 0) /
          Math.max(urgentProduct?.threshold ?? 1, 1)) *
          100,
      ),
    ),
  );

  const [serviceLabel, setServiceLabel] = useState(() => getServiceLabel());
  useEffect(() => {
    const timer = window.setInterval(() => setServiceLabel(getServiceLabel()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const signals = [
    { label: t("Couverture stock"), value: t("Sous contrôle") },
    {
      label: t("Comptes"),
      value:
        pendingAccounts > 0
          ? `${pendingAccounts} ${t("à approuver")}`
          : t("À jour"),
    },
    { label: t("Mode scan"), value: t("Disponible") },
  ];

  return (
    <div className="flex flex-col gap-12">
      {/* Header */}
      <header className="view-head">
        <div>
          <Eyebrow>
            {t("Service")} · {formatDate(operationDate)}
          </Eyebrow>
          <h1 className="view-title mt-3">{t(serviceLabel)}</h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-[var(--muted)]">
            {t("Ce qui demande une décision ou une vérification.")}
          </p>
        </div>
        <dl className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-10 sm:gap-y-3">
          {signals.map((signal) => (
            <div
              key={signal.label}
              className="flex items-baseline justify-between gap-4 border-b border-[var(--line-soft)] pb-2 sm:block sm:border-0 sm:pb-0"
            >
              <dt className="text-[0.6rem] uppercase tracking-[0.2em] text-[var(--muted)]">
                {signal.label}
              </dt>
              <dd className="text-[0.9rem] sm:mt-1">{signal.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      {/* Metrics band */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-[3px] border border-[var(--line)] bg-[var(--line)] md:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="bg-[var(--bg-2)] px-6 py-7">
            <div className="numeric text-[2.6rem] leading-none">
              {String(metric.value).padStart(2, "0")}
            </div>
            <div className="mt-3 text-[0.62rem] uppercase tracking-[0.2em] text-[var(--muted)]">
              {metric.label}
            </div>
            <div className="mt-1 text-[0.72rem] text-[var(--faint)]">
              {metric.detail}
            </div>
          </div>
        ))}
      </section>

      {/* Operational priority */}
      {urgentProduct ? (
        <button
          type="button"
          onClick={() => onOpenProduct(urgentProduct.id)}
          className="card w-full p-7 text-left sm:p-9"
        >
          <span className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--ink)]" />
            <Eyebrow tone="ink">{t("Priorité opérationnelle")}</Eyebrow>
          </span>
          <h2 className="display mt-6 text-3xl sm:text-4xl">{urgentProduct.name}</h2>
          <p className="mt-3 max-w-[58ch] text-sm leading-6 text-[var(--muted)]">
            {t("Lot")} {urgentLot?.code ?? t("à vérifier")}, {t("expiration")}{" "}
            {urgentLot ? formatDate(urgentLot.expirationDate) : t("à confirmer")}.{" "}
            {t("Le niveau critique impose une lecture immédiate du détail.")}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[3px] border border-[var(--line)] bg-[var(--line)]">
            <div className="bg-[var(--bg-2)] px-5 py-4">
              <div className="text-[0.6rem] uppercase tracking-[0.2em] text-[var(--muted)]">
                {t("Restant")}
              </div>
              <div className="numeric mt-1 text-xl">
                {urgentProduct.quantity} {urgentProduct.unit}
              </div>
            </div>
            <div className="bg-[var(--bg-2)] px-5 py-4">
              <div className="text-[0.6rem] uppercase tracking-[0.2em] text-[var(--muted)]">
                {t("Seuil")}
              </div>
              <div className="numeric mt-1 text-xl">
                {urgentProduct.threshold} {urgentProduct.unit}
              </div>
            </div>
          </div>
          <div className="mt-4 h-[3px] w-full bg-[var(--line)]">
            <div
              className="h-full bg-[var(--ink)]"
              style={{ width: `${priorityWidth}%` }}
            />
          </div>
        </button>
      ) : null}

      {/* Watch queue + activity */}
      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="display text-xl">{t("File d’attention")}</h2>
            <Eyebrow>{`${alerts.length} ${t("ouverts")}`}</Eyebrow>
          </div>
          <div className="rule mt-4" />
          <ul className="mt-2 flex flex-col">
            {alerts.length === 0 ? (
              <li className="py-8 text-center text-sm text-[var(--muted)]">
                {t("Sous contrôle")}
              </li>
            ) : (
              alerts.slice(0, 6).map((alert) => {
                const product = products.find((item) => item.id === alert.productId);
                const lot = lots.find((item) => item.id === alert.lotId);
                return (
                  <li
                    key={alert.id}
                    className="flex items-center justify-between gap-4 border-b border-[var(--line)] py-4 last:border-0"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenProduct(alert.productId)}
                      className="flex min-w-0 flex-1 items-center gap-4 text-left"
                    >
                      <span
                        className="h-9 w-[2px] shrink-0"
                        style={{ background: priorityBar[alert.priority] ?? "var(--faint)" }}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-[0.95rem]">
                          {product?.name ?? t(alert.type)}
                        </span>
                        <span className="block truncate text-[0.78rem] text-[var(--muted)]">
                          {lot?.code ? `${lot.code} · ` : ""}
                          {t(alert.type)}
                        </span>
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="chip">{t(alert.priority)}</span>
                      {alert.lotId && onFocusLot ? (
                        <button
                          type="button"
                          onClick={() => onFocusLot(alert.lotId as string)}
                          className="icon-btn h-9 w-9"
                          aria-label={t("Scanner")}
                          title={t("Scanner")}
                        >
                          <ScanLine size={15} strokeWidth={1.5} />
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </section>

        <section>
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="display text-xl">{t("Activité récente")}</h2>
            <Eyebrow>{t("Traçabilité")}</Eyebrow>
          </div>
          <div className="rule mt-4" />
          <ul className="mt-2 flex flex-col">
            {activities.length === 0 ? (
              <li className="py-8 text-center text-sm text-[var(--muted)]">—</li>
            ) : (
              activities.slice(0, 6).map((activity) => (
                <li
                  key={activity.id}
                  className="flex items-baseline justify-between gap-4 border-b border-[var(--line)] py-4 last:border-0"
                >
                  <span className="min-w-0">
                    <span className="block text-[0.9rem]">{activity.label}</span>
                    <span className="block truncate text-[0.76rem] text-[var(--muted)]">
                      {activity.detail}
                    </span>
                  </span>
                  <span className="shrink-0 text-[0.64rem] uppercase tracking-[0.14em] text-[var(--faint)]">
                    {activity.time}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      {/* Rules per category */}
      {ruleCategories.length > 0 ? (
        <section>
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="display text-xl">{t("Règles actives")}</h2>
          </div>
          <div className="rule mt-4" />
          <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-[3px] border border-[var(--line)] bg-[var(--line)] sm:grid-cols-3 lg:grid-cols-5">
            {ruleCategories.map((category) => {
              const count = products.filter(
                (product) => product.categoryId === category.id,
              ).length;
              return (
                <div key={category.id} className="bg-[var(--bg-2)] px-5 py-6">
                  <div className="text-[0.95rem]">{category.name}</div>
                  <div className="mt-2 text-[0.62rem] uppercase tracking-[0.16em] text-[var(--muted)]">
                    {t(getCategoryRuleLabel(category))}
                  </div>
                  <div className="numeric mt-4 text-base">{count}</div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
