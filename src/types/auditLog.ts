export interface AuditLog {
  id: string;
  server_id: string;
  actor_user_id: string | null;
  actor_label: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface ApprovalRequest {
  id: string;
  submitter_label: string | null;
  request_type: string;
  rejection_reason: string | null;
  status: string;
}

export interface PlayerRecord {
  id: string;
  minecraft_username: string;
}

export interface PaymentAllocation {
  player_id?: string;
  amount?: number;
  purpose?: string;
  description?: string | null;
}

export interface AppliedResult {
  success?: boolean;
  player_id?: string;
  payment_id?: string;
  total_received?: number;
  total_allocated?: number;
  wallet_credited?: number;
  allocations?: PaymentAllocation[];
}
