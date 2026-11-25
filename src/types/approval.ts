export type ApprovalStatus = "pending" | "approved" | "rejected";

export type ApprovalFilter = "all" | ApprovalStatus;

export interface ApprovalRequest {
  id: string;
  server_id: string;
  request_type: string;
  payload: Record<string, unknown>;
  status: ApprovalStatus;
  submitter_user_id: string;
  submitter_label: string | null;
  reviewer_user_id: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  applied_result: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface PlayerRecord {
  id: string;
  minecraft_username: string;
}

export interface PaymentAllocation {
  id?: string;
  player_id?: string;
  amount?: number;
  purpose?: string;
  description?: string | null;
}
