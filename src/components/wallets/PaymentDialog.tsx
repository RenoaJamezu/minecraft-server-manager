import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, Trash2, Wallet, X } from "lucide-react";
import { formatCurrency } from "../../lib/formatters";
import type {
  PaymentAllocationInput,
  PaymentFormValues,
  PaymentPurpose,
  WalletPaymentResult,
  WalletPlayer,
} from "../../types/wallet";

interface PaymentDialogProps {
  player: WalletPlayer | null;
  players: WalletPlayer[];
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (
    values: PaymentFormValues,
  ) => Promise<{ error: string | null; result?: WalletPaymentResult }>;
}

interface AllocationDraft {
  id: string;
  player_id: string;
  amount: string;
  purpose: PaymentPurpose;
  description: string;
}

const getToday = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const toCents = (value: string | number) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
};

const createAllocation = (playerId: string): AllocationDraft => ({
  id: crypto.randomUUID(),
  player_id: playerId,
  amount: "",
  purpose: "membership",
  description: "",
});

const purposeLabel = (purpose: PaymentPurpose) => {
  if (purpose === "membership") return "Membership";
  if (purpose === "custom_title") return "Custom Title";
  return "Other";
};

export default function PaymentDialog({
  player,
  players,
  open,
  saving,
  onClose,
  onSubmit,
}: PaymentDialogProps) {
  const [payerId, setPayerId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(getToday());
  const [notes, setNotes] = useState("");
  const [allocations, setAllocations] = useState<AllocationDraft[]>([]);
  const [error, setError] = useState("");
  const [result, setResult] = useState<WalletPaymentResult | null>(null);

  useEffect(() => {
    if (open && player) {
      setPayerId(player.id);
      setAmount("");
      setPaymentDate(getToday());
      setNotes("");
      setAllocations([createAllocation(player.id)]);
      setError("");
      setResult(null);
    }
  }, [open, player?.id]);

  const numericAmount = Number(amount);
  const validAmount =
    Number.isFinite(numericAmount) &&
    numericAmount > 0 &&
    toCents(numericAmount) === numericAmount * 100;

  const allocatedCents = allocations.reduce(
    (sum, allocation) => sum + toCents(allocation.amount),
    0,
  );

  const totalCents = toCents(amount);
  const remainingCents = totalCents - allocatedCents;
  const overallocated = remainingCents < 0;

  const allocationErrors = useMemo(
    () =>
      allocations.map((allocation) => {
        const value = Number(allocation.amount);
        const cents = toCents(value);
        const selectedPlayer = players.find(
          (candidate) => candidate.id === allocation.player_id,
        );

        if (!allocation.player_id) return "Select a player.";
        if (!Number.isFinite(value) || value <= 0 || cents !== value * 100) {
          return "Enter a valid amount with up to two decimal places.";
        }

        if (allocation.purpose === "membership") {
          const feeCents = selectedPlayer
            ? toCents(selectedPlayer.monthly_fee)
            : 0;

          if (feeCents <= 0 || cents % feeCents !== 0) {
            return `Amount must be a complete number of monthly fees (${formatCurrency(selectedPlayer?.monthly_fee ?? 0)} each).`;
          }
        }

        return "";
      }),
    [allocations, players],
  );

  const allocationsValid =
    allocations.length > 0 && allocationErrors.every((message) => !message);

  const canSubmit =
    validAmount && allocationsValid && !overallocated && remainingCents >= 0;

  const updateAllocation = (
    id: string,
    field: keyof Omit<AllocationDraft, "id">,
    value: string,
  ) => {
    setAllocations((current) =>
      current.map((allocation) =>
        allocation.id === id ? { ...allocation, [field]: value } : allocation,
      ),
    );
  };

  const addAllocation = () => {
    const defaultPlayerId = player?.id ?? players[0]?.id ?? "";
    setAllocations((current) => [
      ...current,
      createAllocation(defaultPlayerId),
    ]);
  };

  const removeAllocation = (id: string) => {
    setAllocations((current) =>
      current.filter((allocation) => allocation.id !== id),
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!payerId) {
      setError("Select the person who made the payment.");
      return;
    }

    if (!validAmount) {
      setError("Enter a valid amount with up to two decimal places.");
      return;
    }

    if (!paymentDate) {
      setError("Payment date is required.");
      return;
    }

    if (!allocationsValid) {
      setError(
        allocationErrors.find(Boolean) || "Check the player allocations.",
      );
      return;
    }

    if (overallocated) {
      setError("The allocated amount cannot exceed the payment received.");
      return;
    }

    const values: PaymentFormValues = {
      payer_player_id: payerId,
      amount,
      payment_date: paymentDate,
      notes,
      allocations: allocations.map(
        (allocation): PaymentAllocationInput => ({
          player_id: allocation.player_id,
          amount: Number(allocation.amount),
          purpose: allocation.purpose,
          description: allocation.description.trim() || null,
        }),
      ),
    };

    const response = await onSubmit(values);

    if (response.error) {
      setError(response.error);
      return;
    }

    if (response.result) {
      setResult(response.result);
    }
  };

  if (!open || !player) return null;

  const getPlayerName = (playerId: string) =>
    players.find((candidate) => candidate.id === playerId)
      ?.minecraft_username ?? "Unknown player";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111114] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <Wallet size={19} className="text-emerald-400" />
              <h2 className="text-base font-semibold text-white">
                Record Payment
              </h2>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Record cash received and allocate it to players.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close dialog"
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {result ? (
          <div className="space-y-5 overflow-y-auto p-5">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
              <p className="text-sm font-medium text-emerald-400">
                Payment recorded successfully
              </p>
              <p className="mt-1 text-2xl font-semibold text-white">
                {formatCurrency(result.total_received)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Payment ID: {result.payment_id}
              </p>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-white">
                Allocation results
              </h3>

              <div className="space-y-3">
                {result.allocations.map((allocation) => (
                  <div
                    key={allocation.id}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">
                          {getPlayerName(allocation.player_id)}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {purposeLabel(allocation.purpose)}
                          {allocation.description
                            ? ` · ${allocation.description}`
                            : ""}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-white">
                        {formatCurrency(allocation.amount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 border-t border-white/[0.06] pt-4 text-sm">
              <div className="flex justify-between text-zinc-400">
                <span>Total allocated</span>
                <span className="text-white">
                  {formatCurrency(result.total_allocated)}
                </span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Credited to payer's wallet</span>
                <span className="font-medium text-emerald-400">
                  {formatCurrency(result.wallet_credited)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="h-10 w-full rounded-lg bg-emerald-500 text-sm font-semibold text-black transition hover:bg-emerald-400"
            >
              Done
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-5 overflow-y-auto p-5"
          >
            <div>
              <label className="mb-1.5 block text-sm text-zinc-300">
                Paid by
              </label>
              <select
                value={payerId}
                onChange={(event) => setPayerId(event.target.value)}
                required
                className="h-11 w-full rounded-lg border border-white/[0.08] bg-[#09090b] px-3 text-sm text-white outline-none focus:border-emerald-500/50"
              >
                <option value="">Select payer</option>
                {players.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.minecraft_username}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-zinc-300">
                Total payment received (₱)
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                required
                autoFocus
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                className="h-11 w-full rounded-lg border border-white/[0.08] bg-[#09090b] px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-emerald-500/50"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Payment allocations
                  </h3>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Add one or more purposes for any player.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addAllocation}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.05]"
                >
                  <Plus size={14} />
                  Add allocation
                </button>
              </div>

              <div className="space-y-3">
                {allocations.map((allocation, index) => {
                  const selectedPlayer = players.find(
                    (candidate) => candidate.id === allocation.player_id,
                  );

                  return (
                    <div
                      key={allocation.id}
                      className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs font-medium text-zinc-400">
                          Allocation {index + 1}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeAllocation(allocation.id)}
                          disabled={allocations.length === 1}
                          aria-label="Remove allocation"
                          className="rounded-md p-1.5 text-zinc-500 transition hover:bg-rose-500/10 hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-xs text-zinc-400">
                            Player
                          </label>
                          <select
                            value={allocation.player_id}
                            onChange={(event) =>
                              updateAllocation(
                                allocation.id,
                                "player_id",
                                event.target.value,
                              )
                            }
                            required
                            className="h-10 w-full rounded-lg border border-white/[0.08] bg-[#09090b] px-3 text-sm text-white outline-none focus:border-emerald-500/50"
                          >
                            <option value="">Select player</option>
                            {players.map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>
                                {candidate.minecraft_username}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs text-zinc-400">
                            Purpose
                          </label>
                          <select
                            value={allocation.purpose}
                            onChange={(event) =>
                              updateAllocation(
                                allocation.id,
                                "purpose",
                                event.target.value as PaymentPurpose,
                              )
                            }
                            className="h-10 w-full rounded-lg border border-white/[0.08] bg-[#09090b] px-3 text-sm text-white outline-none focus:border-emerald-500/50"
                          >
                            <option value="membership">Membership</option>
                            <option value="custom_title">Custom Title</option>
                            <option value="other">Other</option>
                          </select>
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs text-zinc-400">
                            Amount (₱)
                          </label>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            inputMode="decimal"
                            value={allocation.amount}
                            onChange={(event) =>
                              updateAllocation(
                                allocation.id,
                                "amount",
                                event.target.value,
                              )
                            }
                            placeholder="0.00"
                            required
                            className="h-10 w-full rounded-lg border border-white/[0.08] bg-[#09090b] px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-emerald-500/50"
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs text-zinc-400">
                            Description (optional)
                          </label>
                          <input
                            value={allocation.description}
                            onChange={(event) =>
                              updateAllocation(
                                allocation.id,
                                "description",
                                event.target.value,
                              )
                            }
                            placeholder={
                              allocation.purpose === "custom_title"
                                ? "Title name"
                                : allocation.purpose === "other"
                                  ? "What is this for?"
                                  : "Optional note"
                            }
                            className="h-10 w-full rounded-lg border border-white/[0.08] bg-[#09090b] px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-emerald-500/50"
                          />
                        </div>
                      </div>

                      {allocationErrors[index] && (
                        <p className="mt-2 text-xs text-rose-400">
                          {allocationErrors[index]}
                        </p>
                      )}

                      {allocation.purpose === "membership" &&
                        selectedPlayer && (
                          <p className="mt-2 text-xs text-zinc-500">
                            Monthly fee:{" "}
                            {formatCurrency(selectedPlayer.monthly_fee)}
                          </p>
                        )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Payment received</span>
                <span className="font-medium text-white">
                  {formatCurrency(totalCents / 100)}
                </span>
              </div>

              <div className="mt-2 flex justify-between text-sm">
                <span className="text-zinc-400">Total allocated</span>
                <span className="font-medium text-white">
                  {formatCurrency(allocatedCents / 100)}
                </span>
              </div>

              <div className="mt-2 flex justify-between border-t border-white/[0.06] pt-2 text-sm">
                <span className="text-zinc-400">
                  {overallocated
                    ? "Amount overallocated"
                    : "Credit to payer's wallet"}
                </span>
                <span
                  className={`font-semibold ${
                    overallocated ? "text-rose-400" : "text-emerald-400"
                  }`}
                >
                  {formatCurrency(Math.abs(remainingCents) / 100)}
                </span>
              </div>

              {validAmount && !overallocated && (
                <p className="mt-2 text-xs text-emerald-400">
                  Unallocated cash will be credited to the payer's wallet.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm text-zinc-300">
                  Payment date
                </label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(event) => setPaymentDate(event.target.value)}
                  className="h-11 w-full rounded-lg border border-white/[0.08] bg-[#09090b] px-3 text-sm text-white outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-zinc-300">
                  Payment notes
                </label>
                <input
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional"
                  className="h-11 w-full rounded-lg border border-white/[0.08] bg-[#09090b] px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-emerald-500/50"
                />
              </div>
            </div>

            {error && (
              <p className="rounded-lg border border-rose-500/20 bg-rose-500/[0.06] p-3 text-sm text-rose-400">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 border-t border-white/[0.06] pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="h-10 rounded-lg border border-white/[0.08] px-4 text-sm text-zinc-300 transition hover:bg-white/[0.05] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !canSubmit}
                className="h-10 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Recording..." : "Confirm Payment"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
