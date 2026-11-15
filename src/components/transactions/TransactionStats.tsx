
import {
  ArrowDownLeft,
  ArrowUpRight,
  Crown,
  DollarSign,
  TrendingUp,
  Users,
} from "lucide-react";
import { formatCurrency } from "../../lib/formatters";
import type { Transaction } from "../../types/transaction";

interface TransactionStatsProps {
  transactions: Transaction[];
  loading: boolean;
}

export default function TransactionStats({
  transactions,
  loading,
}: TransactionStatsProps) {
  const incomeTransactions = transactions.filter(
    (item) => item.kind === "income",
  );

  const totalIncome = incomeTransactions.reduce(
    (total, item) => total + Number(item.amount),
    0,
  );

  const totalExpenses = transactions
    .filter((item) => item.kind === "expense")
    .reduce((total, item) => total + Number(item.amount), 0);

  const membershipIncome = incomeTransactions
    .filter((item) => item.category.trim().toLowerCase() === "membership")
    .reduce((total, item) => total + Number(item.amount), 0);

  const customTitleIncome = incomeTransactions
    .filter((item) => {
      const category = item.category.trim().toLowerCase();
      return category === "custom_title" || category === "custom title";
    })
    .reduce((total, item) => total + Number(item.amount), 0);

  const otherIncome = incomeTransactions
    .filter((item) => {
      const category = item.category.trim().toLowerCase();

      return (
        category !== "membership" &&
        category !== "custom_title" &&
        category !== "custom title"
      );
    })
    .reduce((total, item) => total + Number(item.amount), 0);

  const netProfit = totalIncome - totalExpenses;

  const stats = [
    {
      label: "Total income",
      amount: totalIncome,
      description: "All earned income",
      icon: ArrowDownLeft,
      color: "text-emerald-400",
    },
    {
      label: "Membership income",
      amount: membershipIncome,
      description: "Cash membership payments",
      icon: Users,
      color: "text-blue-400",
    },
    {
      label: "Custom title income",
      amount: customTitleIncome,
      description: "Cash custom title payments",
      icon: Crown,
      color: "text-purple-400",
    },
    {
      label: "Other income",
      amount: otherIncome,
      description: "Other recorded income",
      icon: DollarSign,
      color: "text-cyan-400",
    },
    {
      label: "Total expenses",
      amount: totalExpenses,
      description: "All recorded server expenses",
      icon: ArrowUpRight,
      color: "text-red-400",
    },
    {
      label: "Net profit",
      amount: netProfit,
      description: "Income minus expenses",
      icon: TrendingUp,
      color: netProfit >= 0 ? "text-emerald-400" : "text-red-400",
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {stats.map((stat) => {
        const Icon = stat.icon;

        return (
          <div
            key={stat.label}
            className="rounded-xl border border-white/[0.06] bg-[#111114] p-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-400">{stat.label}</p>
              <Icon size={19} className={stat.color} />
            </div>

            <p className={`mt-3 text-2xl font-semibold ${stat.color}`}>
              {loading ? "—" : formatCurrency(stat.amount)}
            </p>

            <p className="mt-1 text-xs text-zinc-500">
              {stat.description}
            </p>
          </div>
        );
      })}
    </section>
  );
}
