import { api, setServerUrl, setTokens } from "./client";
import type {
  Article,
  Batch,
  Branding,
  Category,
  LoginResponse,
  Movement,
  MovementType,
  User,
} from "./types";

export async function login(serverUrl: string, email: string, password: string) {
  await setServerUrl(serverUrl);
  const data = await api<LoginResponse>(
    "/api/accounts/login/",
    { method: "POST", body: JSON.stringify({ email, password }) },
    { auth: false },
  );
  await setTokens(data.access, data.refresh);
  return data.user;
}

export const fetchMe = () => api<User>("/api/accounts/me/");

// Frees the server-side single-session lock immediately (same behaviour as the
// web app) instead of leaving it to expire through the idle timeout.
export const logout = () => api<{ detail?: string }>("/api/accounts/logout/", { method: "POST" });
export const fetchArticles = () => api<Article[]>("/api/articles/");
export const fetchBatches = () => api<Batch[]>("/api/batches/");
export const fetchCategories = () => api<Category[]>("/api/categories/");
export const fetchBranding = () => api<Branding>("/api/system/branding/");

export const fetchMovements = (articleId?: number) =>
  api<Movement[]>(`/api/movements/${articleId ? `?article=${articleId}` : ""}`);

export const createMovement = (input: {
  article: number;
  batch: number | null;
  type: MovementType;
  quantity: number;
  motive: string;
}) => api<Movement>("/api/movements/", { method: "POST", body: JSON.stringify(input) });

export const patchBatch = (id: number, patch: Partial<Batch>) =>
  api<Batch>(`/api/batches/${id}/`, { method: "PATCH", body: JSON.stringify(patch) });

// Same write protocol as the web frontend (src/server/stock-service.ts).
// WHEN/WHY: these used to be two calls (movement + a batch PATCH computed from
// a stale read), which raced against other scanners and could leave article
// stock and batch quantity out of sync. Django's movement endpoint now applies
// the batch side-effect (status flip / quantity decrement) in the same DB
// transaction, so a single POST does it all.
export function activateLot(batch: Batch) {
  return createMovement({
    article: batch.article,
    batch: batch.id,
    type: "activation",
    quantity: batch.quantity || 1,
    motive: "Lot activé par scan (mobile)",
  });
}

export function exitLot(batch: Batch, quantity: number) {
  return createMovement({
    article: batch.article,
    batch: batch.id,
    type: "kitchen_exit",
    quantity,
    motive: "Sortie enregistrée par scan (mobile)",
  });
}
