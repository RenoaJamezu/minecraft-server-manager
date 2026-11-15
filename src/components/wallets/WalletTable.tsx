import { ArrowDownToLine, History, Plus, Wallet } from "lucide-react";
import { formatCurrency } from "../../lib/formatters";
import type { WalletPlayer } from "../../types/wallet";

interface WalletTableProps {
  players: WalletPlayer[];
  onAddPayment: (player: WalletPlayer) => void;
  onSpendWallet: (player: WalletPlayer) => void;
  onWithdrawWallet: (player: WalletPlayer) => void;
  onViewHistory: (player: WalletPlayer) => void;
}

export default function WalletTable({
  players,
  onAddPayment,
  onSpendWallet,
  onWithdrawWallet,
  onViewHistory,
}: WalletTableProps) {
  if (players.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-[#111114] px-5 py-12 text-center">
        <p className="text-sm font-medium text-white">No players found</p>
        <p className="mt-1 text-sm text-zinc-500">
          Try changing your search or balance filter.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#111114]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-white/[0.06] bg-white/[0.02] text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-5 py-4 font-medium">Player</th>
              <th className="px-5 py-4 font-medium">Status</th>
              <th className="px-5 py-4 text-right font-medium">
                Wallet Balance
              </th>
              <th className="px-5 py-4 text-right font-medium">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-white/[0.05]">
            {players.map((player) => (
              <tr key={player.id} className="transition hover:bg-white/[0.02]">
                <td className="px-5 py-4">
                  <p className="font-medium text-white">
                    {player.minecraft_username}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Monthly fee: {formatCurrency(player.monthly_fee)}
                  </p>
                </td>

                <td className="px-5 py-4">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      player.status === "active"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-zinc-500/10 text-zinc-400"
                    }`}
                  >
                    {player.status}
                  </span>
                </td>

                <td className="px-5 py-4 text-right">
                  <span
                    className={`font-semibold ${
                      player.balance > 0
                        ? "text-emerald-400"
                        : player.balance < 0
                          ? "text-rose-400"
                          : "text-zinc-300"
                    }`}
                  >
                    {formatCurrency(player.balance)}
                  </span>
                </td>

                <td className="px-5 py-4">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onViewHistory(player)}
                      title="View wallet history"
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] px-3 text-xs text-zinc-300 transition hover:bg-white/[0.05] hover:text-white"
                    >
                      <History size={15} />
                      History
                    </button>

                    <button
                      type="button"
                      onClick={() => onAddPayment(player)}
                      className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-500 px-3 text-xs font-medium text-black transition hover:bg-emerald-400"
                    >
                      <Plus size={15} />
                      Payment
                    </button>

                    <button
                      type="button"
                      onClick={() => onSpendWallet(player)}
                      disabled={player.balance <= 0}
                      title={
                        player.balance <= 0
                          ? "No available wallet balance"
                          : "Pay using this player's wallet"
                      }
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 text-xs font-medium text-emerald-400 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Wallet size={15} />
                      Pay with Wallet
                    </button>

                    <button
                      type="button"
                      onClick={() => onWithdrawWallet(player)}
                      disabled={player.balance <= 0}
                      title={
                        player.balance <= 0
                          ? "No available wallet balance"
                          : "Withdraw from this player's wallet"
                      }
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 text-xs font-medium text-amber-400 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ArrowDownToLine size={15} />
                      Withdraw
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
