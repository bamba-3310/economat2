"use client";

import { Camera, LayoutDashboard, PackageSearch, Truck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAppData, hasClientPermission, type Section } from "@/lib/app-data";

const items: Array<{ id: Section; label: string; icon: typeof LayoutDashboard }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "livraison", label: "Livraison", icon: Truck },
  { id: "stock", label: "Stock", icon: PackageSearch },
  { id: "scan", label: "Scan", icon: Camera },
];

export default function BottomNav({
  activeSection,
  onChange,
}: {
  activeSection: Section;
  onChange: (section: Section) => void;
}) {
  const { t } = useI18n();
  const { currentUser } = useAppData();

  // Livraison is permission-driven and shows on phones too (matches legacy).
  const visible = items.filter(
    (item) =>
      item.id !== "livraison" ||
      hasClientPermission(currentUser, ["validate_deliveries"]),
  );

  return (
    <nav className="bottomnav" aria-label="Navigation">
      {visible.map((item) => {
        const Icon = item.icon;
        const active = activeSection === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: "smooth" });
              onChange(item.id);
            }}
            className={`bottomnav-item ${active ? "active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={18} strokeWidth={1.5} className="tick" />
            <span>{t(item.label)}</span>
          </button>
        );
      })}
    </nav>
  );
}
