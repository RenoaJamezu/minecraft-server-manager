import { Users, TrendingUp, TrendingDown, Wallet } from "lucide-react";

interface DashboardStatsProps {
  totalPlayers: number;
  newPlayers: number;
  monthlyIncome: number;
  totalExpenses: number;
  netEarnings: number;
  loading: boolean;
}

const currency = (amount: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);

export default function DashboardStats({
  totalPlayers,
  newPlayers,
  monthlyIncome,
  totalExpenses,
  netEarnings,
  loading,
}: DashboardStatsProps) {
  const stats = [
    {
      label: "Total Players",
      value: totalPlayers.toLocaleString(),
      detail: "Registered players",
      icon: Users,
    },
    {
      label: "New Players",
      value: newPlayers.toLocaleString(),
      detail: "Joined this month",
      icon: Users,
    },
    {
      label: "Monthly Income",
      value: currency(monthlyIncome),
      detail: "Cash payments and wallet redemptions",
      icon: TrendingUp,
    },
    {
      label: "Total Expenses",
      value: currency(totalExpenses),
      detail: "Recorded server expenses",
      icon: TrendingDown,
    },
    {
      label: "Net Profit",
      value: currency(netEarnings),
      detail: "Earned income minus expenses",
      icon: Wallet,
    },
  ];

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {stats.map((stat) => {
        const Icon = stat.icon;

        return (
          <div
            key={stat.label}
            className="rounded-xl border border-white/[0.06] bg-[#111114] p-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-400">{stat.label}</p>
              <Icon size={19} className="text-zinc-500" />
            </div>

            <p className="mt-4 text-2xl font-semibold tracking-tight text-white">
              {loading ? "—" : stat.value}
            </p>

            <p className="mt-1 text-xs text-zinc-500">{stat.detail}</p>
          </div>
        );
      })}
    </section>
  );
}
