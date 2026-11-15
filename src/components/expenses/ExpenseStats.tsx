import { Receipt } from "lucide-react";
import { formatCurrency } from "../../lib/formatters";
import type { Expense } from "../../types/expense";

interface ExpenseStatsProps {
  expenses: Expense[];
}

export default function ExpenseStats({ expenses }: ExpenseStatsProps) {
  const total = expenses.reduce(
    (sum, expense) => sum + Number(expense.amount),
    0,
  );

  return (
    <section className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-xl border border-white/[0.06] bg-[#111114] p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-400">Total Recorded Expenses</p>
          <Receipt size={18} className="text-zinc-500" />
        </div>

        <p className="mt-3 text-2xl font-semibold text-white">
          {formatCurrency(total)}
        </p>

        <p className="mt-1 text-xs text-zinc-500">
          Across all recorded expenses
        </p>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-[#111114] p-5">
        <p className="text-sm text-zinc-400">Expense Records</p>

        <p className="mt-3 text-2xl font-semibold text-white">
          {expenses.length.toLocaleString()}
        </p>

        <p className="mt-1 text-xs text-zinc-500">Total entries recorded</p>
      </div>
    </section>
  );
}
