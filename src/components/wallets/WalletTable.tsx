import {
  ArrowDownToLine,
  ChevronDown,
  History,
  Plus,
  PlusCircle,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { formatCurrency } from "../../lib/formatters";
import type { WalletPlayer } from "../../types/wallet";

interface WalletTableProps {
  players: WalletPlayer[];
  canAddWalletBalance: boolean;
  onAddWalletBalance: (player: WalletPlayer) => void;
  onAddPayment: (player: WalletPlayer) => void;
  onSpendWallet: (player: WalletPlayer) => void;
  onWithdrawWallet: (player: WalletPlayer) => void;
  onViewHistory: (player: WalletPlayer) => void;
}

export default function WalletTable({
  players,
  canAddWalletBalance,
  onAddWalletBalance,
  onAddPayment,
  onSpendWallet,
  onWithdrawWallet,
  onViewHistory,
}: WalletTableProps) {
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);

  const toggleActions = (playerId: string) => {
    setExpandedPlayerId((current) => (current === playerId ? null : playerId));
  };

  const closeActions = () => setExpandedPlayerId(null);

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
        <table className="w-full min-w-[800px] text-left text-sm">
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
            {players.map((player) => {
              const isExpanded = expandedPlayerId === player.id;
              const hasBalance = player.balance > 0;

              return (
                <>
                  <tr
                    key={player.id}
                    className="transition hover:bg-white/[0.02]"
                  >
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
                          onClick={() => onAddPayment(player)}
                          className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-500 px-3 text-xs font-medium text-black transition hover:bg-emerald-400"
                        >
                          <Plus size={15} />
                          Payment
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleActions(player.id)}
                          aria-expanded={isExpanded}
                          aria-label={`More wallet actions for ${player.minecraft_username}`}
                          className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition ${
                            isExpanded
                              ? "border-white/15 bg-white/[0.08] text-white"
                              : "border-white/[0.08] text-zinc-300 hover:bg-white/[0.05] hover:text-white"
                          }`}
                        >
                          More
                          <ChevronDown
                            size={14}
                            className={`transition-transform ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr
                      key={`${player.id}-actions`}
                      className="bg-white/[0.025]"
                    >
                      <td colSpan={4} className="px-5 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <span className="mr-auto text-xs text-zinc-500">
                            Wallet actions
                          </span>

                          <button
                            type="button"
                            onClick={() => {
                              closeActions();
                              onViewHistory(player);
                            }}
                            className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] px-3 text-xs text-zinc-300 transition hover:bg-white/[0.05] hover:text-white"
                          >
                            <History size={15} />
                            History
                          </button>

                          {canAddWalletBalance && (
                            <button
                              type="button"
                              onClick={() => {
                                closeActions();
                                onAddWalletBalance(player);
                              }}
                              className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 text-xs font-medium text-emerald-400 transition hover:bg-emerald-500/20"
                            >
                              <PlusCircle size={15} />
                              Add Balance
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              closeActions();
                              onSpendWallet(player);
                            }}
                            disabled={!hasBalance}
                            title={
                              !hasBalance
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
                            onClick={() => {
                              closeActions();
                              onWithdrawWallet(player);
                            }}
                            disabled={!hasBalance}
                            title={
                              !hasBalance
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
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
