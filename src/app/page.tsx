"use client";

import {
  Bell,
  Boxes,
  Camera,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  Copy,
  Database,
  Download,
  Eye,
  FileCheck2,
  Gauge,
  ImagePlus,
  Keyboard,
  KeyRound,
  LayoutDashboard,
  ListFilter,
  LockKeyhole,
  Mail,
  Minus,
  Moon,
  PackageSearch,
  PanelRightClose,
  PanelRightOpen,
  Printer,
  Plus,
  QrCode,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  ScanLine,
  Sun,
  Trash2,
  Truck,
  Usb,
  Upload,
  UserRound,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import jsQR from "jsqr";
import { QRCodeSVG } from "qrcode.react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
// WHEN/WHY: the app no longer seeds itself with mock data. It starts EMPTY and
// fills from the Django/PostgreSQL API on load, so stale mock can never appear
// (the old `@/lib/app-state` mock import was removed during the Django wiring).
import {
  createLotQrValue,
  evaluateLotScan,
  getCategoryRuleLabel,
  getDeliveryExpirationDate,
  getNextExpirationDate,
  getSuggestedScanProducts,
  parseLotQrValue,
} from "@/lib/stock-engine";
// Bilingual (FR/EN) helper. `t(frenchString)` returns the French text in FR
// mode and the English translation in EN mode. `activeLocale()` gives the Intl
// locale for date formatting. Added during the bilingual pass.
import { useI18n, activeLocale } from "@/lib/i18n";
import { useBranding } from "@/lib/branding";
import type {
  Activity,
  Alert,
  AppUser,
  Category,
  CategoryMode,
  Delivery,
  DeliveryLineInput,
  Lot,
  LotStatus,
  Permission,
  Product,
  Role,
  StockMovement,
  StockStatus,
  Supplier,
} from "@/types/domain";
// Shared app-data context + the cross-component permission helper, extracted from
// this file during the component refactor. The PROVIDER still lives in `Home`
// below and renders <AppDataContext.Provider>. The local type aliases kept in
// this file are structurally identical to the ones re-exported there.
import {
  AppDataContext,
  useAppData,
  hasClientPermission,
} from "@/lib/app-data";
import { useCompactMobile } from "@/lib/hooks";
// Redesigned shell components (new monochrome design system).
import LoginView from "@/components/LoginView";
import BottomNav from "@/components/BottomNav";
import RotateGuard from "@/components/RotateGuard";
import Dashboard from "@/components/dashboard/Dashboard";
import StockView from "@/components/stock/StockView";
import DeliveryView from "@/components/delivery/DeliveryView";
import ScanView from "@/components/scan/ScanView";
import AlertsPanel from "@/components/panels/AlertsPanel";
import UsersPanel from "@/components/panels/UsersPanel";
import SettingsPanel from "@/components/panels/SettingsPanel";
import ProfilePanel from "@/components/panels/ProfilePanel";
import { UserAvatar } from "@/components/ui/kit";

type Section = "dashboard" | "livraison" | "stock" | "scan";
type TopPanel = "alerts" | "users" | "settings" | "profile" | null;

type StockStatusFilterValue = StockStatus | "all";
type StockSortMode = "priority" | "name" | "quantity";

type DeliveryLine = {
  categoryId: string;
  threshold: string;
  id: number;
  product: string;
  quantity: string;
  unit: string;
  lot: string;
  expiration: string;
};

type DeliveryDraft = {
  deliveredAt: string;
  reference: string;
  supplier: string;
};

type DeliveryValidationResult = {
  count: number;
  delivery: Delivery;
};

type StockCorrectionInput = {
  expirationDate?: string;
  lotId?: string;
  productId: string;
  remainingQuantity?: number;
  status?: LotStatus;
  threshold?: number;
};

type ServerStatus = "local" | "offline";
type ThemeMode = "light" | "dark";
type LoginInput = {
  email: string;
  password: string;
};

type RegisterInput = LoginInput & {
  name: string;
  role: "Agent" | "Gestionnaire";
};

type AppRuntimeData = {
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

// useCompactMobile moved to src/lib/hooks.ts

type CategorySettingsPatch = Partial<
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

type AppDataContextValue = AppRuntimeData & {
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

type StockApiResponse = {
  operationDate: string;
  categories: Category[];
  products: Product[];
  lots: Lot[];
  alerts: Alert[];
  activities: Activity[];
  deliveries: Delivery[];
  movements: StockMovement[];
};

type DeliveriesApiResponse = {
  deliveries: Delivery[];
};

type SuppliersApiResponse = {
  supplier?: Supplier;
  suppliers: Supplier[];
};

type UsersApiResponse = {
  users: AppUser[];
};

type AuthApiResponse = {
  message: string;
  ok: boolean;
  user?: AppUser;
};

type PasswordApiResponse = {
  message: string;
  ok: boolean;
};

type BackupApiResponse = {
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

type ServerAccessInfo = {
  cameraRequiresHttps: boolean;
  generatedAt: string;
  hostUrl: string;
  isHttps: boolean;
  lanUrls: string[];
  ok: boolean;
  port: string;
  protocol: "http" | "https";
};

type ScanApiResponse = {
  found: boolean;
  lot?: Lot;
  product?: Product;
  decision?: {
    reason: string;
  };
};

type ScanCodeResult = {
  found: boolean;
  message: string;
  normalizedValue: string;
};

type CameraScanStatus =
  | "idle"
  | "starting"
  | "ready"
  | "https-required"
  | "unsupported"
  | "blocked"
  | "error";

type BarcodeDetectorInstance = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorConstructor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorInstance;

// Empty starting point — real data is loaded from the API. The only seeded
// entry is the synthetic "Tous"/all category used by the stock filter button.
const initialRuntimeData: AppRuntimeData = {
  operationDate: new Date().toISOString().slice(0, 10),
  categories: [
    {
      id: "all",
      name: "Tous",
      mode: "Standard",
      defaultThreshold: 0,
      criticalThreshold: 0,
      soonExpiresDays: 0,
    },
  ],
  products: [],
  lots: [],
  alerts: [],
  activities: [],
  deliveries: [],
  suppliers: [],
  movements: [],
  users: [],
};

// AppDataContext + useAppData moved to src/lib/app-data.tsx (imported above).

async function fetchJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    // Never serve a cached API response (iOS Safari would otherwise show stale data).
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      message?: string;
    } | null;

    // A 401 on an authenticated adapter call means the session expired (e.g. the
    // 15-min idle timeout) — broadcast it so the app logs out cleanly with a
    // notice instead of the action failing silently.
    if (response.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("lc:session-expired"));
    }

    const error = new Error(
      payload?.message ?? payload?.error ?? `HTTP ${response.status}`,
    );
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  return (await response.json()) as T;
}

// WHEN/WHY: client-side session lifecycle (inactivity logout + heartbeat).
// SESSION_IDLE_MS is only the FALLBACK idle window (15 min, matching the
// backend's default): after this long with no user activity we log out. The
// authoritative value is SESSION_IDLE_MINUTES on the backend, served through
// /api/branding as `sessionIdleMinutes` (see useBranding) so changing the env
// can no longer desynchronize the two. While the user IS active a heartbeat
// keeps the server session alive; when idle (or the tab/window is closed) the
// heartbeat stops and the server session frees itself too.
const SESSION_IDLE_MS = 15 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 4 * 60 * 1000;
const ACTIVITY_EVENTS = [
  "pointerdown",
  "keydown",
  "mousemove",
  "scroll",
  "touchstart",
] as const;

// WHEN/WHY: background auto-sync so the view reflects changes made elsewhere
// (another device/user, the scanner, the backend) without a manual refresh.
// Polls every 20s while logged in AND the tab is visible, and refetches
// immediately on focus / visibility / reconnect. Silent (no isSyncing flicker).
const AUTO_SYNC_INTERVAL_MS = 20 * 1000;

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "livraison", label: "Livraison", icon: Truck },
  { id: "stock", label: "Stock", icon: PackageSearch },
  { id: "scan", label: "Scan", icon: Camera },
] satisfies Array<{
  id: Section;
  label: string;
  icon: typeof LayoutDashboard;
}>;

// hasClientPermission moved to src/lib/app-data.tsx (imported above).

const statusStyles: Record<
  StockStatus,
  { label: string; chip: string; fill: string; quiet: string }
> = {
  Stable: {
    label: "Stable",
    chip: "border-[#b8c4ad] bg-[#eef3ea] text-[#485641]",
    fill: "#6f7d62",
    quiet: "text-[#64705c]",
  },
  "Seuil bas": {
    label: "Seuil bas",
    chip: "border-[#e2c28e] bg-[#fbf1dd] text-[#805a1e]",
    fill: "#bf8a38",
    quiet: "text-[#8d6829]",
  },
  Critique: {
    label: "Critique",
    chip: "border-[#d9a09a] bg-[#fae9e6] text-[#8f332b]",
    fill: "#a8463c",
    quiet: "text-[#983c33]",
  },
  "Bientôt expiré": {
    label: "Bientôt expiré",
    chip: "border-[#cdbb96] bg-[#f6edd9] text-[#715b2d]",
    fill: "#8c7042",
    quiet: "text-[#80642e]",
  },
  Expiré: {
    label: "Expiré",
    chip: "border-[#c8b8b3] bg-[#efe7e3] text-[#5d4038]",
    fill: "#5d4038",
    quiet: "text-[#5d4038]",
  },
};

const stockStatusFilters = Object.keys(statusStyles) as StockStatus[];
const lotStatusOptions: LotStatus[] = [
  "En réserve",
  "En service",
  "Bientôt épuisé",
  "Épuisé",
  "Expiré",
];
const roleOptions: Role[] = ["Admin", "Gestionnaire", "Agent"];
const permissionOptions: Array<{
  id: Permission;
  label: string;
}> = [
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

const initialDeliveryDate = getTodayInputDate();
const initialDeliveryLines: DeliveryLine[] = [createEmptyDeliveryLine()];
const initialDeliveryDraft = createDeliveryDraft([], initialDeliveryDate);

function normalizeSearchValue(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getDeliveryDateCode(date: string) {
  return date ? date.replaceAll("-", "").slice(2) : "000000";
}

function getTodayInputDate() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);

  return localDate.toISOString().slice(0, 10);
}

const themeStorageKey = "le-carre-theme";
const themeSourceStorageKey = "le-carre-theme-source";

function getSystemThemeMode(): ThemeMode {
  if (typeof window === "undefined" || !window.matchMedia) return "light";

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getInitialThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "light";

  const hasManualTheme =
    window.localStorage.getItem(themeSourceStorageKey) === "manual";
  const storedTheme = window.localStorage.getItem(themeStorageKey);

  if (hasManualTheme && (storedTheme === "dark" || storedTheme === "light")) {
    return storedTheme;
  }

  return getSystemThemeMode();
}

function hasManualThemeMode() {
  if (typeof window === "undefined") return false;

  return window.localStorage.getItem(themeSourceStorageKey) === "manual";
}

function getServiceLabel(date = new Date()) {
  const hour = date.getHours();

  if (hour < 11) return "Matin";
  if (hour < 16) return "Midi";
  if (hour < 21) return "Soir";

  return "Nuit";
}

function addDaysToInputDate(date: string, days: number) {
  const baseDate = date ? new Date(`${date}T00:00:00`) : new Date();
  baseDate.setDate(baseDate.getDate() + days);

  return baseDate.toISOString().slice(0, 10);
}

function createEmptyDeliveryLine(id = 1): DeliveryLine {
  return {
    categoryId: "secs",
    expiration: "",
    id,
    lot: "",
    product: "",
    quantity: "",
    threshold: "",
    unit: "portion",
  };
}

function createDeliveryReference(deliveredAt: string, deliveries: Delivery[]) {
  const date = deliveredAt || getTodayInputDate();
  const dateCode = getDeliveryDateCode(date);
  const sequenceStats = deliveries.reduce(
    (stats, delivery) => {
      if (delivery.deliveredAt === date) {
        stats.sameDateCount += 1;
      }

      const referenceMatch = delivery.reference.match(
        new RegExp(`^BL-${dateCode}-(\\d+)$`, "i"),
      );

      if (referenceMatch) {
        stats.maxSequence = Math.max(
          stats.maxSequence,
          Number(referenceMatch[1]),
        );
      }

      return stats;
    },
    { maxSequence: 0, sameDateCount: 0 },
  );
  const nextSequence =
    Math.max(sequenceStats.maxSequence, sequenceStats.sameDateCount) + 1;

  return `BL-${dateCode}-${String(nextSequence).padStart(2, "0")}`;
}

function createDeliveryDraft(
  deliveries: Delivery[],
  deliveredAt = getTodayInputDate(),
  supplier = "Marché Central",
): DeliveryDraft {
  return {
    deliveredAt,
    reference: createDeliveryReference(deliveredAt, deliveries),
    supplier,
  };
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

function createSuggestedLotCode({
  deliveredAt,
  lineId,
  productName,
}: {
  deliveredAt: string;
  lineId: number;
  productName: string;
}) {
  return `LC-${getProductCode(productName)}-${getDeliveryDateCode(deliveredAt)}-${lineId}`;
}

function escapeCsvCell(value: string | number) {
  const text = String(value).replace(/"/g, '""');

  return `"${text}"`;
}

function downloadTextFile({
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

function synchronizeDeliveryLinesWithDate({
  categories,
  deliveredAt,
  lines,
  products,
}: {
  categories: Category[];
  deliveredAt: string;
  lines: DeliveryLine[];
  products: Product[];
}) {
  return lines.map((line) => {
    const product = products.find((item) => item.name === line.product);
    const category = product
      ? categories.find((item) => item.id === product.categoryId)
      : undefined;

    if (!product) {
      return line;
    }

    return {
      ...line,
      categoryId: product.categoryId,
      expiration: getDeliveryExpirationDate({
        category,
        deliveredAt,
        proposedExpiration: line.expiration,
      }),
      lot: createSuggestedLotCode({
        deliveredAt,
        lineId: line.id,
        productName: product.name,
      }),
      threshold: String(product.threshold),
    };
  });
}

function getProductCategoryName(product: Product, categoryList: Category[]) {
  return (
    categoryList.find((category) => category.id === product.categoryId)?.name ?? ""
  );
}

function getStatusPriority(status: StockStatus) {
  const label = normalizeSearchValue(statusStyles[status].label);

  if (label.includes("critique")) return 0;
  if (label.includes("expir") && !label.includes("bient")) return 1;
  if (label.includes("expir")) return 2;
  if (label.includes("seuil")) return 3;
  return 4;
}

function getStockProducts({
  categories,
  categoryId,
  products,
  statusFilter,
  query,
  sortMode,
}: {
  categories: Category[];
  categoryId: string;
  products: Product[];
  statusFilter: StockStatusFilterValue;
  query: string;
  sortMode: StockSortMode;
}) {
  const normalizedQuery = normalizeSearchValue(query.trim());
  const filtered = products.filter((product) => {
    const matchesCategory =
      categoryId === "all" || product.categoryId === categoryId;
    const matchesStatus =
      statusFilter === "all" || product.status === statusFilter;
    const searchable = normalizeSearchValue(
      [
        product.name,
        product.unit,
        product.status,
        getProductCategoryName(product, categories),
      ].join(" "),
    );

    return (
      matchesCategory &&
      matchesStatus &&
      (!normalizedQuery || searchable.includes(normalizedQuery))
    );
  });

  return [...filtered].sort((a, b) => {
    if (sortMode === "name") {
      return a.name.localeCompare(b.name, "fr");
    }

    if (sortMode === "quantity") {
      return b.quantity - a.quantity || a.name.localeCompare(b.name, "fr");
    }

    return (
      getStatusPriority(a.status) - getStatusPriority(b.status) ||
      a.name.localeCompare(b.name, "fr")
    );
  });
}

export default function Home() {
  const { t } = useI18n();
  const [runtimeData, setRuntimeData] =
    useState<AppRuntimeData>(initialRuntimeData);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerStatus>("local");
  const [themeMode, setThemeModeState] =
    useState<ThemeMode>(getInitialThemeMode);
  const [hasThemeOverride, setHasThemeOverride] =
    useState(hasManualThemeMode);
  const setThemeMode = useCallback((mode: ThemeMode) => {
    setHasThemeOverride(true);
    setThemeModeState(mode);

    if (typeof window === "undefined") return;

    window.localStorage.setItem(themeStorageKey, mode);
    window.localStorage.setItem(themeSourceStorageKey, "manual");
  }, []);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>("dashboard");
  const isCompactMobile = useCompactMobile();
  const [categoryId, setCategoryId] = useState("all");
  const [selectedProductId, setSelectedProductId] = useState("p-eau");
  const [stockSearch, setStockSearch] = useState("");
  const [stockStatus, setStockStatus] =
    useState<StockStatusFilterValue>("all");
  const stockSort: StockSortMode = "priority";
  const [deliveryDraft, setDeliveryDraft] =
    useState<DeliveryDraft>(initialDeliveryDraft);
  const [deliveryLines, setDeliveryLines] =
    useState<DeliveryLine[]>(initialDeliveryLines);
  const [scannedLotId, setScannedLotId] = useState("");
  const hasSyncedInitialDeliveryReference = useRef(false);
  const { alerts, categories, deliveries, lots, products } = runtimeData;
  const canUseDelivery = hasClientPermission(currentUser, ["validate_deliveries"]);

  // `silent` is used by the background auto-sync (polling / focus refetch) so it
  // refreshes data without flipping `isSyncing` — that would flicker the sync
  // indicator and momentarily disable action buttons every interval.
  const refreshData = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (!silent) setIsSyncing(true);

    try {
      const [stockResponse, usersResponse, deliveriesResponse, suppliersResponse] = await Promise.all([
        fetchJson<StockApiResponse>("/api/stock"),
        fetchJson<UsersApiResponse>("/api/users"),
        fetchJson<DeliveriesApiResponse>("/api/deliveries"),
        fetchJson<SuppliersApiResponse>("/api/suppliers"),
      ]);

      setRuntimeData({
        operationDate: stockResponse.operationDate,
        categories: stockResponse.categories,
        products: stockResponse.products,
        lots: stockResponse.lots,
        alerts: stockResponse.alerts,
        activities: stockResponse.activities,
        deliveries: deliveriesResponse.deliveries,
        suppliers: suppliersResponse.suppliers,
        movements: stockResponse.movements,
        users: usersResponse.users,
      });
      const storedUserId = window.localStorage.getItem("le-carre-user-id");
      const storedUser = usersResponse.users.find(
        (user) => user.id === storedUserId && user.status === "Actif",
      );

      if (storedUser) {
        setCurrentUser(storedUser);
      } else if (storedUserId) {
        window.localStorage.removeItem("le-carre-user-id");
        setCurrentUser(null);
      }

      setServerStatus("local");
    } catch {
      setServerStatus("offline");
    } finally {
      if (!silent) setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [refreshData]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
  }, [themeMode]);

  useEffect(() => {
    if (hasThemeOverride || typeof window === "undefined" || !window.matchMedia) {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystemTheme = (event?: MediaQueryListEvent) => {
      const prefersDark = event?.matches ?? mediaQuery.matches;
      setThemeModeState(prefersDark ? "dark" : "light");
    };

    syncSystemTheme();
    mediaQuery.addEventListener("change", syncSystemTheme);

    return () => mediaQuery.removeEventListener("change", syncSystemTheme);
  }, [hasThemeOverride]);

  useEffect(() => {
    if (!currentUser || hasSyncedInitialDeliveryReference.current) return;

    hasSyncedInitialDeliveryReference.current = true;
    setDeliveryDraft((draft) => ({
      ...draft,
      reference: createDeliveryReference(draft.deliveredAt, runtimeData.deliveries),
    }));
  }, [currentUser, runtimeData.deliveries]);

  const login = useCallback<AppDataContextValue["login"]>(
    async ({ email, password }) => {
      setIsSyncing(true);
      try {
        const response = await fetchJson<AuthApiResponse>("/api/auth/login", {
          body: JSON.stringify({ email, password }),
          method: "POST",
        });

        if (response.user) {
          setCurrentUser(response.user);
          setAuthNotice(null);
          window.localStorage.setItem("le-carre-user-id", response.user.id);
          // The backend (Django) gates every read behind the JWT cookie that
          // this login call just set, so refresh the data now that we're
          // authenticated. (Added with the Django/PostgreSQL wiring.)
          void refreshData();
        }

        return {
          message: response.message,
          ok: response.ok,
        };
      } catch (error) {
        return {
          message: error instanceof Error ? error.message : t("Connexion refusée."),
          ok: false,
        };
      } finally {
        setIsSyncing(false);
      }
    },
    [refreshData, t],
  );

  const logout = useCallback((reason?: string) => {
    // Free the server-side single-session lock + clear the JWT cookie, then
    // reset local state. Fire-and-forget so the UI logs out immediately.
    void fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.localStorage.removeItem("le-carre-user-id");
    setCurrentUser(null);
    setRuntimeData(initialRuntimeData);
    // `reason` is shown on the login screen (e.g. automatic inactivity logout).
    setAuthNotice(reason ?? null);
  }, []);

  // WHEN/WHY: session lifecycle while logged in — (1) auto-logout after
  // SESSION_IDLE_MS of no activity, and (2) an activity-gated heartbeat that
  // keeps the server session alive only while the user is actually active (so
  // an idle tab, or a closed window, lets the server session expire too).
  // `t` is read through a ref so changing the language doesn't reset the idle
  // clock / re-subscribe the listeners.
  const tRef = useRef(t);
  tRef.current = t;
  // Idle window mirrored from the backend (read through a ref so an updated
  // value doesn't reset the listeners / the idle clock).
  const { sessionIdleMinutes } = useBranding();
  const sessionIdleMsRef = useRef(SESSION_IDLE_MS);
  sessionIdleMsRef.current = Math.max(60_000, sessionIdleMinutes * 60_000);
  useEffect(() => {
    if (!currentUser || typeof window === "undefined") return undefined;

    let lastActivity = Date.now();
    let activeSinceBeat = true;
    const markActivity = () => {
      lastActivity = Date.now();
      activeSinceBeat = true;
    };
    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, markActivity, { passive: true }),
    );

    const idleTimer = window.setInterval(() => {
      if (Date.now() - lastActivity >= sessionIdleMsRef.current) {
        logout(tRef.current("Déconnecté après une période d'inactivité."));
      }
    }, 30_000);

    const heartbeatTimer = window.setInterval(() => {
      // Only ping when the user did something since the last beat, so an idle
      // session is allowed to expire on the server as well.
      if (!activeSinceBeat) return;
      activeSinceBeat = false;
      void fetch("/api/auth/ping", { method: "POST" }).catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, markActivity),
      );
      window.clearInterval(idleTimer);
      window.clearInterval(heartbeatTimer);
    };
  }, [currentUser, logout]);

  // When any adapter call reports the session expired (401), log out cleanly
  // with a notice instead of letting the action fail silently. This is what
  // made admin actions (e.g. account approval) look "broken" after an idle
  // timeout: the request 401'd and nothing surfaced.
  useEffect(() => {
    const onExpired = () => {
      if (currentUser) logout(tRef.current("Session expirée. Veuillez vous reconnecter."));
    };
    window.addEventListener("lc:session-expired", onExpired);
    return () => window.removeEventListener("lc:session-expired", onExpired);
  }, [currentUser, logout]);

  // Background auto-sync: keep the view fresh without a manual reload. Polls on
  // an interval and refetches on focus/visibility/reconnect — but only while
  // logged in and the tab is visible, and never overlapping a refresh in
  // flight. Runs silently so it doesn't flicker the sync indicator.
  useEffect(() => {
    if (!currentUser || typeof document === "undefined") return undefined;

    let inFlight = false;
    const sync = async () => {
      if (inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        await refreshData({ silent: true });
      } finally {
        inFlight = false;
      }
    };

    const interval = window.setInterval(() => void sync(), AUTO_SYNC_INTERVAL_MS);
    // Coming back to the tab / window / network -> refetch right away.
    const onWake = () => {
      if (document.visibilityState === "visible") void sync();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    window.addEventListener("online", onWake);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("online", onWake);
    };
  }, [currentUser, refreshData]);

  const registerUser = useCallback<AppDataContextValue["registerUser"]>(
    async ({ email, name, password, role }) => {
      setIsSyncing(true);
      try {
        await fetchJson("/api/users", {
          body: JSON.stringify({ email, name, password, role }),
          method: "POST",
        });
        await refreshData();
        return {
          message: t("Demande envoyée. Un admin doit approuver le compte."),
          ok: true,
        };
      } catch (error) {
        return {
          message:
            error instanceof Error ? error.message : t("Demande non envoyée."),
          ok: false,
        };
      } finally {
        setIsSyncing(false);
      }
    },
    [refreshData],
  );

  const changePassword = useCallback<AppDataContextValue["changePassword"]>(
    async ({ currentPassword, newPassword, userId }) => {
      setIsSyncing(true);
      try {
        return await fetchJson<PasswordApiResponse>("/api/auth/password", {
          body: JSON.stringify({ currentPassword, newPassword, userId }),
          method: "POST",
        });
      } catch (error) {
        return {
          message:
            error instanceof Error ? error.message : t("Mot de passe non modifié."),
          ok: false,
        };
      } finally {
        setIsSyncing(false);
      }
    },
    [],
  );

  const createSupplier = useCallback<AppDataContextValue["createSupplier"]>(
    async ({ contact, email, name, phone }) => {
      setIsSyncing(true);
      try {
        const response = await fetchJson<SuppliersApiResponse>("/api/suppliers", {
          body: JSON.stringify({
            actorId: currentUser?.id,
            contact,
            email,
            name,
            phone,
          }),
          method: "POST",
        });
        await refreshData();
        return response.supplier;
      } finally {
        setIsSyncing(false);
      }
    },
    [currentUser?.id, refreshData],
  );

  const createCategory = useCallback<AppDataContextValue["createCategory"]>(
    async ({ name, mode, defaultThreshold, criticalThreshold, soonExpiresDays }) => {
      setIsSyncing(true);
      try {
        const response = await fetchJson<{ category?: Category }>("/api/categories", {
          body: JSON.stringify({
            actorId: currentUser?.id,
            name,
            mode,
            defaultThreshold,
            criticalThreshold,
            soonExpiresDays,
          }),
          method: "POST",
        });
        await refreshData();
        return response.category;
      } finally {
        setIsSyncing(false);
      }
    },
    [currentUser?.id, refreshData],
  );

  const deleteLot = useCallback<AppDataContextValue["deleteLot"]>(
    async ({ lotId }) => {
      setIsSyncing(true);
      try {
        await fetchJson("/api/stock/lot", {
          body: JSON.stringify({ actorId: currentUser?.id, lotId }),
          method: "DELETE",
        });
        await refreshData();
        return { ok: true };
      } catch {
        return { ok: false };
      } finally {
        setIsSyncing(false);
      }
    },
    [currentUser?.id, refreshData],
  );

  const deleteProduct = useCallback<AppDataContextValue["deleteProduct"]>(
    async ({ productId }) => {
      setIsSyncing(true);
      try {
        await fetchJson("/api/stock/product", {
          body: JSON.stringify({ actorId: currentUser?.id, productId }),
          method: "DELETE",
        });
        await refreshData();
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : undefined,
        };
      } finally {
        setIsSyncing(false);
      }
    },
    [currentUser?.id, refreshData],
  );

  const deleteCategory = useCallback<AppDataContextValue["deleteCategory"]>(
    async ({ categoryId }) => {
      setIsSyncing(true);
      try {
        await fetchJson("/api/categories", {
          body: JSON.stringify({ actorId: currentUser?.id, categoryId }),
          method: "DELETE",
        });
        await refreshData();
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : t("Suppression impossible."),
        };
      } finally {
        setIsSyncing(false);
      }
    },
    [currentUser?.id, refreshData, t],
  );

  const deleteUser = useCallback<AppDataContextValue["deleteUser"]>(
    async ({ userId }) => {
      setIsSyncing(true);
      try {
        await fetchJson("/api/users", {
          body: JSON.stringify({ actorId: currentUser?.id, userId }),
          method: "DELETE",
        });
        await refreshData();
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : t("Suppression impossible."),
        };
      } finally {
        setIsSyncing(false);
      }
    },
    [currentUser?.id, refreshData, t],
  );

  const updateSupplier = useCallback<AppDataContextValue["updateSupplier"]>(
    async ({ active, contact, email, name, phone, supplierId }) => {
      setIsSyncing(true);
      try {
        const response = await fetchJson<SuppliersApiResponse>("/api/suppliers", {
          body: JSON.stringify({
            active,
            actorId: currentUser?.id,
            contact,
            email,
            name,
            phone,
            supplierId,
          }),
          method: "PATCH",
        });
        await refreshData();
        return response.supplier;
      } finally {
        setIsSyncing(false);
      }
    },
    [currentUser?.id, refreshData],
  );

  const correctStock = useCallback<AppDataContextValue["correctStock"]>(
    async (input) => {
      setIsSyncing(true);
      try {
        await fetchJson("/api/stock/correction", {
          body: JSON.stringify({
            actorId: currentUser?.id,
            ...input,
          }),
          method: "POST",
        });
        await refreshData();
      } finally {
        setIsSyncing(false);
      }
    },
    [currentUser?.id, refreshData],
  );

  const exportBackup = useCallback<AppDataContextValue["exportBackup"]>(
    async () => {
      setIsSyncing(true);
      try {
        const params = new URLSearchParams();
        if (currentUser?.id) params.set("actorId", currentUser.id);

        return await fetchJson<BackupApiResponse>(`/api/backup?${params.toString()}`);
      } finally {
        setIsSyncing(false);
      }
    },
    [currentUser?.id],
  );

  const importBackup = useCallback<AppDataContextValue["importBackup"]>(
    async (file) => {
      setIsSyncing(true);
      try {
        const payload = JSON.parse(await file.text()) as {
          database?: unknown;
        };
        const response = await fetchJson<BackupApiResponse>("/api/backup", {
          body: JSON.stringify({
            actorId: currentUser?.id,
            database: payload.database ?? payload,
          }),
          method: "POST",
        });

        await refreshData();
        return response;
      } finally {
        setIsSyncing(false);
      }
    },
    [currentUser?.id, refreshData],
  );

  const recordScanMovement = useCallback<AppDataContextValue["recordScanMovement"]>(
    async ({ lotId, quantity = 0, type }) => {
      setIsSyncing(true);
      try {
        await fetchJson("/api/stock/movement", {
          body: JSON.stringify({
            actorId: currentUser?.id,
            lotId,
            quantity,
            type,
          }),
          method: "POST",
        });
        await refreshData();
      } finally {
        setIsSyncing(false);
      }
    },
    [currentUser?.id, refreshData],
  );

  const scanCode = useCallback(async (value: string): Promise<ScanCodeResult> => {
    const parsed = parseLotQrValue(value);

    if (!parsed.lotCode && !parsed.lotId) {
      return {
        found: false,
        message: t("Code QR illisible."),
        normalizedValue: value.trim(),
      };
    }

    const params = new URLSearchParams();

    if (parsed.lotCode) params.set("code", parsed.lotCode);
    if (parsed.lotId) params.set("lotId", parsed.lotId);

    const response = await fetch(`/api/scan?${params.toString()}`);
    const payload = (await response.json().catch(() => null)) as
      | ScanApiResponse
      | null;

    if (payload?.found && payload.lot?.id) {
      setScannedLotId(payload.lot.id);

      return {
        found: true,
        message: `${payload.lot.code} ${t("détecté.")}`,
        normalizedValue: payload.lot.code,
      };
    }

    return {
      found: false,
      message: payload?.decision?.reason ?? t("Lot introuvable."),
      normalizedValue: parsed.displayValue,
    };
  }, []);

  const updateUserStatus =
    useCallback<AppDataContextValue["updateUserStatus"]>(
      async ({ action, userId }) => {
        setIsSyncing(true);
        try {
          await fetchJson("/api/users", {
            body: JSON.stringify({ action, actorId: currentUser?.id, userId }),
            method: "POST",
          });
          await refreshData();
          return { ok: true };
        } catch (error) {
          // Surface the reason instead of failing silently (a 401 also triggers
          // the session-expired logout via fetchJson).
          return {
            ok: false,
            message: error instanceof Error ? error.message : t("Action impossible."),
          };
        } finally {
          setIsSyncing(false);
        }
      },
      [currentUser?.id, refreshData, t],
    );

  const updateUserProfile =
    useCallback<AppDataContextValue["updateUserProfile"]>(
      async ({ patch, userId }) => {
        setIsSyncing(true);
        try {
          await fetchJson("/api/users", {
            body: JSON.stringify({ actorId: currentUser?.id, userId, ...patch }),
            method: "PATCH",
          });
          await refreshData();
        } finally {
          setIsSyncing(false);
        }
      },
      [currentUser?.id, refreshData],
    );

  const updateCategorySettings = useCallback<
    AppDataContextValue["updateCategorySettings"]
  >(
    async ({ categoryId, patch }) => {
      setIsSyncing(true);
      try {
        await fetchJson("/api/categories", {
          body: JSON.stringify({ actorId: currentUser?.id, categoryId, ...patch }),
          method: "PATCH",
        });
        await refreshData();
      } finally {
        setIsSyncing(false);
      }
    },
    [currentUser?.id, refreshData],
  );

  const validateDelivery = useCallback<AppDataContextValue["validateDelivery"]>(
    async (draft, lines) => {
      const deliveryLines: DeliveryLineInput[] = lines.flatMap((line) => {
        const product = runtimeData.products.find(
          (item) => item.name === line.product,
        );
        const quantity = Number(line.quantity);
        const productName = line.product.trim();
        const threshold = Number(line.threshold);

        if (!productName || !line.lot || !Number.isFinite(quantity) || quantity <= 0) {
          return [];
        }

        return [
          {
            categoryId: product?.categoryId ?? line.categoryId,
            quantity,
            productId: product?.id,
            productName,
            threshold: Number.isFinite(threshold) && threshold >= 0
              ? Math.round(threshold)
              : undefined,
            unit: "portion",
            lotCode: line.lot,
            expirationDate: line.expiration || undefined,
          },
        ];
      });

      if (!draft.supplier.trim() || !draft.reference.trim() || !draft.deliveredAt) {
        throw new Error("Fournisseur, référence et date sont requis.");
      }

      if (deliveryLines.length === 0) {
        throw new Error("Aucune ligne complète à valider.");
      }

      const normalizedReference = draft.reference.trim().toLowerCase();
      const referenceAlreadyExists = runtimeData.deliveries.some(
        (delivery) =>
          delivery.reference.trim().toLowerCase() === normalizedReference,
      );

      if (referenceAlreadyExists) {
        throw new Error("Référence déjà utilisée : générer une nouvelle référence.");
      }

      const existingLotCodes = new Set(
        runtimeData.lots.map((lot) => lot.code.trim().toLowerCase()),
      );
      const incomingLotCodes = new Set<string>();

      for (const line of deliveryLines) {
        const lotCode = line.lotCode.trim();
        const normalizedLotCode = lotCode.toLowerCase();

        if (incomingLotCodes.has(normalizedLotCode)) {
          throw new Error(`${t("Code lot répété dans la livraison :")} ${lotCode}.`);
        }

        if (existingLotCodes.has(normalizedLotCode)) {
          throw new Error(`${t("Code lot déjà existant :")} ${lotCode}.`);
        }

        incomingLotCodes.add(normalizedLotCode);
      }

      setIsSyncing(true);
      try {
        const response = await fetchJson<{ delivery: Delivery }>(
          "/api/deliveries",
          {
            body: JSON.stringify({
              actorId: currentUser?.id,
              deliveredAt: draft.deliveredAt,
              lines: deliveryLines,
              reference: draft.reference.trim(),
              supplier: draft.supplier.trim(),
            }),
            method: "POST",
          },
        );
        await refreshData();
        return {
          count: deliveryLines.length,
          delivery: response.delivery,
        };
      } finally {
        setIsSyncing(false);
      }
    },
    [currentUser?.id, refreshData, runtimeData.deliveries, runtimeData.lots, runtimeData.products],
  );

  const appData = useMemo<AppDataContextValue>(
    () => ({
      ...runtimeData,
      changePassword,
      createSupplier,
      createCategory,
      deleteLot,
      deleteProduct,
      deleteCategory,
      deleteUser,
      correctStock,
      currentUser,
      authNotice,
      exportBackup,
      importBackup,
      isSyncing,
      login,
      logout,
      registerUser,
      refreshData,
      recordScanMovement,
      serverStatus,
      setThemeMode,
      themeMode,
      updateCategorySettings,
      updateSupplier,
      updateUserProfile,
      updateUserStatus,
      validateDelivery,
    }),
    [
      changePassword,
      createSupplier,
      createCategory,
      deleteLot,
      deleteProduct,
      deleteCategory,
      deleteUser,
      correctStock,
      currentUser,
      authNotice,
      exportBackup,
      importBackup,
      isSyncing,
      login,
      logout,
      registerUser,
      recordScanMovement,
      refreshData,
      runtimeData,
      serverStatus,
      setThemeMode,
      themeMode,
      updateCategorySettings,
      updateSupplier,
      updateUserProfile,
      updateUserStatus,
      validateDelivery,
    ],
  );

  const filteredProducts = useMemo(() => {
    return getStockProducts({
      categories,
      categoryId,
      products,
      statusFilter: stockStatus,
      query: stockSearch,
      sortMode: stockSort,
    });
  }, [categories, categoryId, products, stockSearch, stockSort, stockStatus]);

  if (!currentUser) {
    return (
      <AppDataContext.Provider value={appData}>
        <RotateGuard />
        <LoginView />
      </AppDataContext.Provider>
    );
  }

  // WHEN/WHY: the Livraison view now renders on phones too (permission-driven).
  // It used to fall back to "dashboard" on compact mobile, so tapping Livraison
  // did nothing on iPhone. Only a missing permission forces the fallback now.
  const visibleSection =
    activeSection === "livraison" && !canUseDelivery
      ? "dashboard"
      : activeSection;

  const selectedProduct =
    filteredProducts.find((product) => product.id === selectedProductId) ??
    filteredProducts[0] ??
    products.find((product) => product.id === selectedProductId) ??
    products[0];

  // selectedProduct / scannedLot can be undefined before data has loaded (the
  // app now starts empty instead of with mock data), so guard every access.
  const selectedLots = lots.filter((lot) => lot.productId === selectedProduct?.id);
  const selectedCategory = categories.find(
    (category) => category.id === selectedProduct?.categoryId,
  );
  const scannedLot = lots.find((lot) => lot.id === scannedLotId) ?? lots[0];
  const scannedProduct =
    products.find((product) => product.id === scannedLot?.productId) ?? products[0];

  function openProduct(productId: string) {
    setCategoryId("all");
    setStockSearch("");
    setStockStatus("all");
    setSelectedProductId(productId);
    setActiveSection("stock");
  }

  function addDeliveryLine() {
    const nextId =
      deliveryLines.length > 0
        ? Math.max(...deliveryLines.map((line) => line.id)) + 1
        : 1;
    setDeliveryLines([...deliveryLines, createEmptyDeliveryLine(nextId)]);
  }

  function removeDeliveryLine(id: number) {
    setDeliveryLines(deliveryLines.filter((line) => line.id !== id));
  }

  function updateDeliveryLine(id: number, patch: Partial<DeliveryLine>) {
    setDeliveryLines((lines) =>
      lines.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  }

  function updateDeliveryDraft(patch: Partial<DeliveryDraft>) {
    const nextDeliveredAt = patch.deliveredAt;
    const shouldSyncDate =
      Boolean(nextDeliveredAt) && nextDeliveredAt !== deliveryDraft.deliveredAt;

    setDeliveryDraft((draft) => {
      const nextDraft = { ...draft, ...patch };

      if (shouldSyncDate && nextDeliveredAt) {
        nextDraft.reference = createDeliveryReference(nextDeliveredAt, deliveries);
      }

      return nextDraft;
    });

    if (shouldSyncDate && nextDeliveredAt) {
      setDeliveryLines((lines) =>
        synchronizeDeliveryLinesWithDate({
          categories,
          deliveredAt: nextDeliveredAt,
          lines,
          products,
        }),
      );
    }
  }

  function regenerateDeliveryReference() {
    setDeliveryDraft((draft) => ({
      ...draft,
      reference: createDeliveryReference(draft.deliveredAt, deliveries),
    }));
  }

  function loadDeliveryForPrint(delivery: Delivery) {
    setDeliveryDraft({
      deliveredAt: delivery.deliveredAt,
      reference: delivery.reference,
      supplier: delivery.supplier,
    });
    setDeliveryLines(
      delivery.lines.map((line, index) => {
        const product = products.find((item) => item.id === line.productId);

        return {
          categoryId: product?.categoryId ?? "secs",
          expiration: line.expirationDate ?? "",
          id: index + 1,
          lot: line.lotCode,
          product: product?.name ?? line.productName ?? line.productId ?? "",
          quantity: String(line.quantity),
          threshold: product ? String(product.threshold) : "",
          unit: line.unit || product?.unit || "",
        };
      }),
    );
  }

  return (
    <AppDataContext.Provider value={appData}>
      <div className="app-root">
      <TopBar alertCount={alerts.length} onOpenProduct={openProduct} />
      <RotateGuard />

      <main className="app-shell">
        <div key={visibleSection} className="section-enter">
          {visibleSection === "dashboard" && (
            <Dashboard
              onOpenProduct={openProduct}
              onFocusLot={(lotId) => {
                setScannedLotId(lotId);
                setActiveSection("scan");
                window.requestAnimationFrame(() =>
                  window.scrollTo({ behavior: "smooth", top: 0 }),
                );
              }}
            />
          )}

          {visibleSection === "livraison" && (
            <DeliveryView
              draft={deliveryDraft}
              lines={deliveryLines}
              onAddLine={addDeliveryLine}
              onOpenLotScan={(lotCode) => {
                const scanned = lots.find((item) => item.code === lotCode);

                if (scanned) {
                  setScannedLotId(scanned.id);
                } else {
                  void scanCode(lotCode);
                }

                setActiveSection("scan");
                window.requestAnimationFrame(() =>
                  window.scrollTo({ behavior: "smooth", top: 0 }),
                );
              }}
              onRemoveLine={removeDeliveryLine}
              onRegenerateReference={regenerateDeliveryReference}
              onStartNewDelivery={() => {
                setDeliveryDraft(
                  createDeliveryDraft(
                    deliveries,
                    deliveryDraft.deliveredAt,
                    deliveryDraft.supplier,
                  ),
                );
                setDeliveryLines([createEmptyDeliveryLine()]);
              }}
              onUpdateDraft={updateDeliveryDraft}
              onUpdateLine={updateDeliveryLine}
              onValidate={async () => {
                return await validateDelivery(deliveryDraft, deliveryLines);
              }}
              onLoadDelivery={loadDeliveryForPrint}
            />
          )}

          {visibleSection === "stock" && (
            <StockView
              categoryId={categoryId}
              filteredProducts={filteredProducts}
              selectedProduct={selectedProduct}
              selectedLots={selectedLots}
              stockSearch={stockSearch}
              stockStatus={stockStatus}
              selectedCategoryName={selectedCategory?.name ?? ""}
              onCategoryChange={(value) => {
                setCategoryId(value);
                const next = getStockProducts({
                  categories,
                  categoryId: value,
                  products,
                  statusFilter: stockStatus,
                  query: stockSearch,
                  sortMode: stockSort,
                })[0];
                if (next) {
                  setSelectedProductId(next.id);
                }
              }}
              onSearchChange={setStockSearch}
              onSelectProduct={setSelectedProductId}
              onStatusChange={setStockStatus}
              onFocusLot={(lotId) => {
                setScannedLotId(lotId);
                setActiveSection("scan");
                window.requestAnimationFrame(() =>
                  window.scrollTo({ behavior: "smooth", top: 0 }),
                );
              }}
            />
          )}

          {visibleSection === "scan" && (
            <ScanView
              lot={scannedLot}
              product={scannedProduct}
              onScanCode={scanCode}
              onScanProduct={(productId) => {
                const nextLot =
                  lots.find(
                    (item) =>
                      item.productId === productId && item.remainingQuantity > 0,
                  ) ?? lots.find((item) => item.productId === productId);

                if (nextLot) {
                  setScannedLotId(nextLot.id);
                }
              }}
              onOpenProduct={openProduct}
              onPrimaryAction={({ quantity, type }) =>
                recordScanMovement({
                  lotId: scannedLot?.id ?? "",
                  quantity,
                  type,
                })
              }
            />
          )}
        </div>
      </main>

      <BottomNav
        activeSection={visibleSection}
        onChange={(section) => setActiveSection(section)}
      />
      </div>
    </AppDataContext.Provider>
  );
}

function TopBar({
  alertCount,
  onOpenProduct,
}: {
  alertCount: number;
  onOpenProduct: (productId: string) => void;
}) {
  const [activePanel, setActivePanel] = useState<TopPanel>(null);
  const [isPanelClosing, setIsPanelClosing] = useState(false);
  const panelCloseTimerRef = useRef<number | null>(null);
  const { t, lang, toggle } = useI18n();
  const { name: brandName } = useBranding();
  const { currentUser, users } = useAppData();
  const displayedUser = currentUser ?? users[0];
  // Pending account requests — surfaced as a badge on the Users button so an
  // admin notices requests to approve/deny.
  const pendingAccountsCount = users.filter(
    (user) => user.status === "En attente",
  ).length;
  const canManageUsers =
    displayedUser?.role === "Admin" ||
    displayedUser?.permissions.includes("manage_users") ||
    displayedUser?.permissions.includes("approve_accounts");
  const canManageSettings =
    displayedUser?.role === "Admin" ||
    displayedUser?.permissions.includes("manage_categories") ||
    displayedUser?.permissions.includes("edit_thresholds");
  const closePanel = useCallback(() => {
    if (!activePanel || isPanelClosing) return;

    if (panelCloseTimerRef.current) {
      window.clearTimeout(panelCloseTimerRef.current);
    }

    setIsPanelClosing(true);
    panelCloseTimerRef.current = window.setTimeout(() => {
      setActivePanel(null);
      setIsPanelClosing(false);
      panelCloseTimerRef.current = null;
    }, 180);
  }, [activePanel, isPanelClosing]);
  const togglePanel = (panel: Exclude<TopPanel, null>) => {
    if (activePanel === panel) {
      closePanel();
      return;
    }

    if (panelCloseTimerRef.current) {
      window.clearTimeout(panelCloseTimerRef.current);
      panelCloseTimerRef.current = null;
    }

    setIsPanelClosing(false);
    setActivePanel(panel);
  };

  useEffect(() => {
    document.documentElement.dataset.topPanelOpen = activePanel ? "true" : "false";

    if (!activePanel) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePanel();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.documentElement.dataset.topPanelOpen = "false";
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activePanel, closePanel]);

  useEffect(
    () => () => {
      if (panelCloseTimerRef.current) {
        window.clearTimeout(panelCloseTimerRef.current);
      }
    },
    [],
  );

  return (
    <>
    <header className="topbar">
      <div className="flex items-baseline gap-2">
        <span className="topbar-brand">{brandName}</span>
        <span className="hidden text-[0.58rem] uppercase tracking-[0.18em] text-[var(--muted)] sm:inline">
          {t("Économat")}
        </span>
      </div>

        <div className="flex items-center gap-2">
          {/* Language toggle (FR/EN). Shows the language it will switch TO. */}
          <button
            type="button"
            onClick={toggle}
            aria-label={lang === "fr" ? "Switch to English" : "Passer en français"}
            title={lang === "fr" ? "Switch to English" : "Passer en français"}
            className="inline-flex h-[2.6rem] items-center justify-center rounded-[2px] border border-[var(--line)] px-3 text-xs font-semibold uppercase tracking-[0.16em] transition-colors hover:border-[var(--ink)] hover:bg-[var(--ink)] hover:text-[var(--bg)]"
          >
            {lang === "fr" ? "EN" : "FR"}
          </button>
          <button
            type="button"
            aria-label={t("Alertes")}
            title={t("Alertes")}
            onClick={() => togglePanel("alerts")}
            className={`icon-btn ${activePanel === "alerts" ? "is-active" : ""}`}
          >
            <Bell size={18} strokeWidth={1.5} />
            {alertCount > 0 && (
              <span className="dot">{alertCount > 99 ? "99+" : alertCount}</span>
            )}
          </button>
          {canManageUsers && (
            // Visibility is permission-driven (canManageUsers), not screen-size,
            // so admins can approve accounts on phones too.
            <button
              type="button"
              aria-label={t("Utilisateurs")}
              title={t("Utilisateurs")}
              onClick={() => togglePanel("users")}
              className={`icon-btn ${activePanel === "users" ? "is-active" : ""}`}
            >
              <Users size={18} strokeWidth={1.5} />
              {pendingAccountsCount > 0 && (
                <span className="dot dot-amber">{pendingAccountsCount}</span>
              )}
            </button>
          )}
          {canManageSettings && (
            <button
              type="button"
              aria-label={t("Paramètres")}
              title={t("Paramètres")}
              onClick={() => togglePanel("settings")}
              className={`icon-btn ${activePanel === "settings" ? "is-active" : ""}`}
            >
              <Settings size={18} strokeWidth={1.5} />
            </button>
          )}
          <button
            type="button"
            onClick={() => togglePanel("profile")}
            aria-label={t("Profil utilisateur")}
            aria-expanded={activePanel === "profile"}
            className={`ml-1 inline-flex h-[2.6rem] items-center gap-2.5 rounded-[2px] border px-2.5 transition-colors ${
              activePanel === "profile"
                ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--bg)]"
                : "border-[var(--line)] hover:border-[var(--ink)]"
            }`}
          >
            <UserAvatar className="h-7 w-7 text-[11px]" user={displayedUser} />
            <span className="hidden text-left sm:block">
              <span className="block text-[0.7rem] font-semibold leading-tight">
                {displayedUser?.name ?? t("Admin")}
              </span>
              <span className="block text-[0.58rem] uppercase tracking-[0.16em] text-[var(--muted)]">
                {displayedUser?.role ? t(displayedUser.role) : ""}
              </span>
            </span>
            <ChevronDown className="hidden sm:block" size={15} strokeWidth={1.5} />
          </button>
        </div>
      </header>
      {activePanel && (
        <div
          className="panel-backdrop"
          aria-label={t("Fermer le panneau")}
          onClick={closePanel}
          aria-hidden
        />
      )}
      {activePanel === "alerts" && (
        <AlertsPanel
          onClose={closePanel}
          onOpenProduct={(productId) => {
            onOpenProduct(productId);
            setActivePanel(null);
          }}
        />
      )}
      {activePanel === "users" && canManageUsers && (
        <UsersPanel onClose={closePanel} />
      )}
      {activePanel === "settings" && canManageSettings && (
        <SettingsPanel onClose={closePanel} />
      )}
      {activePanel === "profile" && (
        <ProfilePanel onClose={closePanel} />
      )}
    </>
  );
}

// UserAvatar now imported from src/components/ui/kit (uses mono design tokens).
