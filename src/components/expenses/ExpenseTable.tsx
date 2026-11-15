import { Pencil, Trash2 } from "lucide-react";
import {
  formatCurrency,
  formatExpenseDate,
  getExpenseCategoryLabel,
} from "../../lib/expense-utils";
import type { Expense } from "../../types/expense";

interface ExpenseTableProps {
  expenses: Expense[];
  loading: boolean;
  search: string;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
}

export default function ExpenseTable({
  expenses,
  loading,
  search,
  onEdit,
  onDelete,
}: ExpenseTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[650px] text-left text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] text-xs text-zinc-500">
            <th className="px-5 py-4 font-medium">Expense</th>
            <th className="px-5 py-4 font-medium">Category</th>
            <th className="px-5 py-4 font-medium">Date</th>
            <th className="px-5 py-4 text-right font-medium">Amount</th>
            <th className="px-5 py-4 text-right font-medium">Actions</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-white/[0.04]">
          {loading ? (
            <tr>
              <td colSpan={5} className="px-5 py-12 text-center text-zinc-500">
                Loading expenses...
              </td>
            </tr>
          ) : expenses.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-5 py-12 text-center text-zinc-500">
                {search
                  ? "No matching expenses found."
                  : "No expenses recorded yet."}
              </td>
            </tr>
          ) : (
            expenses.map((expense) => (
              <tr key={expense.id} className="transition hover:bg-white/[0.02]">
                <td className="px-5 py-4">
                  <p className="font-medium text-white">{expense.title}</p>
                  {expense.notes && (
                    <p className="mt-1 max-w-xs truncate text-xs text-zinc-500">
                      {expense.notes}
                    </p>
                  )}
                </td>

                <td className="px-5 py-4 text-zinc-400">
                  {getExpenseCategoryLabel(expense.category)}
                </td>

                <td className="px-5 py-4 text-zinc-400">
                  {formatExpenseDate(expense.expense_date)}
                </td>

                <td className="px-5 py-4 text-right font-medium text-white">
                  {formatCurrency(Number(expense.amount))}
                </td>

                <td className="px-5 py-4">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(expense)}
                      aria-label={`Edit ${expense.title}`}
                      className="rounded-md p-2 text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
                    >
                      <Pencil size={16} />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDelete(expense)}
                      aria-label={`Delete ${expense.title}`}
                      className="rounded-md p-2 text-zinc-400 transition hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
