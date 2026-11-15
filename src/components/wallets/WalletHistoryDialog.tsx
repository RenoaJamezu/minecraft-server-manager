import { useEffect } from "react";
import { X } from "lucide-react";
import { formatCurrency } from "../../lib/formatters";
import type {
  PaymentPurpose,
  WalletHistoryEntry,
  WalletPlayer,
} from "../../types/wallet";

interface WalletHistoryDialogProps {
  player: WalletPlayer | null;
  open: boolean;
  loading: boolean;
  transactions: WalletHistoryEntry[];
  onClose: () => void;
  onLoad: (playerId: string) => void;
}

const formatDate = (value: string) => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    ...(value.includes("T") ? { timeStyle: "short" as const } : {}),
  }).format(date);
};

const getTransactionLabel = (type: string) => {
  const labels: Record<string, string> = {
    top_up: "Wallet top-up",
    monthly_fee: "Monthly fee",
    purchase: "Purchase",
    dues_settlement: "Dues settlement",
    adjustment: "Adjustment",
    refund: "Refund",
    wallet_credit: "Wallet credit",
    wallet_spend: "Wallet spend",
    withdrawal: "Wallet withdrawal",
  };

  return labels[type] ?? type.replaceAll("_", " ");
};

const getPurposeLabel = (purpose?: PaymentPurpose) => {
  if (purpose === "membership") return "Membership";
  if (purpose === "custom_title") return "Custom Title";
  if (purpose === "other") return "Other";
  return "Payment";
};

export default function WalletHistoryDialog({
  player,
  open,
  loading,
  transactions,
  onClose,
  onLoad,
}: WalletHistoryDialogProps) {
  useEffect(() => {
    if (open && player) {
      onLoad(player.id);
    }
  }, [open, player?.id, onLoad]);

  if (!open || !player) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111114] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">
              Wallet & Payment History
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              {player.minecraft_username} · Current balance{" "}
              {formatCurrency(player.balance)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close history"
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-white/[0.05] hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          {loading ? (
            <p className="py-10 text-center text-sm text-zinc-500">
              Loading payment history...
            </p>
          ) : transactions.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-white">
                No payment history yet
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                Payments and wallet transactions will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                >
                  {transaction.kind === "payment" ? (
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-white">
                            {getPurposeLabel(transaction.purpose)}
                          </p>
                          <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-400">
                            Payment
                          </span>
                        </div>

                        <p className="mt-1 text-xs text-zinc-500">
                          Paid by {transaction.payer_username}
                        </p>

                        {transaction.description && (
                          <p className="mt-1 text-xs text-zinc-500">
                            {transaction.description}
                          </p>
                        )}
                      </div>

                      <div className="sm:text-right">
                        <p className="font-semibold text-emerald-400">
                          +{formatCurrency(transaction.allocated_amount ?? 0)}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {formatDate(transaction.date)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                      <div>
                        <p className="font-medium capitalize text-white">
                          {getTransactionLabel(
                            transaction.transaction_type ?? "transaction",
                          )}
                        </p>

                        {transaction.description && (
                          <p className="mt-1 text-xs text-zinc-500">
                            {transaction.description}
                          </p>
                        )}

                        <p className="mt-1 text-xs text-zinc-500">
                          {formatDate(transaction.date)}
                        </p>
                      </div>

                      <p
                        className={`font-semibold ${
                          transaction.amount > 0
                            ? "text-emerald-400"
                            : "text-rose-400"
                        }`}
                      >
                        {transaction.amount > 0 ? "+" : ""}
                        {formatCurrency(transaction.amount)}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
