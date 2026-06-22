/**
 * Domain "database" assembled from the Django/PostgreSQL API.
 *
 * WHY: this module used to read/write a local SQLite file
 * (`data/le-carre.db`) that a collaborator created only for testing. The single
 * source of truth is now the Django API backed by PostgreSQL, so `readDatabase()`
 * fetches the Django resources and maps them into the frontend domain shape that
 * the /api/* routes already expect. WHEN: rewritten during the Django wiring.
 *
 * NOTE: the file name is kept so the existing route imports keep working, but it
 * no longer touches SQLite (the old DatabaseSync / node:sqlite code was removed).
 */
import type {
  Activity,
  AppUser,
  Category,
  Delivery,
  Lot,
  Product,
  StockMovement,
  Supplier,
} from "@/types/domain";
import { djangoFetch, DJANGO_URL } from "@/server/django";
import {
  mapArticleToProduct,
  mapBatchToLot,
  mapCategory,
  mapDelivery,
  mapMovement,
  mapSupplier,
  mapUser,
} from "@/server/mappers";

export type LocalCredential = {
  id: string;
  userId: string;
  passwordHash: string;
  updatedAt: string;
};

export type LocalDatabase = {
  schemaVersion: 1;
  updatedAt: string;
  categories: Category[];
  products: Product[];
  lots: Lot[];
  users: AppUser[];
  suppliers: Supplier[];
  deliveries: Delivery[];
  movements: StockMovement[];
  activities: Activity[];
  credentials: LocalCredential[];
};

// Label shown by /api/health (used to be the SQLite file path).
export const storageLabel = `${DJANGO_URL} (PostgreSQL via Django)`;

// The frontend uses a synthetic "all" category for its "Tous" filter button.
// Django has no such row, so we prepend it on read.
const ALL_CATEGORY: Category = {
  id: "all",
  name: "Tous",
  mode: "Standard",
  defaultThreshold: 0,
  criticalThreshold: 0,
  soonExpiresDays: 0,
};

function emptyDatabase(): LocalDatabase {
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    categories: [ALL_CATEGORY],
    products: [],
    lots: [],
    users: [],
    suppliers: [],
    deliveries: [],
    movements: [],
    activities: [],
    credentials: [],
  };
}

function buildActivities(movements: StockMovement[], productNameById: Map<string, string>): Activity[] {
  return movements.slice(0, 12).map((mvt) => {
    const name = productNameById.get(mvt.productId) ?? "";
    return {
      id: `act-${mvt.id}`,
      label:
        mvt.type === "Entrée"
          ? "Entrée stock"
          : mvt.type === "Activation"
            ? "Lot activé"
            : mvt.type === "Correction"
              ? "Correction"
              : "Sortie enregistrée",
      detail: `${name}${mvt.quantity ? `, ${mvt.quantity} ${mvt.unit}` : ""}`.trim(),
      // Short HH:MM label (the raw ISO string would render unformatted).
      time: mvt.createdAt
        ? new Date(mvt.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
        : "",
    };
  });
}

/**
 * Read the whole domain from Django. Returns an empty (but valid) database when
 * the caller is not authenticated, so pre-login pages render cleanly instead of
 * throwing.
 */
export async function readDatabase(): Promise<LocalDatabase> {
  // /me doubles as the auth gate: no valid cookie -> not authenticated.
  const me = await djangoFetch<{ id: number }>("/api/accounts/me/");
  if (!me.ok || !me.data?.id) {
    return emptyDatabase();
  }

  const [cats, articles, batches, suppliers, deliveries, movements, usersList] = await Promise.all([
    djangoFetch<unknown[]>("/api/categories/"),
    djangoFetch<unknown[]>("/api/articles/"),
    djangoFetch<unknown[]>("/api/batches/"),
    djangoFetch<unknown[]>("/api/suppliers/"),
    djangoFetch<unknown[]>("/api/deliveries/"),
    djangoFetch<unknown[]>("/api/movements/"),
    djangoFetch<unknown[]>("/api/accounts/"), // admin-only; falls back to [me]
  ]);

  const categories: Category[] = [
    ALL_CATEGORY,
    ...(Array.isArray(cats.data) ? cats.data.map((c) => mapCategory(c as never)) : []),
  ];
  const products: Product[] = Array.isArray(articles.data)
    ? articles.data.map((a) => mapArticleToProduct(a as never))
    : [];
  const lots: Lot[] = Array.isArray(batches.data)
    ? batches.data.map((b) => mapBatchToLot(b as never))
    : [];
  const supplierList: Supplier[] = Array.isArray(suppliers.data)
    ? suppliers.data.map((s) => mapSupplier(s as never))
    : [];

  const unitByProduct = new Map(products.map((p) => [p.id, p.unit]));
  const nameByProduct = new Map(products.map((p) => [p.id, p.name]));
  const supplierNameById = new Map(supplierList.map((s) => [s.id, s.name]));

  const stockMovements: StockMovement[] = Array.isArray(movements.data)
    ? movements.data.map((m) => mapMovement(m as never, unitByProduct.get(String((m as { article: number }).article)) ?? ""))
    : [];

  const deliveryList: Delivery[] = Array.isArray(deliveries.data)
    ? deliveries.data.map((d) => {
        const supplierId = (d as { supplier?: number }).supplier;
        return mapDelivery(d as never, supplierId != null ? supplierNameById.get(String(supplierId)) ?? "" : "");
      })
    : [];

  const currentUser = mapUser(me.data as never);
  const users: AppUser[] =
    usersList.ok && Array.isArray(usersList.data)
      ? usersList.data.map((u) => mapUser(u as never))
      : [currentUser];

  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    categories,
    products,
    lots,
    users,
    suppliers: supplierList,
    deliveries: deliveryList,
    movements: stockMovements,
    activities: buildActivities(stockMovements, nameByProduct),
    credentials: [],
  };
}

// Backup restore replaced a whole SQLite file; with a shared central database
// that is intentionally not supported.
export async function restoreDatabase(_payload: unknown): Promise<never> {
  throw new Error("La restauration n'est pas disponible avec la base centrale PostgreSQL.");
}
