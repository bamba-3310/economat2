"use client";

/**
 * Shared UI primitives for the redesigned (maison-de-luxe / monochrome) interface.
 * Ported from the design reference and wired to the real app's bilingual layer:
 * status labels render through `t()` so they translate FR/EN.
 */

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import type { AppUser, LotStatus, StockStatus } from "@/types/domain";
import { useI18n } from "@/lib/i18n";

export function getInitials(name?: string) {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserAvatar({
  user,
  className = "h-10 w-10 text-xs",
}: {
  user?: AppUser | null;
  className?: string;
}) {
  if (user?.photoUrl) {
    return (
      <span
        aria-hidden="true"
        className={`inline-block shrink-0 rounded-full border border-[var(--line)] bg-cover bg-center ${className}`}
        style={{ backgroundImage: `url(${user.photoUrl})` }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-[var(--line-strong)] font-semibold uppercase tracking-[0.06em] text-[var(--ink)] ${className}`}
    >
      {getInitials(user?.name)}
    </span>
  );
}

export function Eyebrow({
  children,
  tone = "muted",
  className = "",
}: {
  children: ReactNode;
  tone?: "muted" | "ink" | "gold";
  className?: string;
}) {
  const toneClass =
    tone === "gold" ? "eyebrow-gold" : tone === "ink" ? "eyebrow-ink" : "";
  return <span className={`eyebrow ${toneClass} ${className}`}>{children}</span>;
}

const stockStatusClass: Record<StockStatus, string> = {
  Stable: "status-Stable",
  "Seuil bas": "status-low",
  Critique: "status-Critique",
  "Bientôt expiré": "status-soon",
  Expiré: "status-expired",
};

export function StatusChip({ status }: { status: StockStatus }) {
  const { t } = useI18n();
  return (
    <span className={`chip ${stockStatusClass[status]}`}>
      <span className="glyph" />
      {t(status)}
    </span>
  );
}

const lotStatusClass: Record<LotStatus, string> = {
  "En réserve": "",
  "En service": "status-Stable",
  "Bientôt épuisé": "status-low",
  Épuisé: "",
  Expiré: "status-expired",
};

export function LotStatusChip({ status }: { status: LotStatus }) {
  const { t } = useI18n();
  return <span className={`chip ${lotStatusClass[status]}`}>{t(status)}</span>;
}

export function IconButton({
  badge,
  badgeTone = "ink",
  label,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  badge?: number;
  badgeTone?: "ink" | "amber";
  label: string;
}) {
  return (
    <button
      type="button"
      className={`icon-btn ${className}`}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
      {badge !== undefined && badge > 0 ? (
        <span className={`dot ${badgeTone === "amber" ? "dot-amber" : ""}`}>
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
      {hint ? (
        <span className="mt-1 block text-[0.68rem] text-[var(--muted)]">{hint}</span>
      ) : null}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`input ${props.className ?? ""}`} />;
}

export function MetricRow({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 border-b border-[var(--line-soft)] last:border-0">
      <span className="eyebrow">{label}</span>
      <span
        className={`numeric text-[1.05rem] ${accent ? "text-[var(--gold-deep)]" : "text-[var(--ink)]"}`}
      >
        {value}
      </span>
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card-quiet flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="meander w-24 opacity-50" />
      <p className="display text-xl">{title}</p>
      {hint ? <p className="max-w-sm text-sm text-[var(--muted)]">{hint}</p> : null}
      {action}
    </div>
  );
}
