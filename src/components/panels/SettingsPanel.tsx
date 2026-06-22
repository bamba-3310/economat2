"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  Download,
  Moon,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useBranding } from "@/lib/branding";
import {
  useAppData,
  hasClientPermission,
  type CategorySettingsPatch,
  type ServerStatus,
  type ThemeMode,
} from "@/lib/app-data";
import { getCategoryRuleLabel } from "@/lib/stock-engine";
import type { Category, CategoryMode, Supplier } from "@/types/domain";
import { Eyebrow, Field, Select, TextInput } from "@/components/ui/kit";
import PanelShell from "@/components/panels/PanelShell";

type ServerAccessInfo = {
  hostUrl: string;
  isHttps: boolean;
  lanUrls: string[];
  protocol: "http" | "https";
};

const categoryModeOptions: CategoryMode[] = ["Standard", "FEFO strict", "Multi-lots"];

function parseRuleNumber(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const branding = useBranding();
  const {
    categories,
    createCategory,
    createSupplier,
    currentUser,
    exportBackup,
    importBackup,
    isSyncing,
    refreshData,
    serverStatus,
    setThemeMode,
    suppliers,
    themeMode,
    updateSupplier,
  } = useAppData();

  const editableCategories = categories.filter((category) => category.id !== "all");
  const [selectedCategoryId, setSelectedCategoryId] = useState(editableCategories[0]?.id ?? "");
  const selectedCategory =
    editableCategories.find((c) => c.id === selectedCategoryId) ?? editableCategories[0];

  const canManageCategories = hasClientPermission(currentUser, ["manage_categories", "edit_thresholds"]);
  const canManageSuppliers = hasClientPermission(currentUser, ["validate_deliveries"]);
  const canBackup = hasClientPermission(currentUser, ["manage_users"]);
  const isAdmin = currentUser?.role === "Admin";
  const fefoCount = editableCategories.filter((c) => c.mode === "FEFO strict").length;
  const multiLotCount = editableCategories.filter((c) => c.mode === "Multi-lots").length;

  // Category creator
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryMessage, setCategoryMessage] = useState("");
  async function handleCreateCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    try {
      const created = await createCategory({ name });
      if (created) {
        setNewCategoryName("");
        setCategoryMessage("Catégorie créée.");
        setSelectedCategoryId(created.id);
      } else {
        setCategoryMessage("Catégorie non créée.");
      }
    } catch (error) {
      setCategoryMessage(error instanceof Error ? error.message : "Catégorie non créée.");
    }
  }

  // Backup
  const backupRef = useRef<HTMLInputElement>(null);
  const [backupMessage, setBackupMessage] = useState("");
  async function handleExportBackup() {
    setBackupMessage("");
    try {
      const payload = await exportBackup();
      const date = new Date().toISOString().slice(0, 10);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `le-carre-sauvegarde-${date}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setBackupMessage(`${payload.counts.products} ${t("produits")}, ${payload.counts.lots} ${t("lots sauvegardés.")}`);
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : t("Sauvegarde impossible."));
    }
  }
  async function handleImportBackup(file?: File) {
    if (!file) return;
    setBackupMessage("");
    try {
      const result = await importBackup(file);
      setBackupMessage(`${t("Base restaurée :")} ${result.counts.products} ${t("produits")}, ${result.counts.lots} ${t("lots.")}`);
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : t("Restauration impossible."));
    } finally {
      if (backupRef.current) backupRef.current.value = "";
    }
  }

  // Branding
  const [restaurantName, setRestaurantName] = useState(branding.name);
  const [brandingMessage, setBrandingMessage] = useState("");
  useEffect(() => setRestaurantName(branding.name), [branding.name]);
  async function handleSaveBranding() {
    const next = restaurantName.trim();
    if (!next) {
      setBrandingMessage("Nom requis.");
      return;
    }
    const result = await branding.setName(next);
    setBrandingMessage(result.ok ? "Nom enregistré." : result.message ?? "Mise à jour impossible.");
  }
  async function handleRestoreBranding() {
    const result = await branding.restoreDefault();
    setBrandingMessage(result.ok ? "Nom par défaut restauré." : result.message ?? "Mise à jour impossible.");
  }

  // DB wipe
  const [wipeConfirm, setWipeConfirm] = useState("");
  const [wipeMessage, setWipeMessage] = useState("");
  const [isWiping, setIsWiping] = useState(false);
  async function handleWipe() {
    if (wipeConfirm.trim().toUpperCase() !== "RESET") return;
    setIsWiping(true);
    try {
      const response = await fetch("/api/system/wipe", { method: "POST" });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setWipeMessage(data?.error ?? "Réinitialisation impossible.");
        return;
      }
      setWipeMessage("Base réinitialisée. Comptes admin conservés.");
      setWipeConfirm("");
      await refreshData();
    } catch {
      setWipeMessage("Réinitialisation impossible.");
    } finally {
      setIsWiping(false);
    }
  }

  // Server access
  const [serverInfo, setServerInfo] = useState<ServerAccessInfo | null>(null);
  const [accessMessage, setAccessMessage] = useState("");
  useEffect(() => {
    let ignore = false;
    fetch("/api/server-info", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!ignore) setServerInfo(data as ServerAccessInfo);
      })
      .catch(() => {
        if (!ignore) setAccessMessage("Adresse téléphone indisponible.");
      });
    return () => {
      ignore = true;
    };
  }, []);
  async function copyUrl(url: string) {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setAccessMessage("Lien copié.");
      window.setTimeout(() => setAccessMessage(""), 1800);
    } catch {
      setAccessMessage("Copie impossible.");
    }
  }
  const primaryUrl = serverInfo?.lanUrls[0] ?? serverInfo?.hostUrl ?? "";
  const secondaryUrls = serverInfo
    ? [serverInfo.hostUrl, ...serverInfo.lanUrls]
        .filter((url) => url && url !== primaryUrl)
        .filter((url, index, urls) => urls.indexOf(url) === index)
        .slice(0, 2)
    : [];

  return (
    <PanelShell eyebrow={t("Paramètres")} title={t("Réglages métier")} wide onClose={onClose}>
      <div className="flex flex-col gap-8">
        {/* Theme */}
        <section>
          <Eyebrow>{t("Apparence")}</Eyebrow>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {([
              { mode: "light" as ThemeMode, label: t("Clair"), icon: Sun },
              { mode: "dark" as ThemeMode, label: t("Sombre"), icon: Moon },
            ]).map((option) => {
              const Icon = option.icon;
              const active = themeMode === option.mode;
              return (
                <button
                  key={option.mode}
                  type="button"
                  onClick={() => setThemeMode(option.mode)}
                  className={`flex items-center justify-center gap-2 rounded-[2px] border px-4 py-3 text-[0.7rem] font-semibold uppercase tracking-[0.16em] transition-colors ${
                    active
                      ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--bg)]"
                      : "border-[var(--line)] text-[var(--muted)] hover:border-[var(--ink)]"
                  }`}
                >
                  <Icon size={15} strokeWidth={1.5} />
                  {option.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Server access */}
        <section>
          <Eyebrow>{t("Accès téléphone")}</Eyebrow>
          <div className="card mt-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                {serverStatus === "local" ? (
                  <Wifi size={18} strokeWidth={1.5} />
                ) : (
                  <WifiOff size={18} strokeWidth={1.5} />
                )}
                <span className="text-[0.92rem]">
                  {serverStatus === "local" ? t("Serveur local visible") : t("Serveur hors ligne")}
                </span>
              </div>
              <span className="chip">{serverInfo?.protocol?.toUpperCase() ?? t("LOCAL")}</span>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="tabular flex-1 truncate border-b border-[var(--line-strong)] pb-1 text-[0.82rem]">
                {primaryUrl || t("Adresse réseau en attente")}
              </span>
              <button
                type="button"
                className="btn btn-line btn-sm"
                disabled={!primaryUrl}
                onClick={() => void copyUrl(primaryUrl)}
              >
                <Copy size={13} strokeWidth={1.5} />
                {t("Copier")}
              </button>
            </div>
            <p className="mt-3 text-[0.74rem] leading-relaxed text-[var(--muted)]">
              {serverInfo?.isHttps
                ? t("Caméra téléphone autorisée. Le scan peut utiliser USB, caméra ou saisie manuelle.")
                : t("En HTTP sur téléphone, la caméra peut être bloquée. USB et saisie manuelle restent disponibles.")}
            </p>
            {secondaryUrls.length > 0 ? (
              <div className="mt-3 flex flex-col gap-1.5">
                {secondaryUrls.map((url) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => void copyUrl(url)}
                    className="flex items-center gap-2 text-left text-[0.76rem] text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]"
                  >
                    <ShieldCheck size={13} strokeWidth={1.5} />
                    <span className="tabular truncate">{url}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {accessMessage ? (
              <p className="mt-2 text-[0.74rem] text-[var(--muted)]">{t(accessMessage)}</p>
            ) : null}
          </div>
        </section>

        {/* Metrics */}
        <section className="grid grid-cols-3 gap-px overflow-hidden rounded-[3px] border border-[var(--line)] bg-[var(--line)]">
          {[
            { label: t("Serveur"), value: serverStatus === "local" ? t("Actif") : t("Hors ligne") },
            { label: "FEFO", value: `${fefoCount} ${t("catégories")}` },
            { label: t("Multi-lots"), value: `${multiLotCount} ${t("catégorie")}` },
          ].map((metric) => (
            <div key={metric.label} className="bg-[var(--bg-2)] px-4 py-4">
              <div className="text-[0.58rem] uppercase tracking-[0.16em] text-[var(--muted)]">
                {metric.label}
              </div>
              <div className="mt-1 text-[0.86rem]">{metric.value}</div>
            </div>
          ))}
        </section>

        {/* Suppliers */}
        {canManageSuppliers ? (
          <section>
            <Eyebrow>{t("Carnet économat")}</Eyebrow>
            <div className="mt-3">
              <SupplierManager
                suppliers={suppliers}
                isSyncing={isSyncing}
                onCreate={createSupplier}
                onUpdate={updateSupplier}
              />
            </div>
          </section>
        ) : null}

        {/* Backup */}
        {canBackup ? (
          <section>
            <Eyebrow>{t("Sauvegarde locale")}</Eyebrow>
            <div className="mt-3 flex flex-col gap-2">
              <button type="button" className="btn btn-line btn-sm" disabled={isSyncing} onClick={() => void handleExportBackup()}>
                <Download size={14} strokeWidth={1.5} />
                {t("Exporter")}
              </button>
              <button type="button" className="btn btn-line btn-sm" disabled={isSyncing} onClick={() => backupRef.current?.click()}>
                <Upload size={14} strokeWidth={1.5} />
                {t("Restaurer")}
              </button>
              <input
                ref={backupRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => void handleImportBackup(e.target.files?.[0])}
              />
              <p className="text-[0.74rem] leading-relaxed text-[var(--muted)]">
                {t("La restauration remplace les produits, lots, utilisateurs, livraisons et mouvements par ceux du fichier choisi.")}
              </p>
              {backupMessage ? (
                <p className="text-[0.78rem] text-[var(--ink-soft)]">{t(backupMessage)}</p>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* Branding */}
        {isAdmin ? (
          <section>
            <Eyebrow>{t("Identité")}</Eyebrow>
            <p className="mt-2 text-[0.74rem] leading-relaxed text-[var(--muted)]">
              {t("Ce nom s'affiche sur l'écran de connexion, la barre supérieure et les étiquettes. Laissez-le par défaut ou personnalisez-le.")}
            </p>
            <div className="mt-3 flex gap-2">
              <TextInput
                value={restaurantName}
                maxLength={120}
                placeholder={branding.defaultName}
                onChange={(e) => setRestaurantName(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={isSyncing || !restaurantName.trim() || restaurantName.trim() === branding.name}
                onClick={() => void handleSaveBranding()}
              >
                <Save size={14} strokeWidth={1.5} />
                {t("Enregistrer")}
              </button>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm mt-2"
              disabled={!branding.isCustom}
              onClick={() => void handleRestoreBranding()}
            >
              <RefreshCw size={13} strokeWidth={1.5} />
              {`${t("Restaurer le nom par défaut")} (${branding.defaultName})`}
            </button>
            {brandingMessage ? (
              <p className="mt-2 text-[0.78rem] text-[var(--ink-soft)]">{t(brandingMessage)}</p>
            ) : null}
          </section>
        ) : null}

        {/* Danger zone: reset database (keeps admin accounts) */}
        {isAdmin ? (
          <section>
            <Eyebrow>{t("Zone sensible")}</Eyebrow>
            <div className="card mt-3 border-[var(--critical)] p-4">
              <h3 className="text-[0.95rem] text-[var(--critical)]">
                {t("Réinitialiser la base")}
              </h3>
              <p className="mt-2 text-[0.74rem] leading-relaxed text-[var(--muted)]">
                {t("Supprime tous les produits, lots, mouvements, livraisons, catégories, fournisseurs et alertes, ainsi que les comptes non-admin. Les comptes administrateurs sont conservés. Action irréversible.")}
              </p>
              <div className="mt-3 flex gap-2">
                <TextInput
                  value={wipeConfirm}
                  placeholder={`${t("Tapez")} RESET ${t("pour confirmer")}`}
                  onChange={(e) => setWipeConfirm(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={isWiping || wipeConfirm.trim().toUpperCase() !== "RESET"}
                  onClick={() => void handleWipe()}
                >
                  <Trash2 size={14} strokeWidth={1.5} />
                  {t("Réinitialiser")}
                </button>
              </div>
              {wipeMessage ? (
                <p className="mt-2 text-[0.78rem] text-[var(--ink-soft)]">{t(wipeMessage)}</p>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* Category creator */}
        {canManageCategories ? (
          <section>
            <Eyebrow>{t("Nouvelle catégorie")}</Eyebrow>
            <div className="mt-3 flex gap-2">
              <TextInput
                value={newCategoryName}
                placeholder={t("Nom de la catégorie")}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={isSyncing || !newCategoryName.trim()}
                onClick={() => void handleCreateCategory()}
              >
                <Plus size={14} strokeWidth={1.5} />
                {t("Ajouter")}
              </button>
            </div>
            {categoryMessage ? (
              <p className="mt-2 text-[0.78rem] text-[var(--ink-soft)]">{t(categoryMessage)}</p>
            ) : null}
          </section>
        ) : null}

        {/* Category settings */}
        {selectedCategory ? (
          <section>
            <Eyebrow>{t("Catégorie active")}</Eyebrow>
            <div className="mt-3 flex flex-wrap gap-2">
              {editableCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(category.id)}
                  className={`chip transition-colors ${
                    category.id === selectedCategory.id
                      ? "chip--active"
                      : "hover:border-[var(--ink)]"
                  }`}
                >
                  {t(category.name)}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <CategorySettingsCard key={selectedCategory.id} category={selectedCategory} />
            </div>
          </section>
        ) : null}
      </div>
    </PanelShell>
  );
}

function SupplierManager({
  suppliers,
  isSyncing,
  onCreate,
  onUpdate,
}: {
  suppliers: Supplier[];
  isSyncing: boolean;
  onCreate: ReturnType<typeof useAppData>["createSupplier"];
  onUpdate: ReturnType<typeof useAppData>["updateSupplier"];
}) {
  const { t } = useI18n();
  const sorted = useMemo(
    () =>
      [...suppliers].sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        return a.name.localeCompare(b.name, "fr");
      }),
    [suppliers],
  );
  const [selectedId, setSelectedId] = useState(sorted[0]?.id ?? "new");
  const selected = sorted.find((s) => s.id === selectedId) ?? null;
  const isCreating = selectedId === "new";
  const [name, setName] = useState(selected?.name ?? "");
  const [contact, setContact] = useState(selected?.contact ?? "");
  const [email, setEmail] = useState(selected?.email ?? "");
  const [phone, setPhone] = useState(selected?.phone ?? "");
  const [message, setMessage] = useState("");

  function startNew() {
    setSelectedId("new");
    setName("");
    setContact("");
    setEmail("");
    setPhone("");
    setMessage("");
  }
  function select(supplier: Supplier) {
    setSelectedId(supplier.id);
    setName(supplier.name);
    setContact(supplier.contact ?? "");
    setEmail(supplier.email ?? "");
    setPhone(supplier.phone ?? "");
    setMessage("");
  }
  async function save() {
    setMessage("");
    try {
      if (isCreating) {
        const supplier = await onCreate({ contact, email, name, phone });
        if (supplier?.id) select(supplier);
        setMessage(`${supplier?.name ?? name} ${t("ajouté.")}`);
        return;
      }
      if (!selected) return;
      const supplier = await onUpdate({ contact, email, name, phone, supplierId: selected.id });
      if (supplier) select(supplier);
      setMessage(`${supplier?.name ?? name} ${t("mis à jour.")}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("Fournisseur non enregistré."));
    }
  }
  async function toggleActive() {
    if (!selected) return;
    const supplier = await onUpdate({ active: !selected.active, supplierId: selected.id });
    setMessage(supplier?.active ? `${supplier.name} ${t("réactivé.")}` : `${supplier?.name ?? selected.name} ${t("désactivé.")}`);
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[200px_1fr]">
      <div className="flex max-h-[260px] flex-col gap-1.5 overflow-y-auto">
        <button
          type="button"
          onClick={startNew}
          className={`flex items-center gap-2 border px-3 py-2.5 text-left text-[0.8rem] transition-colors ${
            isCreating ? "border-[var(--ink)] bg-[var(--bg-2)]" : "border-[var(--line)] hover:border-[var(--ink)]"
          }`}
        >
          <Plus size={14} strokeWidth={1.5} />
          {t("Nouveau fournisseur")}
        </button>
        {sorted.map((supplier) => (
          <button
            key={supplier.id}
            type="button"
            onClick={() => select(supplier)}
            className={`flex items-center justify-between gap-2 border px-3 py-2.5 text-left transition-colors ${
              selectedId === supplier.id ? "border-[var(--ink)] bg-[var(--bg-2)]" : "border-[var(--line)] hover:border-[var(--ink)]"
            } ${!supplier.active ? "opacity-55" : ""}`}
          >
            <span className="truncate text-[0.82rem]">{supplier.name}</span>
            <span className={`h-2 w-2 shrink-0 rounded-full ${supplier.active ? "bg-[var(--stable)]" : "bg-[var(--faint)]"}`} />
          </button>
        ))}
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="display text-lg">
            {isCreating ? t("Nouveau fournisseur") : selected?.name}
          </span>
          {!isCreating && selected ? (
            <button type="button" className={`btn btn-sm ${selected.active ? "btn-danger" : "btn-line"}`} disabled={isSyncing} onClick={() => void toggleActive()}>
              {selected.active ? t("Désactiver") : t("Réactiver")}
            </button>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label={t("Nom")}><TextInput value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label={t("Contact")}><TextInput value={contact} onChange={(e) => setContact(e.target.value)} /></Field>
          <Field label={t("Email")}><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label={t("Téléphone")}><TextInput value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-[0.74rem] text-[var(--muted)]">
            {message ? t(message) : t("Ces informations alimentent la livraison et l'historique.")}
          </span>
          <button type="button" className="btn btn-primary btn-sm" disabled={isSyncing || !name.trim()} onClick={() => void save()}>
            <Save size={14} strokeWidth={1.5} />
            {isCreating ? t("Créer") : t("Enregistrer")}
          </button>
        </div>
      </div>
    </div>
  );
}

function CategorySettingsCard({ category }: { category: Category }) {
  const { t } = useI18n();
  const { isSyncing, updateCategorySettings } = useAppData();
  const [mode, setMode] = useState<CategoryMode>(category.mode);
  const [defaultThreshold, setDefaultThreshold] = useState(String(category.defaultThreshold));
  const [criticalThreshold, setCriticalThreshold] = useState(String(category.criticalThreshold));
  const [soonExpiresDays, setSoonExpiresDays] = useState(String(category.soonExpiresDays));
  const [autoExpirationDays, setAutoExpirationDays] = useState(String(category.autoExpirationDays ?? 0));
  const [switchThreshold, setSwitchThreshold] = useState(String(category.switchThreshold ?? 3));
  const [feedback, setFeedback] = useState("");

  const showAutoExpiration =
    category.autoExpirationDays !== undefined || category.id === "viande" || category.id === "poisson";
  const showSwitchThreshold = mode === "Multi-lots";

  const patch: CategorySettingsPatch = {
    criticalThreshold: parseRuleNumber(criticalThreshold),
    defaultThreshold: parseRuleNumber(defaultThreshold),
    mode,
    soonExpiresDays: parseRuleNumber(soonExpiresDays),
  };
  if (showAutoExpiration) patch.autoExpirationDays = parseRuleNumber(autoExpirationDays);
  if (showSwitchThreshold) patch.switchThreshold = parseRuleNumber(switchThreshold);

  const hasChanged =
    patch.mode !== category.mode ||
    patch.defaultThreshold !== category.defaultThreshold ||
    patch.criticalThreshold !== category.criticalThreshold ||
    patch.soonExpiresDays !== category.soonExpiresDays ||
    (showAutoExpiration && patch.autoExpirationDays !== (category.autoExpirationDays ?? 0)) ||
    (showSwitchThreshold && patch.switchThreshold !== (category.switchThreshold ?? 3));

  async function save() {
    setFeedback("");
    try {
      await updateCategorySettings({ categoryId: category.id, patch });
      setFeedback("Règle enregistrée.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : t("Réglage impossible."));
    }
  }

  return (
    <form
      className="card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (hasChanged) void save();
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="display text-xl">{t(category.name)}</span>
        <span className="eyebrow">{t(getCategoryRuleLabel(category))}</span>
      </div>

      <div className="mt-4">
        <span className="field-label">{t("Mode de gestion")}</span>
        <div className="grid grid-cols-3 gap-2">
          {categoryModeOptions.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`rounded-[2px] border px-2 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.12em] transition-colors ${
                mode === value
                  ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--bg)]"
                  : "border-[var(--line)] text-[var(--muted)] hover:border-[var(--ink)]"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label={t("Seuil catégorie")}>
          <TextInput type="number" min="0" value={defaultThreshold} onChange={(e) => setDefaultThreshold(e.target.value)} />
        </Field>
        <Field label={t("Niveau critique")}>
          <TextInput type="number" min="0" value={criticalThreshold} onChange={(e) => setCriticalThreshold(e.target.value)} />
        </Field>
        <Field label={t("Expire bientôt")} hint="j">
          <TextInput type="number" min="0" value={soonExpiresDays} onChange={(e) => setSoonExpiresDays(e.target.value)} />
        </Field>
        {showAutoExpiration ? (
          <Field label={t("Expiration auto")} hint="J+">
            <TextInput type="number" min="0" value={autoExpirationDays} onChange={(e) => setAutoExpirationDays(e.target.value)} />
          </Field>
        ) : (
          <div className="self-end text-[0.72rem] text-[var(--muted)]">
            {t("Expiration saisie en livraison.")}
          </div>
        )}
        {showSwitchThreshold ? (
          <Field label={t("Seuil de bascule")}>
            <TextInput type="number" min="0" value={switchThreshold} onChange={(e) => setSwitchThreshold(e.target.value)} />
          </Field>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-[0.74rem] text-[var(--muted)]">
          {feedback ? t(feedback) : hasChanged ? t("Modifications non enregistrées.") : t("À jour.")}
        </span>
        <button type="submit" className="btn btn-primary btn-sm" disabled={!hasChanged || isSyncing}>
          <Save size={14} strokeWidth={1.5} />
          {t("Enregistrer")}
        </button>
      </div>
    </form>
  );
}
