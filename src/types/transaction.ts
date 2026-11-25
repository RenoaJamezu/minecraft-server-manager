
export type TransactionKind = "income" | "expense";

export type TransactionFilter = "all" | TransactionKind;

export interface Transaction {
  id: string;
  player?: string | null;
  description: string;
  category: string;
  amount: number;
  date: string;
  kind: TransactionKind;
  isReversed?: boolean;
  reversedAt?: string | null;
  reversalReason?: string | null;
}
