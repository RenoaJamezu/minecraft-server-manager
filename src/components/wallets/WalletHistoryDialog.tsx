
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, RotateCcw, X } from "lucide-react";
import { formatCurrency } from "../../lib/formatters";
import type {
  PaymentPurpose,
  WalletHistoryEntry,
  WalletPlayer,
} from "../../types/wallet";

type ReversalAction =
  | {
      type: "wallet";
      transactionId: string;
    }
  | {
      type: "payment";
      paymentId: string;
    };

interface WalletHistoryDialogProps {
  player: WalletPlayer | null;
  open: boolean;
  loading: boolean;
  saving: boolean;
  canReversePayments: boolean;
  transactions: WalletHistoryEntry[];
  onClose: () => void;
  onLoad: (playerId: string) => void;
  onReverse: (
    transactionId: string,
    reason: string,
  ) => Promise<{ error: string | null }>;
  onReversePayment: (
    paymentId: string,
    reason: string,
  ) => Promise<{ error: string | null }>;
}

const formatDate = (value: string) => {
  if (!value) return "—";

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = isDateOnly
    ? new Date(`${value}T00:00:00+08:00`)
    : new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
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
  saving,
  canReversePayments,
  transactions,
  onClose,
  onLoad,
  onReverse,
  onReversePayment,
}: WalletHistoryDialogProps) {
  const [selectedAction, setSelectedAction] = useState<ReversalAction | null>(
    null,
  );
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (open && player) {
      onLoad(player.id);
    }
  }, [open, player?.id, onLoad]);

  useEffect(() => {
    setSelectedAction(null);
    setReason("");
    setActionError("");
  }, [open, player?.id]);

  if (!open || !player) return null;

  const startReversal = (action: ReversalAction) => {
    setSelectedAction(action);
    setReason("");
    setActionError("");
  };

  const handleReverse = async () => {
    if (!selectedAction) return;

    const trimmedReason = reason.trim();

    if (trimmedReason.length < 3 || trimmedReason.length > 1000) {
      setActionError("Enter a reason between 3 and 1000 characters.");
      return;
    }

    setActionError("");

    const result =
      selectedAction.type === "wallet"
        ? await onReverse(selectedAction.transactionId, trimmedReason)
        : await onReversePayment(selectedAction.paymentId, trimmedReason);

    if (result.error) {
      setActionError(result.error);
      return;
    }

    setSelectedAction(null);
    setReason("");
    setActionError("");
  };

  const cancelReverse = () => {
    if (saving) return;

    setSelectedAction(null);
    setReason("");
    setActionError("");
  };

  const getActionTitle = () => {
    if (!selectedAction) return "";

    return selectedAction.type === "wallet"
      ? "Reverse wallet transaction"
      : "Reverse entire payment";
  };

  const getActionWarning = () => {
    if (!selectedAction) return "";

    return selectedAction.type === "wallet"
      ? "This will create a compensating wallet refund and reverse linked income. The original transaction will remain in the history."
      : "This will reverse every allocation belonging to this cash payment, along with related cash-change wallet credits and income entries. This affects the payer and all beneficiaries.";
  };

  const getConfirmLabel = () => {
    if (!selectedAction) return "Confirm reversal";

    return selectedAction.type === "wallet"
      ? "Confirm reversal"
      : "Reverse entire payment";
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111114] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">
              Wallet History
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
              Loading wallet history...
            </p>
          ) : transactions.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-white">
                No wallet history yet
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                Payment allocations and wallet movements will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => {
                const isPayment = transaction.kind === "payment";

                const category = isPayment
                  ? getPurposeLabel(transaction.purpose)
                  : getTransactionLabel(
                      transaction.transaction_type ?? "transaction",
                    );

                const amount = isPayment
                  ? (transaction.allocated_amount ?? 0)
                  : transaction.amount;

                const canReverseWallet =
                  canReversePayments &&
                  !isPayment &&
                  transaction.transaction_type === "wallet_spend" &&
                  amount < 0 &&
                  transaction.payment_id == null &&
                  Boolean(transaction.wallet_transaction_id) &&
                  !transaction.is_reversed;

                const canReverseEntirePayment =
                  canReversePayments &&
                  isPayment &&
                  Boolean(transaction.payment_id) &&
                  !transaction.is_payment_reversed;

                const isConfirmingWallet =
                  selectedAction?.type === "wallet" &&
                  selectedAction.transactionId ===
                    transaction.wallet_transaction_id;

                const isConfirmingPayment =
                  selectedAction?.type === "payment" &&
                  selectedAction.paymentId === transaction.payment_id;

                const isConfirming =
                  isConfirmingWallet || isConfirmingPayment;

                return (
                  <div
                    key={transaction.id}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-white">{category}</p>

                          {isPayment && (
                            <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-400">
                              Payment
                            </span>
                          )}

                          {transaction.is_reversed && (
                            <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-400">
                              Reversed
                            </span>
                          )}
                        </div>

                        {isPayment && transaction.payer_username && (
                          <p className="mt-1 text-xs text-zinc-500">
                            Paid by {transaction.payer_username}
                          </p>
                        )}

                        {transaction.description && (
                          <p className="mt-1 break-words text-xs text-zinc-500">
                            {transaction.description}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 text-right">
                        <p
                          className={`font-semibold ${
                            amount > 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {amount > 0 ? "+" : ""}
                          {formatCurrency(amount)}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {formatDate(transaction.date)}
                        </p>
                      </div>
                    </div>

                    {!isConfirming && (
                      <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-white/[0.06] pt-3">
                        {canReverseWallet && (
                          <button
                            type="button"
                            onClick={() =>
                              startReversal({
                                type: "wallet",
                                transactionId:
                                  transaction.wallet_transaction_id!,
                              })
                            }
                            disabled={saving}
                            className="inline-flex items-center gap-2 rounded-lg border border-rose-500/20 px-3 py-2 text-xs font-medium text-rose-300 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <RotateCcw size={13} />
                            Reverse transaction
                          </button>
                        )}

                        {canReverseEntirePayment && (
                          <button
                            type="button"
                            onClick={() =>
                              startReversal({
                                type: "payment",
                                paymentId: transaction.payment_id!,
                              })
                            }
                            disabled={saving}
                            className="inline-flex items-center gap-2 rounded-lg border border-amber-500/20 px-3 py-2 text-xs font-medium text-amber-300 transition hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <RotateCcw size={13} />
                            Reverse entire payment
                          </button>
                        )}
                      </div>
                    )}

                    {isConfirming && (
                      <div className="mt-4 space-y-3 border-t border-white/[0.06] pt-4">
                        <div className="flex items-start gap-2 text-amber-400">
                          <AlertTriangle
                            size={16}
                            className="mt-0.5 shrink-0"
                          />
                          <div>
                            <p className="text-xs font-semibold">
                              {getActionTitle()}
                            </p>
                            <p className="mt-1 text-xs leading-relaxed">
                              {getActionWarning()}
                            </p>
                          </div>
                        </div>

                        <div>
                          <label
                            htmlFor={`reversal-reason-${transaction.id}`}
                            className="mb-1.5 block text-xs font-medium text-zinc-300"
                          >
                            Reversal reason
                          </label>
                          <textarea
                            id={`reversal-reason-${transaction.id}`}
                            value={reason}
                            onChange={(event) => {
                              setReason(event.target.value);
                              setActionError("");
                            }}
                            maxLength={1000}
                            rows={3}
                            disabled={saving}
                            placeholder="Explain why this transaction is being reversed..."
                            className="w-full resize-y rounded-lg border border-white/[0.08] bg-[#18181b] px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-rose-500/50 disabled:opacity-50"
                          />
                          <p className="mt-1 text-right text-[11px] text-zinc-600">
                            {reason.trim().length}/1000 characters (minimum 3)
                          </p>
                        </div>

                        {actionError && (
                          <p className="text-xs text-rose-400">{actionError}</p>
                        )}

                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={cancelReverse}
                            disabled={saving}
                            className="rounded-lg border border-white/[0.08] px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.05] disabled:opacity-50"
                          >
                            Cancel
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleReverse()}
                            disabled={saving || reason.trim().length < 3}
                            className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <CheckCircle2 size={14} />
                            {saving ? "Reversing..." : getConfirmLabel()}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
