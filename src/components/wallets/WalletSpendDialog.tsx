import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, Plus, Trash2, Wallet, X } from "lucide-react";
import { formatCurrency } from "../../lib/formatters";
import type {
  PaymentPurpose,
  WalletPlayer,
  WalletSpendFormValues,
  WalletSpendResult,
} from "../../types/wallet";

interface WalletSpendDialogProps {
  player: WalletPlayer | null;
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (
    values: WalletSpendFormValues,
  ) => Promise<{ error: string | null; result?: WalletSpendResult }>;
}

interface AllocationDraft {
  id: string;
  amount: string;
  purpose: PaymentPurpose;
  description: string;
}

const createAllocation = (): AllocationDraft => ({
  id: crypto.randomUUID(),
  amount: "",
  purpose: "membership",
  description: "",
});

const toCents = (value: number) => Math.round(value * 100);

const purposeLabels: Record<PaymentPurpose, string> = {
  membership: "Membership",
  custom_title: "Custom Title",
  other: "Other",
};

export default function WalletSpendDialog({
  player,
  open,
  saving,
  onClose,
  onSubmit,
}: WalletSpendDialogProps) {
  const [allocations, setAllocations] = useState<AllocationDraft[]>([
    createAllocation(),
  ]);
  const [error, setError] = useState("");
  const [result, setResult] = useState<WalletSpendResult | null>(null);

  useEffect(() => {
    if (open) {
      setAllocations([createAllocation()]);
      setError("");
      setResult(null);
    }
  }, [open, player?.id]);

  const totalCents = useMemo(
    () =>
      allocations.reduce((total, allocation) => {
        const amount = Number(allocation.amount);

        return Number.isFinite(amount) && amount > 0
          ? total + toCents(amount)
          : total;
      }, 0),
    [allocations],
  );

  const balanceCents = toCents(player?.balance ?? 0);
  const remainingCents = balanceCents - totalCents;

  const updateAllocation = (id: string, updates: Partial<AllocationDraft>) => {
    setAllocations((current) =>
      current.map((allocation) =>
        allocation.id === id ? { ...allocation, ...updates } : allocation,
      ),
    );
    setError("");
  };

  const addAllocation = () => {
    setAllocations((current) => [...current, createAllocation()]);
  };

  const removeAllocation = (id: string) => {
    setAllocations((current) =>
      current.length > 1
        ? current.filter((allocation) => allocation.id !== id)
        : current,
    );
    setError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!player) {
      setError("Player not found. Close this dialog and try again.");
      return;
    }

    if (!allocations.length) {
      setError("Add at least one allocation.");
      return;
    }

    const parsedAllocations: WalletSpendFormValues["allocations"] = [];

    for (const allocation of allocations) {
      const amount = Number(allocation.amount);
      const amountCents = toCents(amount);

      if (
        !Number.isFinite(amount) ||
        amount <= 0 ||
        amountCents !== amount * 100
      ) {
        setError("Enter a valid amount with at most two decimal places.");
        return;
      }

      if (allocation.purpose === "membership") {
        const monthlyFeeCents = toCents(player.monthly_fee);

        if (monthlyFeeCents <= 0 || amountCents % monthlyFeeCents !== 0) {
          setError(
            `Membership spending must be a complete number of monthly fees (${formatCurrency(player.monthly_fee)} each).`,
          );
          return;
        }
      }

      parsedAllocations.push({
        amount,
        purpose: allocation.purpose,
        description: allocation.description.trim() || null,
      });
    }

    const submittedTotalCents = parsedAllocations.reduce(
      (total, allocation) => total + toCents(allocation.amount),
      0,
    );

    if (submittedTotalCents > balanceCents) {
      setError(
        "The total spending cannot exceed the available wallet balance.",
      );
      return;
    }

    const response = await onSubmit({
      player_id: player.id,
      allocations: parsedAllocations,
    });

    if (response.error) {
      setError(response.error);
      return;
    }

    if (!response.result) {
      setError("The wallet spending could not be confirmed.");
      return;
    }

    setResult(response.result);
  };

  if (!open || !player) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-spend-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111114] shadow-2xl"
      >
        {/* Sticky header: stays visible while content scrolls */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <Wallet size={19} className="text-emerald-400" />
              <h2
                id="wallet-spend-title"
                className="text-base font-semibold text-white"
              >
                Pay with Wallet
              </h2>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Spend from {player.minecraft_username}'s wallet.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close dialog"
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {result ? (
          <div className="space-y-5 overflow-y-auto overscroll-contain p-5">
            <div className="flex flex-col items-center text-center">
              <CheckCircle2 size={42} className="text-emerald-400" />
              <h3 className="mt-3 text-lg font-semibold text-white">
                Wallet payment successful
              </h3>
              <p className="mt-1 text-sm text-zinc-500">
                The wallet spending has been recorded.
              </p>
              <p className="mt-4 text-3xl font-semibold text-emerald-400">
                {formatCurrency(result.total_spent)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">Total spent</p>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-zinc-500">Previous balance</span>
                <span className="text-white">
                  {formatCurrency(result.balance_before)}
                </span>
              </div>
              <div className="mt-3 flex justify-between gap-4 text-sm">
                <span className="text-zinc-500">Remaining balance</span>
                <span className="font-semibold text-emerald-400">
                  {formatCurrency(result.balance_after)}
                </span>
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-medium text-white">
                Payment breakdown
              </p>
              <div className="space-y-2">
                {result.allocations.map((allocation) => (
                  <div
                    key={allocation.wallet_transaction_id}
                    className="flex items-start justify-between gap-4 rounded-lg bg-white/[0.03] px-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-200">
                        {purposeLabels[allocation.purpose]}
                      </p>
                      {allocation.description && (
                        <p className="mt-1 break-words text-xs text-zinc-500">
                          {allocation.description}
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 text-sm font-medium text-white">
                      {formatCurrency(allocation.amount)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="h-11 w-full rounded-lg bg-emerald-500 text-sm font-semibold text-black transition hover:bg-emerald-400"
            >
              Done
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-5 overflow-y-auto overscroll-contain p-5"
          >
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-400">
                Available wallet balance
              </p>
              <p className="mt-1 text-2xl font-semibold text-white">
                {formatCurrency(player.balance)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Monthly membership fee: {formatCurrency(player.monthly_fee)}
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Spending allocations
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    Choose what this wallet payment is for.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addAllocation}
                  disabled={saving}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] px-3 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
                >
                  <Plus size={14} />
                  Add allocation
                </button>
              </div>

              {allocations.map((allocation, index) => (
                <div
                  key={allocation.id}
                  className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-zinc-400">
                      Allocation {index + 1}
                    </p>

                    {allocations.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAllocation(allocation.id)}
                        disabled={saving}
                        aria-label={`Remove allocation ${index + 1}`}
                        className="rounded-md p-1.5 text-zinc-500 transition hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-50"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium text-zinc-400">
                        Purpose
                      </span>
                      <select
                        value={allocation.purpose}
                        onChange={(event) =>
                          updateAllocation(allocation.id, {
                            purpose: event.target.value as PaymentPurpose,
                          })
                        }
                        disabled={saving}
                        className="h-10 w-full rounded-lg border border-white/[0.08] bg-[#09090b] px-3 text-sm text-white outline-none transition focus:border-emerald-500/50"
                      >
                        <option value="membership">Membership</option>
                        <option value="custom_title">Custom Title</option>
                        <option value="other">Other</option>
                      </select>
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-xs font-medium text-zinc-400">
                        Amount
                      </span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        inputMode="decimal"
                        value={allocation.amount}
                        onChange={(event) =>
                          updateAllocation(allocation.id, {
                            amount: event.target.value,
                          })
                        }
                        disabled={saving}
                        placeholder="0.00"
                        className="h-10 w-full rounded-lg border border-white/[0.08] bg-[#09090b] px-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-500/50"
                      />
                    </label>
                  </div>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-zinc-400">
                      Description{" "}
                      <span className="text-zinc-600">(optional)</span>
                    </span>
                    <input
                      type="text"
                      value={allocation.description}
                      onChange={(event) =>
                        updateAllocation(allocation.id, {
                          description: event.target.value,
                        })
                      }
                      disabled={saving}
                      maxLength={250}
                      placeholder={
                        allocation.purpose === "custom_title"
                          ? "Enter the custom title"
                          : allocation.purpose === "other"
                            ? "Describe this payment"
                            : "Optional membership note"
                      }
                      className="h-10 w-full rounded-lg border border-white/[0.08] bg-[#09090b] px-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-500/50"
                    />
                  </label>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-zinc-500">Total spending</span>
                <span className="font-semibold text-white">
                  {formatCurrency(totalCents / 100)}
                </span>
              </div>

              <div className="mt-3 flex justify-between gap-4 text-sm">
                <span className="text-zinc-500">Remaining after payment</span>
                <span
                  className={`font-semibold ${
                    remainingCents < 0 ? "text-rose-400" : "text-emerald-400"
                  }`}
                >
                  {formatCurrency(remainingCents / 100)}
                </span>
              </div>

              {remainingCents < 0 && (
                <p className="mt-2 text-xs text-rose-400">
                  Your allocations exceed the available wallet balance.
                </p>
              )}
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-rose-500/20 bg-rose-500/[0.06] px-4 py-3 text-sm text-rose-400"
              >
                {error}
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 border-t border-white/[0.06] pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="h-10 rounded-lg border border-white/[0.08] px-4 text-sm text-zinc-300 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  saving || totalCents <= 0 || totalCents > balanceCents
                }
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-5 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Processing..." : "Confirm Wallet Payment"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
