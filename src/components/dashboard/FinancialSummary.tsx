interface FinancialSummaryProps {
  monthlyIncome: number;
  totalExpenses: number;
  netEarnings: number;
  monthLabel: string;
  loading: boolean;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
}

export default function FinancialSummary({
  monthlyIncome,
  totalExpenses,
  netEarnings,
  monthLabel,
  loading,
}: FinancialSummaryProps) {
  const largestValue = Math.max(monthlyIncome, totalExpenses, 1);

  const incomeWidth = (monthlyIncome / largestValue) * 100;
  const expenseWidth = (totalExpenses / largestValue) * 100;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#111114] p-5">
      <h2 className="text-sm font-semibold text-white">Financial summary</h2>

      <p className="mt-1 text-xs text-zinc-500">
        {monthLabel || "Current month"}
      </p>

      <div className="mt-6 space-y-5">
        <div>
          <div className="flex justify-between gap-3 text-sm">
            <span className="text-zinc-400">Income</span>
            <span className="font-medium text-emerald-400">
              {loading ? "—" : formatCurrency(monthlyIncome)}
            </span>
          </div>

          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${loading ? 0 : incomeWidth}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between gap-3 text-sm">
            <span className="text-zinc-400">Expenses</span>
            <span className="font-medium text-red-400">
              {loading ? "—" : formatCurrency(totalExpenses)}
            </span>
          </div>

          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-red-500 transition-all"
              style={{ width: `${loading ? 0 : expenseWidth}%` }}
            />
          </div>
        </div>

        <div className="border-t border-white/[0.06] pt-4">
          <p className="text-xs text-zinc-500">Net earnings</p>
          <p
            className={`mt-1 text-2xl font-semibold ${
              netEarnings < 0 ? "text-red-400" : "text-white"
            }`}
          >
            {loading ? "—" : formatCurrency(netEarnings)}
          </p>
        </div>
      </div>
    </div>
  );
}
