// Raw shapes returned by the Django API (single source of truth).
// The mobile app talks to Django directly — no Next.js adapter in between.

export type UserRole = "admin" | "econome" | "employe" | string;

export type User = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  status: string;
  permissions: string[] | Record<string, boolean> | null;
  photo_url: string | null;
  is_active: boolean;
  created_at: string;
};

export type LoginResponse = {
  access: string;
  refresh: string;
  user: User;
};

export type CategoryMode = "standard" | "fefo" | "multi_lots";

export type Category = {
  id: number;
  name: string;
  mode: CategoryMode;
  default_threshold: number;
  critical_threshold: number;
  soon_expires_days: number;
  auto_expiration_days: number | null;
  switch_threshold: number | null;
};

export type Article = {
  id: number;
  name: string;
  category: number;
  unit: string;
  sale_price: string;
  stock_quantity: number;
  min_threshold: number;
  shelf_life_days: number | null;
  created_at: string;
};

export type BatchStatus = "reserve" | "in_service";

export type Batch = {
  id: number;
  article: number;
  supplier: number | null;
  quantity: number;
  initial_quantity: number;
  code: string | null;
  status: BatchStatus;
  purchase_price: string;
  expiry_date: string | null;
  qr_code_path: string | null;
  received_at: string;
};

export type MovementType =
  | "entry"
  | "kitchen_exit"
  | "loss"
  | "deletion"
  | "activation"
  | "correction";

export type Movement = {
  id: number;
  article: number;
  batch: number | null;
  // null once the author account has been deleted (Movement.user is SET_NULL).
  user: number | null;
  // Author-name snapshot taken at creation; survives account deletion.
  user_name: string;
  type: MovementType;
  quantity: number;
  motive: string | null;
  created_at: string;
};

export type Branding = {
  name: string;
};
