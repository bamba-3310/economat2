"use client";

import { useEffect, useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAppData } from "@/lib/app-data";
import type { AppUser, Permission, Role } from "@/types/domain";
import { Eyebrow, Select, UserAvatar } from "@/components/ui/kit";
import PanelShell from "@/components/panels/PanelShell";

const roleOptions: Role[] = ["Admin", "Gestionnaire", "Agent"];
const permissionOptions: Array<{ id: Permission; label: string }> = [
  { id: "manage_users", label: "Gérer utilisateurs" },
  { id: "approve_accounts", label: "Approuver comptes" },
  { id: "edit_stock", label: "Modifier stock" },
  { id: "edit_lots", label: "Modifier lots" },
  { id: "edit_thresholds", label: "Modifier seuils" },
  { id: "edit_expiration_dates", label: "Modifier expirations" },
  { id: "validate_deliveries", label: "Valider livraisons" },
  { id: "activate_lot", label: "Activer lot" },
  { id: "view_all_alerts", label: "Voir alertes" },
  { id: "manage_categories", label: "Gérer catégories" },
];

const statusChipClass: Record<string, string> = {
  Actif: "status-Stable",
  "En attente": "status-low",
};

export default function UsersPanel({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const {
    currentUser,
    deleteUser,
    isSyncing,
    refreshData,
    updateUserProfile,
    updateUserStatus,
    users,
  } = useAppData();
  const currentIsAdmin = currentUser?.role === "Admin";
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  // Refresh on open so newly requested (pending) accounts appear.
  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  async function runStatus(
    action: "approve" | "refuse" | "disable" | "reactivate",
    userId: string,
  ) {
    setMessage("");
    const result = await updateUserStatus({ action, userId });
    if (!result.ok && result.message) setMessage(result.message);
  }

  async function runDelete(user: AppUser) {
    if (!window.confirm(`${t("Supprimer définitivement le compte de")} ${user.name} ?`)) return;
    setMessage("");
    const result = await deleteUser({ userId: user.id });
    if (!result.ok && result.message) setMessage(result.message);
  }

  return (
    <PanelShell
      eyebrow={t("Utilisateurs")}
      title={t("Accès et permissions")}
      meta={`${users.length} ${t("Comptes")}`}
      wide
      onClose={onClose}
    >
      {message ? (
        <p className="mb-3 border border-[var(--critical)] px-3 py-2 text-[0.8rem] text-[var(--critical)]">
          {t(message)}
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {users.map((user) => {
          const isExpanded = expandedUserId === user.id;
          const isAdmin = user.role === "Admin";
          return (
            <li key={user.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <UserAvatar user={user} className="h-10 w-10 text-xs" />
                  <div className="min-w-0">
                    <p className="truncate text-[0.92rem]">{user.name}</p>
                    <p className="truncate text-[0.74rem] text-[var(--muted)]">{user.email}</p>
                  </div>
                </div>
                <span className={`chip ${statusChipClass[user.status] ?? ""}`}>
                  {t(user.status)}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-[0.74rem] text-[var(--muted)]">
                  {t(user.role)} · {user.permissions.length} {t("droits")}
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-line btn-sm"
                    onClick={() =>
                      setExpandedUserId((value) => (value === user.id ? null : user.id))
                    }
                  >
                    {isExpanded ? t("Fermer") : t("Droits")}
                  </button>
                  {user.status === "En attente" ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={isSyncing}
                        onClick={() => void runStatus("approve", user.id)}
                      >
                        {t("Approuver")}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={isSyncing}
                        onClick={() => void runStatus("refuse", user.id)}
                      >
                        {t("Refuser")}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-line btn-sm"
                      disabled={isSyncing || isAdmin}
                      onClick={() =>
                        void runStatus(
                          user.status === "Désactivé" ? "reactivate" : "disable",
                          user.id,
                        )
                      }
                    >
                      {user.status === "Désactivé" ? t("Réactiver") : t("Désactiver")}
                    </button>
                  )}
                  {currentIsAdmin && user.id !== currentUser?.id ? (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      disabled={isSyncing}
                      onClick={() => void runDelete(user)}
                    >
                      <Trash2 size={13} strokeWidth={1.5} />
                      {t("Supprimer")}
                    </button>
                  ) : null}
                </div>
              </div>

              {isExpanded ? (
                <div className="mt-3 border-t border-[var(--line)] pt-3">
                  <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                    <label className="block">
                      <span className="field-label">{t("Rôle")}</span>
                      <Select
                        value={user.role}
                        disabled={isSyncing || isAdmin}
                        onChange={(e) =>
                          void updateUserProfile({
                            patch: { role: e.target.value as Role },
                            userId: user.id,
                          })
                        }
                      >
                        {roleOptions.map((role) => (
                          <option key={role} value={role}>
                            {t(role)}
                          </option>
                        ))}
                      </Select>
                    </label>
                    <div>
                      <span className="field-label">{t("Permissions personnalisées")}</span>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {permissionOptions.map((permission) => {
                          const enabled = user.permissions.includes(permission.id);
                          return (
                            <button
                              key={permission.id}
                              type="button"
                              disabled={isSyncing || isAdmin}
                              onClick={() => {
                                const permissions = enabled
                                  ? user.permissions.filter((item) => item !== permission.id)
                                  : [...user.permissions, permission.id];
                                void updateUserProfile({ patch: { permissions }, userId: user.id });
                              }}
                              className={`flex h-9 items-center justify-between gap-2 rounded-[2px] border px-3 text-left text-[0.7rem] transition-colors ${
                                enabled
                                  ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--bg)]"
                                  : "border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--ink)]"
                              }`}
                            >
                              <span className="truncate">{t(permission.label)}</span>
                              {enabled ? <Check size={13} strokeWidth={1.5} /> : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  {isAdmin ? (
                    <p className="mt-2 text-[0.72rem] text-[var(--muted)]">
                      {t("L’admin conserve l’accès complet par défaut.")}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </PanelShell>
  );
}
