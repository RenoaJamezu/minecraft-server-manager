import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, PlusCircle, X } from "lucide-react";
import { formatCurrency } from "../../lib/formatters";
import type {
  WalletPlayer,
  WalletTopUpFormValues,
  WalletTopUpResult,
} from "../../types/wallet";

interface WalletTopUpDialogProps {
  player: WalletPlayer | null;
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (
    values: WalletTopUpFormValues,
  ) => Promise<{ error: string | null; result?: WalletTopUpResult }>;
}

export default function WalletTopUpDialog({
  player,
  open,
  saving,
  onClose,
  onSubmit,
}: WalletTopUpDialogProps) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<WalletTopUpResult | null>(null);

  useEffect(() => {
    if (open) {
      setAmount("");
      setDescription("");
      setError("");
      setResult(null);
    }
  }, [open, player?.id]);

  if (!open || !player) return null;

  const amountValue = Number(amount);
  const amountCents = Math.round(amountValue * 100);
  const validAmount =
    amount.trim() !== "" &&
    Number.isFinite(amountValue) &&
    amountValue > 0 &&
    amountCents === amountValue * 100;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!validAmount) {
      setError("Enter a valid amount with at most two decimal places.");
      return;
    }

    const response = await onSubmit({
      player_id: player.id,
      amount: amountValue,
      description: description.trim() || null,
    });

    if (response.error) {
      setError(response.error);
      return;
    }

    if (!response.result) {
      setError("The wallet top-up could not be confirmed.");
      return;
    }

    setResult(response.result);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-top-up-title"
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111114] shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <PlusCircle size={19} className="text-emerald-400" />
              <h2
                id="wallet-top-up-title"
                className="text-base font-semibold text-white"
              >
                Add Wallet Balance
              </h2>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Manually add funds to {player.minecraft_username}'s wallet.
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
          <div className="space-y-5 overflow-y-auto p-5">
            <div className="flex flex-col items-center text-center">
              <CheckCircle2 size={42} className="text-emerald-400" />
              <h3 className="mt-3 text-lg font-semibold text-white">
                Balance added successfully
              </h3>
              <p className="mt-1 text-sm text-zinc-500">
                The wallet top-up has been recorded.
              </p>
              <p className="mt-4 text-3xl font-semibold text-emerald-400">
                +{formatCurrency(result.amount_added)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">Amount added</p>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-zinc-500">Previous balance</span>
                <span className="text-white">
                  {formatCurrency(result.balance_before)}
                </span>
              </div>
              <div className="mt-3 flex justify-between gap-4 text-sm">
                <span className="text-zinc-500">New balance</span>
                <span className="font-semibold text-emerald-400">
                  {formatCurrency(result.balance_after)}
                </span>
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
            className="space-y-5 overflow-y-auto p-5"
          >
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Current wallet balance
              </p>
              <p className="mt-1 text-2xl font-semibold text-white">
                {formatCurrency(player.balance)}
              </p>
            </div>

            <label className="block space-y-2">
              <span className="text-xs font-medium text-zinc-400">
                Amount to add
              </span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setError("");
                }}
                disabled={saving}
                placeholder="0.00"
                required
                className="h-11 w-full rounded-lg border border-white/[0.08] bg-[#09090b] px-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-500/50"
              />
              <p className="text-xs text-zinc-500">
                Enter a positive amount with up to two decimal places.
              </p>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-zinc-400">
                Description <span className="text-zinc-600">(optional)</span>
              </span>
              <input
                type="text"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={saving}
                maxLength={250}
                placeholder="e.g. Manual wallet funding"
                className="h-10 w-full rounded-lg border border-white/[0.08] bg-[#09090b] px-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-500/50"
              />
            </label>

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
                disabled={saving || !validAmount}
                className="h-10 rounded-lg bg-emerald-500 px-5 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Processing..." : "Add Balance"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
