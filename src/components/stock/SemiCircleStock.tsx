"use client";

import type { Product, StockStatus } from "@/types/domain";
import { useI18n } from "@/lib/i18n";
import { StatusChip } from "@/components/ui/kit";

const statusFill: Record<StockStatus, string> = {
  Stable: "var(--stable)",
  "Seuil bas": "var(--low)",
  Critique: "var(--critical)",
  "Bientôt expiré": "var(--soon)",
  Expiré: "var(--expired)",
};

const statusOrder: Record<StockStatus, number> = {
  Critique: 0,
  Expiré: 1,
  "Bientôt expiré": 2,
  "Seuil bas": 3,
  Stable: 4,
};

function polar(cx: number, cy: number, r: number, aDeg: number) {
  const a = (aDeg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy - r * Math.sin(a)] as const;
}

function sectorPath(
  cx: number,
  cy: number,
  ri: number,
  ro: number,
  a1: number,
  a2: number,
) {
  const [ox1, oy1] = polar(cx, cy, ro, a1);
  const [ox2, oy2] = polar(cx, cy, ro, a2);
  const [ix2, iy2] = polar(cx, cy, ri, a2);
  const [ix1, iy1] = polar(cx, cy, ri, a1);
  return `M${ox1},${oy1} A${ro},${ro} 0 0 1 ${ox2},${oy2} L${ix2},${iy2} A${ri},${ri} 0 0 0 ${ix1},${iy1} Z`;
}

export default function SemiCircleStock({
  products,
  selectedId,
  onSelect,
  categoryName,
}: {
  products: Product[];
  selectedId: string;
  onSelect: (id: string) => void;
  categoryName: string;
}) {
  const { t } = useI18n();
  const cx = 200;
  const cy = 198;
  const ro = 184;
  const ri = 138;
  const n = products.length;
  const selected = products.find((p) => p.id === selectedId) ?? products[0];

  // Sort by status so colour sweeps left (problems) → right (healthy).
  const ordered = [...products].sort(
    (a, b) =>
      statusOrder[a.status] - statusOrder[b.status] ||
      a.name.localeCompare(b.name, "fr"),
  );

  const slice = 180 / Math.max(1, n);
  const gap = Math.min(1.4, slice * 0.12);

  const [oxL] = polar(cx, cy, ro, 180);
  const [oxR] = polar(cx, cy, ro, 0);

  return (
    <div className="semicircle-wrap">
      <svg
        viewBox="0 0 400 212"
        className="w-full"
        role="img"
        aria-label={t("Répartition par produit")}
      >
        <line x1={oxL} y1={cy} x2={oxR} y2={cy} stroke="var(--line)" strokeWidth={1} />
        {ordered.map((product, index) => {
          const ca = 180 - slice * (index + 0.5);
          const a1 = ca + slice / 2 - gap / 2;
          const a2 = ca - slice / 2 + gap / 2;
          const isActive = product.id === selected?.id;
          const outerR = isActive ? ro + 7 : ro;
          return (
            <path
              key={product.id}
              d={sectorPath(cx, cy, ri, outerR, a1, a2)}
              fill={isActive ? "var(--ink)" : statusFill[product.status]}
              fillOpacity={isActive ? 1 : 0.86}
              stroke="var(--bg)"
              strokeWidth={0.5}
              style={{ cursor: "pointer", transition: "fill-opacity 160ms" }}
              onClick={() => onSelect(product.id)}
            >
              <title>
                {product.name} — {product.quantity} {product.unit}
              </title>
            </path>
          );
        })}
      </svg>

      <div className="semicircle-center pb-6">
        {selected ? (
          <>
            <span className="max-w-[13rem] text-center text-[0.95rem] text-[var(--ink-soft)] truncate">
              {selected.name}
            </span>
            <span className="numeric mt-1 text-[3.1rem] leading-none">
              {selected.quantity}
            </span>
            <span className="text-[0.6rem] uppercase tracking-[0.22em] text-[var(--muted)]">
              {selected.unit} · {t(categoryName)}
            </span>
            <span className="mt-3">
              <StatusChip status={selected.status} />
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}
