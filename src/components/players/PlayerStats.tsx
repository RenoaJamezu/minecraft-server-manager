import { Ban, Users, UserCheck, UserX } from "lucide-react";
import type { Player } from "../../types/player";
import { isPlayerActive, isPlayerBanned } from "../../types/player";

interface PlayerStatsProps {
  players: Player[];
}

export default function PlayerStats({ players }: PlayerStatsProps) {
  const totalCount = players.length;

  const bannedCount = players.filter(isPlayerBanned).length;

  const activeCount = players.filter(isPlayerActive).length;

  // Banned players are included in inactive.
  const inactiveCount = totalCount - activeCount;

  const stats = [
    {
      label: "Total Players",
      value: totalCount,
      icon: Users,
      iconClass: "text-zinc-400",
    },
    {
      label: "Active Players",
      value: activeCount,
      icon: UserCheck,
      iconClass: "text-emerald-400",
    },
    {
      label: "Inactive Players",
      value: inactiveCount,
      icon: UserX,
      iconClass: "text-amber-400",
    },
    {
      label: "Banned Players",
      value: bannedCount,
      icon: Ban,
      iconClass: "text-red-400",
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;

        return (
          <div
            key={stat.label}
            className="rounded-xl border border-white/[0.06] bg-[#111114] p-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-400">{stat.label}</p>
              <Icon size={18} className={stat.iconClass} />
            </div>

            <p className="mt-3 text-2xl font-semibold text-white">
              {stat.value}
            </p>
          </div>
        );
      })}
    </section>
  );
}
