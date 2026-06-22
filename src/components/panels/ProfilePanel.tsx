"use client";

import { useRef, useState, type FormEvent } from "react";
import { Check, ImagePlus, KeyRound, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAppData } from "@/lib/app-data";
import type { Permission } from "@/types/domain";
import { Eyebrow, Field, TextInput, UserAvatar } from "@/components/ui/kit";
import PanelShell from "@/components/panels/PanelShell";

const permissionLabels: Record<Permission, string> = {
  manage_users: "Gérer utilisateurs",
  approve_accounts: "Approuver comptes",
  edit_stock: "Modifier stock",
  edit_lots: "Modifier lots",
  edit_thresholds: "Modifier seuils",
  edit_expiration_dates: "Modifier expirations",
  validate_deliveries: "Valider livraisons",
  activate_lot: "Activer lot",
  view_all_alerts: "Voir alertes",
  manage_categories: "Gérer catégories",
};

export default function ProfilePanel({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { changePassword, currentUser, isSyncing, logout, updateUserProfile } = useAppData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [posX, setPosX] = useState(50);
  const [posY, setPosY] = useState(50);

  if (!currentUser) return null;
  const user = currentUser;
  const isAdmin = user.role === "Admin";
  const activePermissions = user.permissions.filter((id) => id in permissionLabels);

  function pickPhoto(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") return;
      setCropSource(reader.result);
      setZoom(1);
      setPosX(50);
      setPosY(50);
    });
    reader.readAsDataURL(file);
  }

  async function saveCroppedPhoto() {
    if (!cropSource) return;
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener("error", () => reject(new Error("Image illisible.")), { once: true });
      image.src = cropSource;
    });
    const size = 512;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = size;
    canvas.height = size;
    const coverScale =
      Math.max(size / image.naturalWidth, size / image.naturalHeight) * zoom;
    const renderedWidth = image.naturalWidth * coverScale;
    const renderedHeight = image.naturalHeight * coverScale;
    const left = (size - renderedWidth) * (posX / 100);
    const top = (size - renderedHeight) * (posY / 100);
    ctx.fillStyle = "#f7f5f0";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(image, left, top, renderedWidth, renderedHeight);
    await updateUserProfile({
      patch: { photoUrl: canvas.toDataURL("image/jpeg", 0.92) },
      userId: user.id,
    });
    setCropSource(null);
  }

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    const result = await changePassword({ currentPassword, newPassword, userId: user.id });
    setPasswordMessage(result.message);
    if (result.ok) {
      setCurrentPassword("");
      setNewPassword("");
    }
  }

  return (
    <PanelShell eyebrow={t("Profil")} title={user.name} onClose={onClose}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pickPhoto(e.target.files?.[0])}
      />

      <div className="flex items-center gap-4">
        <UserAvatar user={user} className="h-16 w-16 text-lg" />
        <div className="min-w-0">
          <p className="truncate text-[0.95rem]">{user.email}</p>
          <p className="text-[0.72rem] uppercase tracking-[0.16em] text-[var(--muted)]">
            {t(user.role)} · {t(user.status)}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          className="btn btn-line btn-sm"
          disabled={isSyncing}
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus size={14} strokeWidth={1.5} />
          {t("Changer photo")}
        </button>
        <button
          type="button"
          className="btn btn-line btn-sm"
          disabled={isSyncing || !user.photoUrl}
          onClick={() => void updateUserProfile({ patch: { photoUrl: null }, userId: user.id })}
        >
          <Trash2 size={14} strokeWidth={1.5} />
          {t("Supprimer")}
        </button>
      </div>

      {cropSource ? (
        <div className="card mt-3 p-4">
          <Eyebrow>{t("Rogner la photo")}</Eyebrow>
          <div className="mt-3 grid gap-4 sm:grid-cols-[120px_1fr]">
            <div className="relative h-[120px] w-[120px] overflow-hidden rounded-[3px] border border-[var(--line)]">
              <span
                aria-label={t("Aperçu photo")}
                role="img"
                className="absolute inset-0 bg-cover"
                style={{
                  backgroundImage: `url(${cropSource})`,
                  backgroundPosition: `${posX}% ${posY}%`,
                  transform: `scale(${zoom})`,
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-3 text-[0.7rem] uppercase tracking-[0.14em] text-[var(--muted)]">
                <span className="w-20">{t("Zoom")}</span>
                <input type="range" min="1" max="2.2" step="0.01" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1" />
              </label>
              <label className="flex items-center gap-3 text-[0.7rem] uppercase tracking-[0.14em] text-[var(--muted)]">
                <span className="w-20">{t("Horizontal")}</span>
                <input type="range" min="0" max="100" value={posX} onChange={(e) => setPosX(Number(e.target.value))} className="flex-1" />
              </label>
              <label className="flex items-center gap-3 text-[0.7rem] uppercase tracking-[0.14em] text-[var(--muted)]">
                <span className="w-20">{t("Vertical")}</span>
                <input type="range" min="0" max="100" value={posY} onChange={(e) => setPosY(Number(e.target.value))} className="flex-1" />
              </label>
              <div className="mt-1 flex gap-2">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCropSource(null)}>
                  {t("Annuler")}
                </button>
                <button type="button" className="btn btn-primary btn-sm" disabled={isSyncing} onClick={() => void saveCroppedPhoto()}>
                  {t("Valider")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-[2px] border border-[var(--line)] bg-[var(--line)]">
        {[
          { label: t("Rôle"), value: t(user.role) },
          { label: t("Statut"), value: t(user.status) },
          { label: t("Droits"), value: String(user.permissions.length) },
        ].map((stat) => (
          <div key={stat.label} className="bg-[var(--bg-2)] px-4 py-3">
            <div className="text-[0.58rem] uppercase tracking-[0.16em] text-[var(--muted)]">
              {stat.label}
            </div>
            <div className="mt-1 text-[0.86rem]">{stat.value}</div>
          </div>
        ))}
      </div>

      <form onSubmit={submitPassword} className="card mt-5 p-4">
        <Eyebrow>{t("Mot de passe")}</Eyebrow>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label={t("Actuel")}>
            <TextInput
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          <Field label={t("Nouveau")}>
            <TextInput
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="truncate text-[0.74rem] text-[var(--muted)]">{t(passwordMessage)}</span>
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={isSyncing || !currentPassword || !newPassword}
          >
            <KeyRound size={14} strokeWidth={1.5} />
            {t("Modifier")}
          </button>
        </div>
      </form>

      {!isAdmin && activePermissions.length > 0 ? (
        <div className="card mt-3 p-4">
          <Eyebrow>{t("Droits actifs")}</Eyebrow>
          <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {activePermissions.map((id) => (
              <div
                key={id}
                className="flex items-center gap-2 border border-[var(--line)] px-3 py-2 text-[0.72rem] text-[var(--ink-soft)]"
              >
                <Check size={13} strokeWidth={1.5} />
                <span className="truncate">{t(permissionLabels[id])}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="btn btn-danger btn-block mt-5"
        onClick={() => logout()}
      >
        {t("Déconnexion")}
      </button>
    </PanelShell>
  );
}
