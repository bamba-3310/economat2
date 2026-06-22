"use client";

import { useI18n } from "@/lib/i18n";
import { useBranding } from "@/lib/branding";

/**
 * Full-screen overlay shown only on tablet portrait (CSS-gated via `.rotate-guard`)
 * asking the user to rotate to landscape. Redesigned monochrome version.
 */
export default function RotateGuard() {
  const { t } = useI18n();
  const { name: brandName } = useBranding();

  return (
    <div className="rotate-guard" aria-hidden="true">
      <div className="wordmark text-xl">{brandName}</div>
      <div className="meander w-24" />
      <p className="display text-lg">{t("Mode iPad paysage requis")}</p>
      <p className="max-w-xs text-sm text-[var(--muted)]">
        {t("Tournez l'iPad pour garder l'interface large.")}
      </p>
    </div>
  );
}
