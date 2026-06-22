/**
 * Stock domain services.
 *
 * WHY: these functions used to read/write the local SQLite database. They now
 * call the Django REST API (PostgreSQL) via the JWT-aware client and reuse the
 * existing stock engine to DERIVE statuses/alerts from the Django data. The
 * public function signatures and return shapes are unchanged so the /api/*
 * routes and the frontend keep working. WHEN: rewritten during the Django wiring.
 */
import { readDatabase, type LocalDatabase } from "@/server/local-database";
import { djangoFetch } from "@/server/django";
import {
  mapCategory,
  mapCategoryModeToDjango,
  mapDelivery,
  mapRoleToDjango,
  mapSupplier,
  mapUser,
} from "@/server/mappers";
import {
  buildLotsWithRuntimeStatus,
  buildStockProducts,
  evaluateLotScan,
  generateStockAlerts,
  getCategoryForProduct,
  getSuggestedScanProducts,
} from "@/lib/stock-engine";
import type {
  Category,
  Delivery,
  DeliveryLineInput,
  Lot,
  LotStatus,
  Role,
  StockMovement,
  Supplier,
} from "@/types/domain";

type RuntimeStock = {
  database: LocalDatabase;
  operationDate: string;
  lots: Lot[];
  products: LocalDatabase["products"];
  alerts: ReturnType<typeof generateStockAlerts>;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

// WHEN/WHY: mutations forward Django's outcome instead of synthesising a fake
// success. This pulls Django's `detail` off a failed result so the adapter can
// surface the real reason (e.g. "kitchen exit exceeds stock") to the route.
// CODE_REVIEW_PLAN #2.
function djangoDetail(
  result: { ok: boolean; data: unknown },
  fallback: string,
): string {
  const detail = (result.data as { detail?: string } | null)?.detail;
  return detail || fallback;
}

// ---- READ PATH (Django data -> stock engine -> derived statuses/alerts) ----
export function buildRuntimeStock(
  database: LocalDatabase,
  operationDate = todayISO(),
): RuntimeStock {
  const lots = buildLotsWithRuntimeStatus(
    database.lots, database.products, database.categories, operationDate,
  );
  const products = buildStockProducts(
    database.products, lots, database.categories, operationDate,
  );
  const alerts = generateStockAlerts(products, lots, database.categories, operationDate);
  return { database, operationDate, lots, products, alerts };
}

export async function getStockSnapshot() {
  return buildRuntimeStock(await readDatabase());
}

export async function scanLot({
  lotCode,
  lotId,
  quantityOut = 1,
  unknownScan = false,
}: {
  lotCode?: string;
  lotId?: string;
  quantityOut?: number;
  unknownScan?: boolean;
}) {
  const snapshot = await getStockSnapshot();
  // WHEN/WHY: match the parsed value against BOTH the lot id and the lot code
  // (case-insensitive). Django lot ids are numeric strings while codes are
  // "LC-…"; matching either lets the QR resolve whether it came from a scan or
  // from selecting an item via search.
  const candidates = [lotId, lotCode]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());
  const lot = snapshot.lots.find(
    (item) =>
      candidates.includes(item.id.toLowerCase()) ||
      candidates.includes(item.code.toLowerCase()),
  );

  if (!lot) {
    return {
      found: false,
      decision: {
        allowed: false,
        action: "Créer anomalie",
        reason: "QR absent de la base",
        severity: "warning" as const,
        canActivate: false,
        canExit: false,
      },
      suggestions: getSuggestedScanProducts(snapshot.products, ""),
    };
  }

  const product = snapshot.products.find((item) => item.id === lot.productId);
  const category = product
    ? getCategoryForProduct(product, snapshot.database.categories)
    : undefined;
  const decision = evaluateLotScan({
    category, lot, lots: snapshot.lots, quantityOut, unknownScan,
    today: snapshot.operationDate,
  });

  return {
    found: true,
    product,
    lot,
    decision,
    suggestions: getSuggestedScanProducts(snapshot.products, product?.id ?? ""),
  };
}

// ---- WRITE PATH (all mutations go to Django) ----
export async function recordStockMovement({
  actorId = "",
  lotId,
  quantity = 0,
  type,
}: {
  actorId?: string;
  lotId: string;
  quantity?: number;
  type: "Activation" | "Sortie";
}) {
  const snapshot = await getStockSnapshot();
  const lot = snapshot.lots.find((item) => item.id === lotId);

  if (!lot) {
    return { blockedReason: undefined, movement: undefined, snapshot };
  }

  const product = snapshot.products.find((item) => item.id === lot.productId);
  const category = product
    ? getCategoryForProduct(product, snapshot.database.categories)
    : undefined;
  const decision = evaluateLotScan({
    category, lot, lots: snapshot.lots, quantityOut: quantity,
    today: snapshot.operationDate,
  });

  if (type === "Activation" && !decision.canActivate) {
    return { blockedReason: decision.reason, movement: undefined, snapshot };
  }
  if (type === "Sortie" && (quantity <= 0 || !decision.canExit)) {
    return {
      blockedReason: quantity <= 0 ? "Quantite de sortie requise." : decision.reason,
      movement: undefined,
      snapshot,
    };
  }

  const articleId = Number(lot.productId);
  const batchId = Number(lotId);

  if (type === "Activation") {
    const patched = await djangoFetch<{ detail?: string }>(`/api/batches/${batchId}/`, {
      method: "PATCH",
      body: JSON.stringify({ status: "in_service" }),
    });
    if (!patched.ok) {
      return { blockedReason: djangoDetail(patched, "Activation refusée."), movement: undefined, snapshot };
    }
    const logged = await djangoFetch<{ detail?: string }>("/api/movements/", {
      method: "POST",
      body: JSON.stringify({
        article: articleId, batch: batchId, type: "activation",
        quantity: lot.remainingQuantity || 1, motive: "Lot activé par scan",
      }),
    });
    if (!logged.ok) {
      return { blockedReason: djangoDetail(logged, "Activation refusée."), movement: undefined, snapshot };
    }
  } else {
    // Order matters: the movement POST is what decrements Django's article stock
    // (and is rejected when the exit exceeds stock). Only patch the batch qty
    // once it succeeds.
    const logged = await djangoFetch<{ detail?: string }>("/api/movements/", {
      method: "POST",
      body: JSON.stringify({
        article: articleId, batch: batchId, type: "kitchen_exit",
        quantity, motive: "Sortie enregistrée par scan",
      }),
    });
    if (!logged.ok) {
      return { blockedReason: djangoDetail(logged, "Sortie refusée."), movement: undefined, snapshot };
    }
    const patched = await djangoFetch<{ detail?: string }>(`/api/batches/${batchId}/`, {
      method: "PATCH",
      body: JSON.stringify({ quantity: Math.max(0, lot.remainingQuantity - quantity) }),
    });
    if (!patched.ok) {
      return {
        blockedReason: djangoDetail(patched, "Sortie enregistrée mais quantité du lot non mise à jour."),
        movement: undefined,
        snapshot,
      };
    }
  }

  const movement: StockMovement = {
    id: `mov-${Date.now().toString(36)}`,
    type,
    productId: lot.productId,
    lotId,
    quantity,
    unit: product?.unit ?? "",
    actorId,
    createdAt: new Date().toISOString(),
    note: type === "Activation" ? "Lot activé par scan" : "Sortie enregistrée par scan",
  };

  return { blockedReason: undefined, movement, snapshot: await getStockSnapshot() };
}

export async function validateDelivery({
  deliveredAt,
  lines,
  reference,
  supplier,
}: {
  actorId?: string;
  deliveredAt: string;
  lines: DeliveryLineInput[];
  reference: string;
  supplier: string;
}) {
  const database = await readDatabase();
  const supplierMatch = database.suppliers.find(
    (item) => item.name.trim().toLowerCase() === supplier.trim().toLowerCase(),
  );

  const djangoLines = lines.map((line) => {
    const base = {
      quantity: line.quantity,
      unit: line.unit,
      lot_code: line.lotCode,
      expiry_date: line.expirationDate || null,
    };
    if (line.productId) {
      return { ...base, article: Number(line.productId) };
    }
    return {
      ...base,
      product_name: line.productName,
      category: line.categoryId ? Number(line.categoryId) : undefined,
      threshold: line.threshold,
    };
  });

  const result = await djangoFetch<{ id: number; detail?: string }>("/api/deliveries/", {
    method: "POST",
    body: JSON.stringify({
      supplier: supplierMatch ? Number(supplierMatch.id) : undefined,
      reference: reference.trim(),
      delivered_at: deliveredAt || null,
      lines: djangoLines,
    }),
  });

  if (!result.ok) {
    throw new Error(result.data?.detail || "Livraison non valide.");
  }

  const delivery: Delivery = mapDelivery(result.data as never, supplier);
  return { delivery, snapshot: await getStockSnapshot() };
}

export async function createSupplier({
  contact,
  email,
  name,
  phone,
}: {
  contact?: string;
  email?: string;
  name: string;
  phone?: string;
}) {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Nom fournisseur requis.");

  const result = await djangoFetch<Record<string, unknown>>("/api/suppliers/", {
    method: "POST",
    body: JSON.stringify({
      name: trimmedName,
      phone: phone?.trim() || "",
      contact: contact?.trim() || null,
      email: email?.trim() || null,
    }),
  });

  const database = await readDatabase();

  if (!result.ok) {
    // Most likely a unique-name conflict: reuse the existing supplier.
    const existing = database.suppliers.find(
      (item) => item.name.trim().toLowerCase() === trimmedName.toLowerCase(),
    );
    if (existing) return { supplier: existing, suppliers: database.suppliers };
    throw new Error("Fournisseur non enregistré.");
  }

  return { supplier: mapSupplier(result.data as never), suppliers: database.suppliers };
}

export async function updateSupplier({
  active,
  contact,
  email,
  name,
  phone,
  supplierId,
}: {
  active?: boolean;
  contact?: string;
  email?: string;
  name?: string;
  phone?: string;
  supplierId: string;
}) {
  const patch: Record<string, unknown> = {};
  if (name?.trim()) patch.name = name.trim();
  if (phone !== undefined) patch.phone = phone.trim() || "";
  if (contact !== undefined) patch.contact = contact.trim() || null;
  if (email !== undefined) patch.email = email.trim() || null;
  if (active !== undefined) patch.is_active = active;

  const result = await djangoFetch<Record<string, unknown>>(
    `/api/suppliers/${Number(supplierId)}/`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );

  if (!result.ok) {
    if (result.status === 404) throw new Error("Fournisseur introuvable.");
    throw new Error("Un fournisseur porte déjà ce nom.");
  }

  const database = await readDatabase();
  return { supplier: mapSupplier(result.data as never), suppliers: database.suppliers };
}

export async function correctStock({
  expirationDate,
  lotId,
  productId,
  remainingQuantity,
  status,
  threshold,
}: {
  actorId?: string;
  expirationDate?: string;
  lotId?: string;
  productId: string;
  remainingQuantity?: number;
  status?: LotStatus;
  threshold?: number;
}) {
  const before = await getStockSnapshot();
  const product = before.products.find((item) => item.id === productId);
  const lot = lotId ? before.lots.find((item) => item.id === lotId) : undefined;

  if (!product && !lot) {
    return { lot: undefined, movement: undefined, product: undefined, snapshot: before };
  }

  // WHEN/WHY: each Django call is now checked. On any failure we return early
  // with `error` (and the pre-mutation snapshot) instead of recomputing a
  // snapshot that looks like a success. CODE_REVIEW_PLAN #2.
  const fail = (error: string) => ({
    lot,
    movement: undefined as StockMovement | undefined,
    product,
    snapshot: before,
    error,
  });

  // Product threshold -> article.min_threshold
  if (threshold !== undefined && product) {
    const res = await djangoFetch<{ detail?: string }>(`/api/articles/${Number(productId)}/`, {
      method: "PATCH",
      body: JSON.stringify({ min_threshold: threshold }),
    });
    if (!res.ok) return fail(djangoDetail(res, "Correction du seuil refusée."));
  }

  let movement: StockMovement | undefined;

  // Lot quantity / expiry / stored status
  if (lot && (remainingQuantity !== undefined || expirationDate || status)) {
    const batchId = Number(lot.id);
    const patch: Record<string, unknown> = {};
    let delta = 0;

    if (remainingQuantity !== undefined) {
      const next = Math.max(0, Math.round(remainingQuantity));
      delta = next - lot.remainingQuantity;
      patch.quantity = next;
    }
    if (expirationDate) patch.expiry_date = expirationDate;
    if (status === "En réserve") patch.status = "reserve";
    if (status === "En service") patch.status = "in_service";

    const patched = await djangoFetch<{ detail?: string }>(`/api/batches/${batchId}/`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    if (!patched.ok) return fail(djangoDetail(patched, "Correction du lot refusée."));

    // Reconcile the article stock + log a correction movement.
    if (delta !== 0 && product) {
      const article = await djangoFetch<{ stock_quantity?: number; detail?: string }>(
        `/api/articles/${Number(productId)}/`,
      );
      if (!article.ok) return fail(djangoDetail(article, "Article introuvable."));
      const current = article.data?.stock_quantity ?? 0;
      const stockRes = await djangoFetch<{ detail?: string }>(`/api/articles/${Number(productId)}/`, {
        method: "PATCH",
        body: JSON.stringify({ stock_quantity: Math.max(0, current + delta) }),
      });
      if (!stockRes.ok) return fail(djangoDetail(stockRes, "Mise à jour du stock refusée."));
      const moveRes = await djangoFetch<{ detail?: string }>("/api/movements/", {
        method: "POST",
        body: JSON.stringify({
          article: Number(productId), batch: batchId, type: "correction",
          quantity: Math.abs(delta), motive: "Correction inventaire",
        }),
      });
      if (!moveRes.ok) return fail(djangoDetail(moveRes, "Mouvement de correction refusé."));
      movement = {
        id: `mov-${Date.now().toString(36)}`,
        type: "Correction",
        productId,
        lotId: lot.id,
        quantity: delta,
        unit: product.unit,
        actorId: "",
        createdAt: new Date().toISOString(),
        note: "Correction inventaire",
      };
    }
  }

  const snapshot = await getStockSnapshot();
  return {
    lot: snapshot.lots.find((item) => item.id === lotId),
    movement,
    product: snapshot.products.find((item) => item.id === productId),
    snapshot,
    error: undefined as string | undefined,
  };
}

export async function updateUserStatus({
  action,
  userId,
}: {
  action: "approve" | "refuse" | "disable" | "reactivate";
  userId: string;
}) {
  const patchByAction: Record<typeof action, Record<string, unknown>> = {
    approve: { status: "active", is_active: true },
    refuse: { status: "rejected", is_active: false },
    disable: { status: "disabled", is_active: false },
    reactivate: { status: "active", is_active: true },
  };

  const result = await djangoFetch<Record<string, unknown>>(
    `/api/accounts/${Number(userId)}/`,
    { method: "PATCH", body: JSON.stringify(patchByAction[action]) },
  );

  const database = await readDatabase();
  if (!result.ok) return { user: undefined, users: database.users };
  return { user: mapUser(result.data as never), users: database.users };
}

export async function createUserAccount({
  email,
  name,
  password,
  role,
}: {
  email: string;
  name: string;
  password: string;
  role: Role;
}) {
  // WHEN/WHY: admin-created accounts go through the admin endpoint
  // (POST /api/accounts/) so the chosen role is honoured and the account is
  // immediately ACTIVE — not silently downgraded to a PENDING econome by the
  // public RegisterView. The admin's JWT cookie is forwarded; Django's IsAdmin
  // backstops it. Public self-registration keeps using /register/.
  // CODE_REVIEW_PLAN #3.
  const result = await djangoFetch<{ id?: number; email?: string[]; detail?: string }>(
    "/api/accounts/",
    {
      method: "POST",
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role: mapRoleToDjango(role),
        status: "active",
        permissions: [],
      }),
    },
  );

  const database = await readDatabase();

  if (result.ok) {
    return {
      duplicate: false,
      error: undefined as string | undefined,
      user: mapUser(result.data as never),
      users: database.users,
    };
  }

  // A 400 carrying an `email` field error means the address is already taken;
  // any other failure is a distinct validation/permission error surfaced as-is.
  const duplicate = result.status === 400 && Boolean(result.data?.email);
  return {
    duplicate,
    error: duplicate ? undefined : djangoDetail(result, "Création du compte impossible."),
    user: undefined,
    users: database.users,
  };
}

// Public self-registration (the login-screen "Demande" flow). Creates a PENDING
// account through RegisterView (AllowAny); an admin approves it afterwards.
// Kept distinct from createUserAccount so admin creation can honour role + go
// straight to ACTIVE while RegisterView stays strictly for self-registration.
// CODE_REVIEW_PLAN #3.
export async function requestAccount({
  email,
  name,
  password,
  role,
}: {
  email: string;
  name: string;
  password: string;
  role: Role;
}) {
  const result = await djangoFetch<{ email?: string[]; detail?: string }>(
    "/api/accounts/register/",
    {
      method: "POST",
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role: mapRoleToDjango(role),
      }),
    },
  );

  const database = await readDatabase();

  if (result.ok) {
    return { duplicate: false, error: undefined as string | undefined, user: undefined, users: database.users };
  }

  const duplicate = result.status === 400 && Boolean(result.data?.email);
  return {
    duplicate,
    error: duplicate ? undefined : djangoDetail(result, "Demande non envoyée."),
    user: undefined,
    users: database.users,
  };
}

export async function updateUserProfile({
  patch,
  self = false,
  userId,
}: {
  patch: {
    email?: string;
    name?: string;
    permissions?: string[];
    role?: Role;
    photoUrl?: string | null;
  };
  // WHEN/WHY: `self` routes a user's own non-sensitive edit (name/email/avatar)
  // through the self-service endpoint `/api/accounts/me/` (IsAuthenticated)
  // instead of the admin-only `/api/accounts/<id>/`. role/permissions are never
  // sent on the self path — the route already blocks sensitive self-edits.
  // CODE_REVIEW_PLAN #1.
  self?: boolean;
  userId: string;
}) {
  const body: Record<string, unknown> = {};
  if (patch.name) body.name = patch.name;
  if (patch.email) body.email = patch.email;
  // photoUrl persists in Django's User.photo_url (data URL). `null` clears it.
  if (patch.photoUrl !== undefined) body.photo_url = patch.photoUrl;
  if (!self) {
    if (patch.role) body.role = mapRoleToDjango(patch.role);
    if (patch.permissions) body.permissions = patch.permissions;
  }

  const result = await djangoFetch<Record<string, unknown>>(
    self ? "/api/accounts/me/" : `/api/accounts/${Number(userId)}/`,
    { method: "PATCH", body: JSON.stringify(body) },
  );

  const database = await readDatabase();
  if (!result.ok) return { user: undefined, users: database.users };
  return { user: mapUser(result.data as never), users: database.users };
}

export async function updateCategorySettings({
  categoryId,
  patch,
}: {
  categoryId: string;
  patch: Partial<
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
}) {
  const body: Record<string, unknown> = {};
  if (patch.mode) body.mode = mapCategoryModeToDjango(patch.mode);
  if (patch.defaultThreshold !== undefined) body.default_threshold = patch.defaultThreshold;
  if (patch.criticalThreshold !== undefined) body.critical_threshold = patch.criticalThreshold;
  if (patch.soonExpiresDays !== undefined) body.soon_expires_days = patch.soonExpiresDays;
  if (patch.switchThreshold !== undefined) body.switch_threshold = patch.switchThreshold;
  if (patch.autoExpirationDays !== undefined) body.auto_expiration_days = patch.autoExpirationDays;

  const result = await djangoFetch<Record<string, unknown>>(
    `/api/categories/${Number(categoryId)}/`,
    { method: "PATCH", body: JSON.stringify(body) },
  );

  if (!result.ok) {
    return { category: undefined, snapshot: await getStockSnapshot() };
  }

  return {
    category: mapCategory(result.data as never),
    snapshot: await getStockSnapshot(),
  };
}

export async function createCategory({
  name,
  mode,
  defaultThreshold,
  criticalThreshold,
  soonExpiresDays,
  switchThreshold,
  autoExpirationDays,
}: {
  name: string;
  mode?: Category["mode"];
  defaultThreshold?: number;
  criticalThreshold?: number;
  soonExpiresDays?: number;
  switchThreshold?: number;
  autoExpirationDays?: number;
}) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Nom de catégorie requis.");

  const body: Record<string, unknown> = { name: trimmed };
  if (mode) body.mode = mapCategoryModeToDjango(mode);
  if (defaultThreshold !== undefined) body.default_threshold = defaultThreshold;
  if (criticalThreshold !== undefined) body.critical_threshold = criticalThreshold;
  if (soonExpiresDays !== undefined) body.soon_expires_days = soonExpiresDays;
  if (switchThreshold !== undefined) body.switch_threshold = switchThreshold;
  if (autoExpirationDays !== undefined) body.auto_expiration_days = autoExpirationDays;

  const result = await djangoFetch<Record<string, unknown>>("/api/categories/", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!result.ok) {
    // Most likely a unique-name conflict.
    throw new Error("Une catégorie porte déjà ce nom.");
  }

  return {
    category: mapCategory(result.data as never),
    snapshot: await getStockSnapshot(),
  };
}

// Delete a lot (batch). Records a 'deletion' movement for the remaining quantity
// (audit + stock decrement, clamped to current article stock so the movement
// endpoint accepts it), then deletes the batch (allowed now that Movement.batch
// is SET_NULL). The movement row is kept with batch=null.
export async function deleteLot({ lotId }: { lotId: string }) {
  const before = await getStockSnapshot();
  const lot = before.lots.find((item) => item.id === lotId);
  if (!lot) return { ok: false, message: undefined, snapshot: before };

  const batchId = Number(lotId);
  const articleId = Number(lot.productId);

  if (lot.remainingQuantity > 0) {
    const article = await djangoFetch<{ stock_quantity?: number }>(
      `/api/articles/${articleId}/`,
    );
    const stock = article.data?.stock_quantity ?? 0;
    const qty = Math.min(lot.remainingQuantity, stock);
    if (qty > 0) {
      // WHEN/WHY: bail before deleting if the audit movement fails — deleting the
      // batch anyway would drop the lot with no trace of its remaining stock.
      // CODE_REVIEW_PLAN #2.
      const logged = await djangoFetch<{ detail?: string }>("/api/movements/", {
        method: "POST",
        body: JSON.stringify({
          article: articleId, batch: batchId, type: "deletion",
          quantity: qty, motive: "Lot supprimé",
        }),
      });
      if (!logged.ok) {
        return {
          ok: false,
          message: djangoDetail(logged, "Suppression impossible : mouvement non enregistré."),
          snapshot: before,
        };
      }
    }
  }

  const result = await djangoFetch<{ detail?: string }>(`/api/batches/${batchId}/`, {
    method: "DELETE",
  });
  return {
    ok: result.ok,
    message: result.ok ? undefined : djangoDetail(result, "Suppression impossible."),
    snapshot: await getStockSnapshot(),
  };
}

// Delete a product (article). Only possible when it has no protected history
// (lots/movements); otherwise Django blocks it and we surface a clear message.
export async function deleteProduct({ productId }: { productId: string }) {
  const result = await djangoFetch(`/api/articles/${Number(productId)}/`, {
    method: "DELETE",
  });
  if (!result.ok) {
    throw new Error("Impossible de supprimer : le produit a un historique.");
  }
  return { ok: true, snapshot: await getStockSnapshot() };
}

// Delete a category. Guarded to empty categories only: the Article->Category FK
// is PROTECT, so a non-empty category cannot (and must not) be deleted. We check
// here for a clean message instead of relying on a Django ProtectedError.
export async function deleteCategory({ categoryId }: { categoryId: string }) {
  const db = await readDatabase();
  const linked = db.products.filter((product) => product.categoryId === categoryId).length;
  if (linked > 0) {
    return {
      ok: false,
      message: "La catégorie contient encore des produits.",
      categories: db.categories,
    };
  }

  const result = await djangoFetch(`/api/categories/${Number(categoryId)}/`, {
    method: "DELETE",
  });
  const after = await readDatabase();
  return {
    ok: result.ok,
    message: result.ok ? undefined : "Suppression impossible.",
    categories: after.categories,
  };
}

// Delete a user account. Django (UserDetailView) restricts this to admins and
// blocks self-deletion; the adapter route also guards against deleting oneself.
export async function deleteUser({ userId }: { userId: string }) {
  const result = await djangoFetch(`/api/accounts/${Number(userId)}/`, {
    method: "DELETE",
  });
  const db = await readDatabase();
  return {
    ok: result.ok,
    message: result.ok ? undefined : "Suppression impossible.",
    users: db.users,
  };
}
