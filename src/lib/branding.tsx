"use client";

/**
 * Configurable restaurant/product name (branding).
 *
 * WHY: the name used to be hard-coded ("Le Carré") all over the UI, so the
 * software couldn't be reused for another restaurant. An admin can now set the
 * name from the settings panel; it is stored server-side and shown everywhere.
 *
 * DEFAULT NAME — single source of truth: the backend
 * (settings.DEFAULT_RESTAURANT_NAME) owns the default and returns it from
 * /api/branding as `defaultName`. DEFAULT_RESTAURANT_NAME below is only the
 * frontend fallback shown before that response arrives (or if the API is
 * unreachable, e.g. the login screen offline). Keep the two in sync.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const DEFAULT_RESTAURANT_NAME = "Cuistock";

type BrandingResult = { ok: boolean; message?: string };

type BrandingValue = {
  name: string;
  defaultName: string;
  isCustom: boolean;
  setName: (name: string) => Promise<BrandingResult>;
  restoreDefault: () => Promise<BrandingResult>;
  refresh: () => Promise<void>;
};

type BrandingPayload = {
  name?: string | null;
  defaultName?: string | null;
  isCustom?: boolean;
  error?: string;
};

const BrandingContext = createContext<BrandingValue | null>(null);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [name, setNameState] = useState(DEFAULT_RESTAURANT_NAME);
  const [defaultName, setDefaultName] = useState(DEFAULT_RESTAURANT_NAME);
  const [isCustom, setIsCustom] = useState(false);

  const apply = useCallback((data: BrandingPayload | null) => {
    if (!data) return;
    if (data.defaultName) setDefaultName(data.defaultName);
    if (data.name) setNameState(data.name);
    setIsCustom(Boolean(data.isCustom));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/branding", { cache: "no-store" });
      if (!res.ok) return;
      apply((await res.json()) as BrandingPayload);
    } catch {
      // Keep the fallback default.
    }
  }, [apply]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Reflect the live name in the browser tab title.
  useEffect(() => {
    if (typeof document !== "undefined" && name) document.title = name;
  }, [name]);

  const patch = useCallback(
    async (body: Record<string, unknown>): Promise<BrandingResult> => {
      try {
        const res = await fetch("/api/branding", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json().catch(() => null)) as BrandingPayload | null;
        if (!res.ok) return { ok: false, message: data?.error };
        apply(data);
        return { ok: true };
      } catch {
        return { ok: false };
      }
    },
    [apply],
  );

  const setName = useCallback((next: string) => patch({ name: next }), [patch]);
  const restoreDefault = useCallback(() => patch({ restore: true }), [patch]);

  const value = useMemo(
    () => ({ name, defaultName, isCustom, setName, restoreDefault, refresh }),
    [name, defaultName, isCustom, setName, restoreDefault, refresh],
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const value = useContext(BrandingContext);
  if (!value) {
    throw new Error("useBranding must be used within a BrandingProvider");
  }
  return value;
}
