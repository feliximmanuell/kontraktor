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

export interface ProjectStock {
  id: string;
  project_id: string;
  material_id: string;
  current_stock: number;
  updated_at: string;
}

export interface MaterialRequest {
  id: string;
  project_id: string;
  requester_id: string;
  material_id: string;
  requested_qty: number;
  notes: string | null;
  status: RequestStatus;
  is_flagged_duplicate: boolean;
  created_at: string;
}

export interface Purchase {
  id: string;
  request_id: string | null;
  project_id: string;
  material_id: string;
  store_name: string;
  qty: number;
  unit_price: number;
  total_price: number;
  receipt_status: ReceiptStatus;
  receipt_image_url: string | null;
  purchased_by: string | null;
  purchased_at: string;
}

export interface MaterialUsage {
  id: string;
  project_id: string;
  material_id: string;
  qty_used: number;
  used_for: string;
  logged_by: string | null;
  used_at: string;
}

// ---- Tipe gabungan (join) yang dipakai di UI ----

export interface RequestJoined {
  id: string;
  project_id: string;
  requester_id: string;
  material_id: string;
  requested_qty: number;
  notes: string | null;
  status: RequestStatus;
  is_flagged_duplicate: boolean;
  created_at: string;
  projects: { name: string; location: string | null } | null;
  materials: { name: string; unit: string } | null;
  requester_name: string;
  current_stock: number;
}

export interface PurchaseJoined {
  id: string;
  request_id: string | null;
  project_id: string;
  material_id: string;
  store_name: string;
  qty: number;
  unit_price: number;
  total_price: number;
  receipt_status: ReceiptStatus;
  receipt_image_url: string | null;
  purchased_by: string | null;
  purchased_at: string;
  receipt_url: string | null;
  projects: { name: string; location: string | null } | null;
  materials: { name: string; unit: string } | null;
  purchased_by_name: string;
}

export interface StockJoined {
  id: string;
  project_id: string;
  material_id: string;
  current_stock: number;
  updated_at: string;
  projects: { name: string; location: string | null } | null;
  materials: { name: string; unit: string } | null;
}

export interface UsageJoined {
  id: string;
  project_id: string;
  material_id: string;
  qty_used: number;
  used_for: string;
  logged_by: string | null;
  used_at: string;
  projects: { name: string; location: string | null } | null;
  materials: { name: string; unit: string } | null;
  logged_by_name: string;
}
