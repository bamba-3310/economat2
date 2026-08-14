/**
 * Date / time / service-label formatting helpers, shared by the redesigned
 * components. Extracted from page.tsx during the component refactor. Locale-aware
 * (fr-FR / en-GB) via the i18n active language.
 */
import { activeLocale } from "@/lib/i18n";

/** Today as a YYYY-MM-DD string in the user's local timezone. */
export function getTodayInputDate() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

/** Time-of-day service word (French canonical): Matin / Midi / Soir / Nuit. */
export function getServiceLabel(date = new Date()) {
  const hour = date.getHours();
  if (hour < 11) return "Matin";
  if (hour < 16) return "Midi";
  if (hour < 21) return "Soir";
  return "Nuit";
}

export function addDaysToInputDate(date: string, days: number) {
  const baseDate = date ? new Date(`${date}T00:00:00`) : new Date();
  baseDate.setDate(baseDate.getDate() + days);
  return baseDate.toISOString().slice(0, 10);
}

/** `dd MMM yyyy`, localized; invalid/empty -> "—". */
export function formatDate(value: string) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(activeLocale(), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** `dd MMM, HH:mm`, localized; invalid/empty -> "—". */
export function formatDateTime(value: string) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(activeLocale(), {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(date);
}

/* ---------- delivery / lot helpers ---------- */

export function normalizeSearchValue(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function getDeliveryDateCode(date: string) {
  return date ? date.replaceAll("-", "").slice(2) : "000000";
}

function getProductCode(productName: string) {
  const normalized = normalizeSearchValue(productName)
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
  const parts = normalized.split(/\s+/).filter(Boolean);
  const code =
    parts.length > 1
      ? parts.map((part) => part[0]).join("").slice(0, 3)
      : parts[0]?.slice(0, 3);
  return (code || "LOT").toUpperCase();
}

/** Stable lot code: `LC-<PROD>`.
 *
 * We keep the reference stable across re-entries for the same product so the
 * printed QR remains permanent and can be reused for scans (parity with
 * EconomatProject behavior).
 */
export function createSuggestedLotCode({
  deliveredAt,
  lineId,
  productName,
}: {
  deliveredAt?: string;
  lineId?: number;
  productName: string;
}) {
  const base = `LC-${getProductCode(productName)}`;
  return base;
}

export function escapeCsvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function downloadTextFile({
  content,
  fileName,
  type,
}: {
  content: string;
  fileName: string;
  type: string;
}) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
