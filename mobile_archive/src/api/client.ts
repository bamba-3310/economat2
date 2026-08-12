import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const SERVER_URL_KEY = "economat.serverUrl";
const ACCESS_TOKEN_KEY = "economat.access";
const REFRESH_TOKEN_KEY = "economat.refresh";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let cachedServerUrl: string | null = null;

export async function getServerUrl(): Promise<string | null> {
  if (cachedServerUrl) return cachedServerUrl;
  cachedServerUrl = await AsyncStorage.getItem(SERVER_URL_KEY);
  return cachedServerUrl;
}

export async function setServerUrl(url: string) {
  cachedServerUrl = url.replace(/\/+$/, "");
  await AsyncStorage.setItem(SERVER_URL_KEY, cachedServerUrl);
}

export async function getTokens() {
  const [access, refresh] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  ]);
  return { access, refresh };
}

export async function setTokens(access: string, refresh?: string) {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access);
  if (refresh) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh);
}

export async function clearTokens() {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}

// The session provider registers a handler so an irrecoverable 401
// (refresh token expired or session taken over elsewhere) sends the
// user back to the login screen from anywhere in the app.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

async function refreshAccessToken(): Promise<string | null> {
  const base = await getServerUrl();
  const { refresh } = await getTokens();
  if (!base || !refresh) return null;
  try {
    const response = await fetch(`${base}/api/accounts/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { access?: string };
    if (!data.access) return null;
    await setTokens(data.access);
    return data.access;
  } catch {
    return null;
  }
}

async function parseErrorDetail(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as Record<string, unknown>;
    if (typeof data.detail === "string") return data.detail;
    // DRF validation errors: {"field": ["message", ...]}
    const first = Object.values(data)[0];
    if (Array.isArray(first) && typeof first[0] === "string") return first[0];
  } catch {
    // non-JSON body
  }
  return `HTTP ${response.status}`;
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
  options: { auth?: boolean } = {},
): Promise<T> {
  const { auth = true } = options;
  const base = await getServerUrl();
  if (!base) throw new ApiError(0, "Serveur non configuré");

  const doFetch = async (token: string | null) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    };
    if (auth && token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${base}${path}`, { ...init, headers });
  };

  const { access } = await getTokens();
  let response: Response;
  try {
    response = await doFetch(access);
  } catch {
    throw new ApiError(0, "Serveur injoignable");
  }

  if (response.status === 401 && auth) {
    const renewed = await refreshAccessToken();
    if (!renewed) {
      await clearTokens();
      onUnauthorized?.();
      throw new ApiError(401, "Session expirée");
    }
    response = await doFetch(renewed);
    if (response.status === 401) {
      await clearTokens();
      onUnauthorized?.();
      throw new ApiError(401, "Session expirée");
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorDetail(response));
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
