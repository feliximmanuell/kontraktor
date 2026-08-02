export type Role = 'tukang' | 'admin' | 'bos';
export type ProjectStatus = 'active' | 'completed';
export type RequestStatus = 'pending' | 'approved' | 'rejected';
export type ReceiptStatus = 'pending' | 'received';

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  role: Role;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  location: string | null;
  status: ProjectStatus;
  created_at: string;
}

export interface Material {
  id: string;
  name: string;
  unit: string;
  category: string | null;
  created_at: string;
}

export interface MaterialRequest {
  id: string;
  project_id: string | null;
  project_name: string;
  requester_id: string | null;
  material_id: string | null;
  material_name: string;
  requested_qty: string;
  notes: string | null;
  status: RequestStatus;
  is_flagged_duplicate: boolean;
  created_at: string;
}

export interface Purchase {
  id: string;
  request_id: string | null;
  project_id: string | null;
  project_name: string;
  material_id: string | null;
  material_name: string;
  store_name: string;
  qty: string;
  total_price: number;
  receipt_status: ReceiptStatus;
  receipt_image_url: string | null;
  purchased_by: string | null;
  purchased_at: string;
}

export interface MaterialUsage {
  id: string;
  project_id: string | null;
  project_name: string;
  material_id: string | null;
  material_name: string;
  qty_used: string;
  used_for: string;
  logged_by: string | null;
  used_at: string;
}

export interface MaterialStock {
  id: string;
  material_name: string;
  current_stock: number;
  unit: string;
  updated_at: string;
}

export type PaymentType = 'purchase' | 'manual';

export interface Payment {
  id: string;
  payment_type: PaymentType;
  purchase_id: string | null;
  description: string;
  project_name: string;
  material_name: string | null;
  amount: number;
  paid_at: string;
  paid_by: string | null;
  created_at: string;
}

export interface PaymentJoined extends Payment {
  paid_by_name: string;
}

export interface UnpaidPurchase {
  id: string;
  project_name: string;
  material_name: string;
  store_name: string;
  qty: string;
  total_price: number;
  purchased_at: string;
}

// ---- Tipe gabungan (join) yang dipakai di UI ----

export interface RequestJoined {
  id: string;
  project_name: string;
  requester_id: string | null;
  material_name: string;
  requested_qty: string;
  notes: string | null;
  status: RequestStatus;
  is_flagged_duplicate: boolean;
  created_at: string;
  requester_name: string;
}

export interface PurchaseJoined {
  id: string;
  request_id: string | null;
  project_name: string;
  material_name: string;
  store_name: string;
  qty: string;
  total_price: number;
  paid: boolean;
  receipt_status: ReceiptStatus;
  receipt_image_url: string | null;
  purchased_by: string | null;
  purchased_at: string;
  receipt_url: string | null;
  purchased_by_name: string;
}

export interface UsageJoined {
  id: string;
  project_name: string;
  material_name: string;
  qty_used: string;
  used_for: string;
  logged_by: string | null;
  used_at: string;
  logged_by_name: string;
}
