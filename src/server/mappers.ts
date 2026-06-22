/**
 * Translation between the Django/PostgreSQL shape (int ids, snake_case,
 * English enum keys) and the frontend domain shape (string ids, camelCase,
 * French canonical enum values). WHEN: added when wiring the app to Django.
 *
 * French stays the frontend's canonical language (the i18n layer then displays
 * EN/FR); Django keeps English enum keys. These maps bridge the two.
 */
import type {
  AppUser,
  Category,
  CategoryMode,
  Delivery,
  DeliveryStatus,
  Lot,
  LotStatus,
  Permission,
  Product,
  Role,
  StockMovement,
  StockMovementType,
  Supplier,
  UserStatus,
} from "@/types/domain";

// ---- enum maps (Django key -> frontend French value) ----
const ROLE_TO_FR: Record<string, Role> = { admin: "Admin", econome: "Gestionnaire", cook: "Agent" };
const ROLE_TO_DJ: Record<Role, string> = { Admin: "admin", Gestionnaire: "econome", Agent: "cook" };

const USTATUS_TO_FR: Record<string, UserStatus> = {
  pending: "En attente", active: "Actif", rejected: "Refusé", disabled: "Désactivé",
};
const USTATUS_TO_DJ: Record<UserStatus, string> = {
  "En attente": "pending", Actif: "active", Refusé: "rejected", Désactivé: "disabled",
};

const MODE_TO_FR: Record<string, CategoryMode> = {
  standard: "Standard", fefo: "FEFO strict", multi_lots: "Multi-lots",
};
const MODE_TO_DJ: Record<CategoryMode, string> = {
  Standard: "standard", "FEFO strict": "fefo", "Multi-lots": "multi_lots",
};

const BATCH_STATUS_TO_FR: Record<string, LotStatus> = {
  reserve: "En réserve", in_service: "En service",
};

const MVT_TO_FR: Record<string, StockMovementType> = {
  entry: "Entrée", kitchen_exit: "Sortie", activation: "Activation",
  correction: "Correction", loss: "Sortie", deletion: "Correction",
};
const MVT_TO_DJ: Record<StockMovementType, string> = {
  "Entrée": "entry", Sortie: "kitchen_exit", Activation: "activation", Correction: "correction",
};

const DELIVERY_STATUS_TO_FR: Record<string, DeliveryStatus> = {
  draft: "Brouillon", validated: "Validée", cancelled: "Annulée",
};

// Sensible default rights per role when a user has no explicit permissions yet.
const ALL_PERMISSIONS: Permission[] = [
  "manage_users", "approve_accounts", "edit_stock", "edit_lots", "edit_thresholds",
  "edit_expiration_dates", "validate_deliveries", "activate_lot", "view_all_alerts", "manage_categories",
];
const DEFAULT_PERMISSIONS: Record<Role, Permission[]> = {
  Admin: ALL_PERMISSIONS,
  Gestionnaire: [
    "edit_stock", "edit_lots", "edit_thresholds", "edit_expiration_dates",
    "validate_deliveries", "activate_lot", "view_all_alerts", "manage_categories",
  ],
  Agent: ["edit_stock", "activate_lot"],
};

export const mapRoleToFr = (r: string): Role => ROLE_TO_FR[r] ?? "Agent";
export const mapRoleToDjango = (r: Role): string => ROLE_TO_DJ[r] ?? "cook";
export const mapUserStatusToDjango = (s: UserStatus): string => USTATUS_TO_DJ[s] ?? "active";
export const mapMovementTypeToDjango = (t: StockMovementType): string => MVT_TO_DJ[t] ?? "kitchen_exit";
export const mapCategoryModeToDjango = (m: CategoryMode): string => MODE_TO_DJ[m] ?? "standard";

// ---- Django object -> frontend domain ----
type DjUser = {
  id: number; name: string; email: string; role: string;
  status?: string; permissions?: Permission[]; created_at?: string;
  photo_url?: string | null;
};
export function mapUser(d: DjUser): AppUser {
  const role = mapRoleToFr(d.role);
  const permissions = d.permissions && d.permissions.length ? d.permissions : DEFAULT_PERMISSIONS[role];
  return {
    id: String(d.id),
    name: d.name,
    email: d.email,
    role,
    status: USTATUS_TO_FR[d.status ?? "active"] ?? "Actif",
    photoUrl: d.photo_url ?? undefined,
    permissions,
  };
}

type DjCategory = {
  id: number; name: string; mode?: string;
  default_threshold?: number; critical_threshold?: number; soon_expires_days?: number;
  auto_expiration_days?: number | null; switch_threshold?: number | null;
};
export function mapCategory(c: DjCategory): Category {
  return {
    id: String(c.id),
    name: c.name,
    mode: MODE_TO_FR[c.mode ?? "standard"] ?? "Standard",
    defaultThreshold: c.default_threshold ?? 0,
    criticalThreshold: c.critical_threshold ?? 0,
    soonExpiresDays: c.soon_expires_days ?? 0,
    autoExpirationDays: c.auto_expiration_days ?? undefined,
    switchThreshold: c.switch_threshold ?? undefined,
  };
}

type DjArticle = {
  id: number; name: string; category: number; unit: string;
  stock_quantity?: number; min_threshold?: number;
};
export function mapArticleToProduct(a: DjArticle): Product {
  return {
    id: String(a.id),
    name: a.name,
    categoryId: String(a.category),
    unit: a.unit,
    threshold: a.min_threshold ?? 0,
    quantity: a.stock_quantity ?? 0, // recomputed from lots by the stock engine
    status: "Stable",
  };
}

type DjBatch = {
  id: number; article: number; supplier?: number | null;
  quantity?: number; initial_quantity?: number; code?: string | null;
  status?: string; expiry_date?: string | null; received_at?: string | null;
};
export function mapBatchToLot(b: DjBatch): Lot {
  const remaining = b.quantity ?? 0;
  return {
    id: String(b.id),
    code: b.code || `LC-${b.id}`,
    productId: String(b.article),
    status: BATCH_STATUS_TO_FR[b.status ?? "reserve"] ?? "En réserve",
    initialQuantity: b.initial_quantity || remaining,
    remainingQuantity: remaining,
    expirationDate: b.expiry_date ?? "",
    receivedAt: b.received_at ?? "",
  };
}

type DjSupplier = {
  id: number; name: string; phone?: string | null; contact?: string | null;
  email?: string | null; is_active?: boolean; created_at?: string | null;
};
export function mapSupplier(s: DjSupplier): Supplier {
  return {
    id: String(s.id),
    name: s.name,
    contact: s.contact ?? undefined,
    email: s.email ?? undefined,
    phone: s.phone ?? undefined,
    active: s.is_active ?? true,
    createdAt: s.created_at ?? new Date().toISOString(),
  };
}

type DjMovement = {
  id: number; article: number; batch?: number | null; user?: number | null;
  type: string; quantity: number; motive?: string | null; created_at?: string | null;
};
export function mapMovement(m: DjMovement, unit = ""): StockMovement {
  return {
    id: String(m.id),
    type: MVT_TO_FR[m.type] ?? "Sortie",
    productId: String(m.article),
    lotId: m.batch != null ? String(m.batch) : undefined,
    quantity: m.quantity,
    unit,
    actorId: m.user != null ? String(m.user) : "",
    createdAt: m.created_at ?? new Date().toISOString(),
    note: m.motive ?? undefined,
  };
}

type DjDelivery = {
  id: number; reference: string; delivered_at?: string | null; status?: string;
  lines?: Array<Record<string, unknown>>; supplier?: number | null;
  validated_by?: number | null;
};
export function mapDelivery(d: DjDelivery, supplierName = ""): Delivery {
  return {
    id: String(d.id),
    supplier: supplierName || (d.supplier != null ? String(d.supplier) : ""),
    reference: d.reference,
    deliveredAt: d.delivered_at ?? "",
    status: DELIVERY_STATUS_TO_FR[d.status ?? "validated"] ?? "Validée",
    lines: (d.lines ?? []).map((line) => ({
      productName: String(line.product_name ?? ""),
      quantity: Number(line.quantity ?? 0),
      unit: String(line.unit ?? ""),
      lotCode: String(line.lot_code ?? ""),
      expirationDate: line.expiry_date ? String(line.expiry_date) : undefined,
    })),
    validatedBy: d.validated_by != null ? String(d.validated_by) : undefined,
  };
}
