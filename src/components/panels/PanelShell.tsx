"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * Full-height right slide-in panel (redesign). Replaces the legacy top-right
 * dropdown (TopPanelShell). Esc closes; the parent renders the backdrop.
 */
export default function PanelShell({
  title,
  eyebrow,
  meta,
  wide = false,
  onClose,
  children,
}: {
  title: string;
  eyebrow?: string;
  meta?: string;
  wide?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();

  // Esc closes. Body scroll-lock is owned solely by TopBar (which tracks the
  // active panel) — managing it here too left the body stuck `overflow:hidden`
  // after closing, because this effect captured the already-locked value.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside className={`panel ${wide ? "panel-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="panel-head">
        <div className="min-w-0">
          {eyebrow ? <div className="eyebrow mb-1">{eyebrow}</div> : null}
          <h2 className="display text-2xl leading-none">{title}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {meta ? (
            <span className="text-[0.62rem] uppercase tracking-[0.16em] text-[var(--muted)]">
              {meta}
            </span>
          ) : null}
          <button
            type="button"
            className="icon-btn h-9 w-9"
            aria-label={t("Fermer")}
            onClick={onClose}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>
      <div className="panel-body">{children}</div>
    </aside>
  );
}
