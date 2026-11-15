import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { DashboardTransaction } from "../../hooks/useDashboard";

interface RecentTransactionsProps {
  transactions: DashboardTransaction[];
  loading: boolean;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function RecentTransactions({
  transactions,
  loading,
}: RecentTransactionsProps) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#111114] p-5 xl:col-span-2">
      <div>
        <h2 className="text-sm font-semibold text-white">
          Recent transactions
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Latest recorded income and expenses
        </p>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[480px] text-left">
          <thead>
            <tr className="border-b border-white/[0.06] text-xs text-zinc-500">
              <th className="pb-3 font-medium">Description</th>
              <th className="pb-3 font-medium">Date</th>
              <th className="pb-3 text-right font-medium">Amount</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={3}
                  className="py-8 text-center text-sm text-zinc-500"
                >
                  Loading transactions...
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="py-8 text-center text-sm text-zinc-500"
                >
                  No transactions recorded yet.
                </td>
              </tr>
            ) : (
              transactions.map((transaction) => {
                const isIncome = transaction.kind === "income";

                return (
                  <tr
                    key={transaction.id}
                    className="border-b border-white/[0.04] last:border-0"
                  >
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                            isIncome
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-red-500/10 text-red-400"
                          }`}
                        >
                          {isIncome ? (
                            <ArrowDownLeft size={16} />
                          ) : (
                            <ArrowUpRight size={16} />
                          )}
                        </div>

                        <div>
                          <p className="text-sm font-medium text-zinc-200">
                            {transaction.description}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {formatLabel(transaction.type)}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 text-xs text-zinc-500">
                      {formatDate(transaction.date)}
                    </td>

                    <td
                      className={`py-4 text-right text-sm font-medium ${
                        isIncome ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {isIncome ? "+" : "-"}
                      {formatCurrency(transaction.amount)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
