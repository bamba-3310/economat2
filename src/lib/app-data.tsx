"use client";

/**
 * Shared application data context.
 *
 * WHY/WHEN: extracted from the monolithic `src/app/page.tsx` during the
 * component refactor + redesign. The PROVIDER (all the API calls, session
 * handling, theme) still lives in `Home` (page.tsx) for now and renders
 * `<AppDataContext.Provider>`; this module owns the context object, the
 * `useAppData()` hook, and every app-level type the UI components consume so
 * they can be split into their own files.
 *
 * The real data layer is unchanged: the app starts empty and fills from the
 * Django/PostgreSQL API via the Next.js adapter routes under `src/app/api/*`.
 */

import { createContext, useContext } from "react";
import type {
  Activity,
  Alert,
  AppUser,
  Category,
  CategoryMode,
  Delivery,
  Lot,
  LotStatus,
  Permission,
  Product,
  StockMovement,
  StockStatus,
  Supplier,
} from "@/types/domain";

export type Section = "dashboard" | "livraison" | "stock" | "scan";
export type TopPanel = "alerts" | "users" | "settings" | "profile" | null;

export type StockStatusFilterValue = StockStatus | "all";
export type StockSortMode = "priority" | "name" | "quantity";

export type DeliveryLine = {
  categoryId: string;
  threshold: string;
  id: number;
  product: string;
  quantity: string;
  unit: string;
  lot: string;
  expiration: string;
};

export type DeliveryDraft = {
  deliveredAt: string;
  reference: string;
  supplier: string;
};

export type DeliveryValidationResult = {
  count: number;
  delivery: Delivery;
};

export type StockCorrectionInput = {
  expirationDate?: string;
  lotId?: string;
  productId: string;
  remainingQuantity?: number;
  status?: LotStatus;
  threshold?: number;
};

export type ServerStatus = "local" | "offline";
export type ThemeMode = "light" | "dark";

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterInput = LoginInput & {
  name: string;
  role: "Agent" | "Gestionnaire";
};

export type AppRuntimeData = {
  operationDate: string;
  categories: Category[];
  products: Product[];
  lots: Lot[];
  alerts: Alert[];
  activities: Activity[];
  deliveries: Delivery[];
  suppliers: Supplier[];
  movements: StockMovement[];
  users: AppUser[];
};

export type CategorySettingsPatch = Partial<
  Pick<
    Category,
    | "autoExpirationDays"
    | "criticalThreshold"
    | "defaultThreshold"
    | "mode"
    | "soonExpiresDays"
    | "switchThreshold"
  >
>;

export type BackupApiResponse = {
  counts: {
    activities: number;
    categories: number;
    deliveries: number;
    lots: number;
    movements: number;
    products: number;
    suppliers: number;
    users: number;
  };
  database?: unknown;
  exportedAt?: string;
  ok?: boolean;
  restoredAt?: string;
};

export type AppDataContextValue = AppRuntimeData & {
  currentUser: AppUser | null;
  // Message shown on the login screen after an automatic logout (e.g. idle).
  authNotice: string | null;
  isSyncing: boolean;
  serverStatus: ServerStatus;
  themeMode: ThemeMode;
  changePassword: (input: {
    currentPassword: string;
    newPassword: string;
    userId: string;
  }) => Promise<{ message: string; ok: boolean }>;
  correctStock: (input: StockCorrectionInput) => Promise<void>;
  exportBackup: () => Promise<BackupApiResponse>;
  importBackup: (file: File) => Promise<BackupApiResponse>;
  login: (input: LoginInput) => Promise<{ message: string; ok: boolean }>;
  logout: (reason?: string) => void;
  registerUser: (input: RegisterInput) => Promise<{ message: string; ok: boolean }>;
  createSupplier: (input: {
    contact?: string;
    email?: string;
    name: string;
    phone?: string;
  }) => Promise<Supplier | undefined>;
  createCategory: (input: {
    name: string;
    mode?: CategoryMode;
    defaultThreshold?: number;
    criticalThreshold?: number;
    soonExpiresDays?: number;
  }) => Promise<Category | undefined>;
  deleteLot: (input: { lotId: string }) => Promise<{ ok: boolean }>;
  deleteProduct: (input: { productId: string }) => Promise<{ ok: boolean; message?: string }>;
  deleteCategory: (input: { categoryId: string }) => Promise<{ ok: boolean; message?: string }>;
  deleteUser: (input: { userId: string }) => Promise<{ ok: boolean; message?: string }>;
  updateSupplier: (input: {
    active?: boolean;
    contact?: string;
    email?: string;
    name?: string;
    phone?: string;
    supplierId: string;
  }) => Promise<Supplier | undefined>;
  setThemeMode: (mode: ThemeMode) => void;
  refreshData: () => Promise<void>;
  recordScanMovement: (input: {
    lotId: string;
    quantity?: number;
    type: "Activation" | "Sortie";
  }) => Promise<void>;
  updateUserStatus: (input: {
    action: "approve" | "refuse" | "disable" | "reactivate";
    userId: string;
  }) => Promise<{ ok: boolean; message?: string }>;
  updateUserProfile: (input: {
    patch: Partial<Pick<AppUser, "email" | "name" | "permissions" | "role">> & {
      photoUrl?: string | null;
    };
    userId: string;
  }) => Promise<void>;
  updateCategorySettings: (input: {
    categoryId: string;
    patch: CategorySettingsPatch;
  }) => Promise<void>;
  validateDelivery: (
    draft: DeliveryDraft,
    lines: DeliveryLine[],
  ) => Promise<DeliveryValidationResult>;
};

export const AppDataContext = createContext<AppDataContextValue | null>(null);

export function useAppData() {
  const value = useContext(AppDataContext);

  if (!value) {
    throw new Error("useAppData must be used within AppDataContext");
  }

  return value;
}

/** True for the current user (Admin always passes) if they hold any of `perms`. */
export function hasClientPermission(
  user: AppUser | null | undefined,
  permissions: Permission[],
) {
  return (
    user?.role === "Admin" ||
    Boolean(user?.permissions.some((permission) => permissions.includes(permission)))
  );
}
