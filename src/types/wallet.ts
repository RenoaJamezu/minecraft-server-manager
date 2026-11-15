export interface WalletPlayer {
  id: string;
  minecraft_username: string;
  discord_username: string | null;
  monthly_fee: number;
  status: "active" | "inactive";
  balance: number;
}

export type WalletFilter = "all" | "positive" | "zero" | "negative";

export type PaymentPurpose = "membership" | "custom_title" | "other";

export interface WalletHistoryEntry {
  id: string;
  kind: "payment" | "transaction";
  date: string;
  amount: number;
  description: string | null;
  payer_username?: string;
  allocated_amount?: number;
  purpose?: PaymentPurpose;
  transaction_type?: string;
}

export interface PaymentAllocationInput {
  player_id: string;
  amount: number;
  purpose: PaymentPurpose;
  description: string | null;
}

export interface PaymentAllocationResult {
  id: string;
  player_id: string;
  purpose: PaymentPurpose;
  description: string | null;
  amount: number;
}

export interface WalletPaymentResult {
  success: boolean;
  payment_id: string;
  total_received: number;
  total_allocated: number;
  wallet_credited: number;
  allocations: PaymentAllocationResult[];
}

export interface PaymentFormValues {
  payer_player_id: string;
  amount: string;
  payment_date: string;
  notes: string;
  allocations: PaymentAllocationInput[];
}

export interface WalletSpendAllocationInput {
  amount: number;
  purpose: PaymentPurpose;
  description: string | null;
}

export interface WalletSpendFormValues {
  player_id: string;
  allocations: WalletSpendAllocationInput[];
}

export interface WalletSpendAllocationResult {
  wallet_transaction_id: string;
  purpose: PaymentPurpose;
  description: string | null;
  amount: number;
}

export interface WalletSpendResult {
  success: boolean;
  player_id: string;
  total_spent: number;
  balance_before: number;
  balance_after: number;
  allocations: WalletSpendAllocationResult[];
}

export interface WalletWithdrawalResult {
  success: boolean;
  transaction_id: string;
  player_id: string;
  withdrawn_amount: number;
  balance_before: number;
  balance_after: number;
}

export interface WalletWithdrawalFormValues {
  player_id: string;
  amount: number;
  description: string | null;
}
