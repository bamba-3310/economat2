export type Role = "Admin" | "Gestionnaire" | "Agent";

export type UserStatus = "En attente" | "Actif" | "Refusé" | "Désactivé";

export type Permission =
  | "manage_users"
  | "approve_accounts"
  | "edit_stock"
  | "edit_lots"
  | "edit_thresholds"
  | "edit_expiration_dates"
  | "validate_deliveries"
  | "activate_lot"
  | "view_all_alerts"
  | "manage_categories";

export type CategoryMode = "FEFO strict" | "Multi-lots" | "Standard";

export type StockStatus =
  | "Stable"
  | "Seuil bas"
  | "Critique"
  | "Bientôt expiré"
  | "Expiré";

export type LotStatus =
  | "En réserve"
  | "En service"
  | "Bientôt épuisé"
  | "Épuisé"
  | "Expiré";

export type AlertType =
  | "Seuil bas"
  | "Stock critique"
  | "Produit expiré"
  | "Produit bientôt expiré";

export type Category = {
  id: string;
  name: string;
  mode: CategoryMode;
  defaultThreshold: number;
  criticalThreshold: number;
  soonExpiresDays: number;
  autoExpirationDays?: number;
  switchThreshold?: number;
};

export type Lot = {
  id: string;
  code: string;
  productId: string;
  status: LotStatus;
  initialQuantity: number;
  remainingQuantity: number;
  expirationDate: string;
  receivedAt: string;
};

export type Product = {
  id: string;
  name: string;
  categoryId: string;
  unit: string;
  threshold: number;
  quantity: number;
  status: StockStatus;
};

export type Alert = {
  id: string;
  type: AlertType;
  productId: string;
  lotId?: string;
  priority: "Attention" | "Urgent" | "Bloquant";
  message: string;
};

export type Activity = {
  id: string;
  label: string;
  detail: string;
  time: string;
};

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  photoUrl?: string;
  permissions: Permission[];
};

export type Supplier = {
  id: string;
  name: string;
  contact?: string;
  email?: string;
  phone?: string;
  active: boolean;
  createdAt: string;
};

export type StockMovementType = "Entrée" | "Sortie" | "Activation" | "Correction";

export type StockMovement = {
  id: string;
  type: StockMovementType;
  productId: string;
  lotId?: string;
  quantity: number;
  unit: string;
  actorId: string;
  // Author-name snapshot taken by Django at creation; survives account
  // deletion (actorId then points at a deleted user).
  actorName: string;
  createdAt: string;
  note?: string;
};

export type DeliveryStatus = "Brouillon" | "Validée" | "Annulée";

export type DeliveryLineInput = {
  productId?: string;
  productName?: string;
  categoryId?: string;
  threshold?: number;
  quantity: number;
  unit: string;
  lotCode: string;
  expirationDate?: string;
};

export type Delivery = {
  id: string;
  supplier: string;
  reference: string;
  deliveredAt: string;
  status: DeliveryStatus;
  lines: DeliveryLineInput[];
  validatedBy?: string;
};

export type BusinessDecision = {
  allowed: boolean;
  action: string;
  reason: string;
  severity: "ok" | "warning" | "blocked";
};
