import { Wallet, Users, TrendingUp } from "lucide-react";
import { formatCurrency } from "../../lib/formatters";
import type { WalletPlayer } from "../../types/wallet";

interface WalletStatsProps {
  players: WalletPlayer[];
}

export default function WalletStats({ players }: WalletStatsProps) {
  const totalBalance = players.reduce((sum, player) => sum + player.balance, 0);

  const playersWithBalance = players.filter(
    (player) => player.balance > 0,
  ).length;

  const stats = [
    {
      label: "Total Wallet Balance",
      value: formatCurrency(totalBalance),
      icon: Wallet,
      color: "text-emerald-400",
      background: "bg-emerald-500/10",
    },
    {
      label: "Players with Credit",
      value: playersWithBalance.toString(),
      icon: Users,
      color: "text-blue-400",
      background: "bg-blue-500/10",
    },
    {
      label: "Total Players",
      value: players.length.toString(),
      icon: TrendingUp,
      color: "text-violet-400",
      background: "bg-violet-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {stats.map((stat) => {
        const Icon = stat.icon;

        return (
          <div
            key={stat.label}
            className="rounded-xl border border-white/[0.06] bg-[#111114] p-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-400">{stat.label}</p>
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.background} ${stat.color}`}
              >
                <Icon size={18} />
              </div>
            </div>
            <p className="mt-4 text-2xl font-semibold text-white">
              {stat.value}
            </p>
          </div>
        );
      })}
    </div>
  );
}
