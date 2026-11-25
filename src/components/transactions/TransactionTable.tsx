
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  RotateCcw,
} from "lucide-react";
import { formatCurrency } from "../../lib/formatters";
import type { Transaction } from "../../types/transaction";

interface TransactionTableProps {
  transactions: Transaction[];
  totalTransactions: number;
  loading: boolean;
  search: string;
}

function formatDate(date: string) {
  if (!date) return "—";

  return new Date(`${date.slice(0, 10)}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(date: string) {
  if (!date) return "—";

  return new Date(date).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function TransactionTable({
  transactions,
  totalTransactions,
  loading,
  search,
}: TransactionTableProps) {
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left">
          <thead>
            <tr className="border-b border-white/[0.06] text-xs text-zinc-500">
              <th className="px-5 py-3 font-medium">Player</th>
              <th className="px-5 py-3 font-medium">Description</th>
              <th className="px-5 py-3 font-medium">Category</th>
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium">Type / Status</th>
              <th className="px-5 py-3 text-right font-medium">Amount</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-12 text-center text-sm text-zinc-500"
                >
                  Loading transactions...
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center">
                  <ArrowLeftRight
                    className="mx-auto mb-3 text-zinc-600"
                    size={24}
                  />

                  <p className="text-sm font-medium text-zinc-300">
                    {totalTransactions === 0
                      ? "No transactions yet"
                      : "No matching transactions"}
                  </p>

                  <p className="mt-1 text-xs text-zinc-500">
                    {totalTransactions === 0
                      ? "Recorded income and expenses will appear here."
                      : "Try another search term or filter."}
                  </p>
                </td>
              </tr>
            ) : (
              transactions.map((transaction) => {
                const isIncome = transaction.kind === "income";
                const isReversed = Boolean(transaction.isReversed);

                const typeLabel = isIncome ? "Income" : "Expense";

                const typeStyles = isIncome
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-red-500/10 text-red-400";

                const amountStyles = isIncome
                  ? "text-emerald-400"
                  : "text-red-400";

                return (
                  <tr
                    key={transaction.id}
                    className={`border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] ${
                      isReversed ? "bg-amber-500/[0.025]" : ""
                    }`}
                  >
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-zinc-200">
                        {transaction.player || "—"}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <p
                        className={`text-sm font-medium ${
                          isReversed
                            ? "text-zinc-400 line-through decoration-zinc-600"
                            : "text-white"
                        }`}
                      >
                        {transaction.description}
                      </p>

                      {isReversed && (
                        <div className="mt-1.5 space-y-0.5">
                          <p className="flex items-center gap-1 text-xs font-medium text-amber-400">
                            <RotateCcw size={12} />
                            Reversed
                            {transaction.reversedAt
                              ? ` · ${formatDateTime(transaction.reversedAt)}`
                              : ""}
                          </p>

                          {transaction.reversalReason && (
                            <p className="text-xs text-zinc-500">
                              Reason: {transaction.reversalReason}
                            </p>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-4 text-sm text-zinc-400">
                      {formatLabel(transaction.category)}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-sm text-zinc-500">
                      {formatDate(transaction.date)}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex flex-col items-start gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${typeStyles}`}
                        >
                          {isIncome ? (
                            <ArrowDownLeft size={13} />
                          ) : (
                            <ArrowUpRight size={13} />
                          )}

                          {typeLabel}
                        </span>

                        {isReversed && (
                          <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400">
                            Reversed
                          </span>
                        )}
                      </div>
                    </td>

                    <td
                      className={`px-5 py-4 text-right text-sm font-semibold ${
                        isReversed ? "text-zinc-500 line-through" : amountStyles
                      }`}
                    >
                      {`${isIncome ? "+" : "-"}${formatCurrency(Math.abs(Number(transaction.amount)))}`}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-white/[0.06] px-5 py-3">
        <p className="text-xs text-zinc-500">
          Showing {transactions.length} of {totalTransactions} transactions
          {search.trim() ? " matching your search and filter" : ""}
        </p>
      </div>
    </>
  );
}
