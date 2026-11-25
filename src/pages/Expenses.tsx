import { useMemo, useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import ExpenseDialog from "../components/expenses/ExpenseDialog";
import ExpenseStats from "../components/expenses/ExpenseStats";
import ExpenseTable from "../components/expenses/ExpenseTable";
import ExpenseToolbar from "../components/expenses/ExpenseToolbar";
import { useExpenses } from "../hooks/useExpenses";
import { APPROVAL_SUBMITTED_MESSAGE } from "../lib/approval";
import {
  createEmptyExpenseForm,
  type Expense,
  type ExpenseFormValues,
} from "../types/expense";

export default function Expenses() {
  const {
    expenses,
    loading,
    saving,
    error,
    setError,
    saveExpense,
    deleteExpense,
  } = useExpenses();

  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [form, setForm] = useState<ExpenseFormValues>(createEmptyExpenseForm());
  const [dialogError, setDialogError] = useState("");
  const [notice, setNotice] = useState("");

  const filteredExpenses = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return expenses;

    return expenses.filter(
      (expense) =>
        expense.title.toLowerCase().includes(query) ||
        expense.category.toLowerCase().includes(query) ||
        (expense.notes ?? "").toLowerCase().includes(query),
    );
  }, [expenses, search]);

  function openCreateDialog() {
    setEditingExpense(null);
    setForm(createEmptyExpenseForm());
    setDialogError("");
    setNotice("");
    setShowDialog(true);
  }

  function openEditDialog(expense: Expense) {
    setEditingExpense(expense);
    setForm({
      title: expense.title,
      category: expense.category,
      amount: String(expense.amount),
      expense_date: expense.expense_date,
      notes: expense.notes ?? "",
    });
    setDialogError("");
    setNotice("");
    setShowDialog(true);
  }

  function closeDialog() {
    if (saving) return;

    setShowDialog(false);
    setEditingExpense(null);
    setDialogError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDialogError("");
    setNotice("");

    const saveError = await saveExpense(form, editingExpense);

    if (saveError === APPROVAL_SUBMITTED_MESSAGE) {
      setShowDialog(false);
      setEditingExpense(null);
      setForm(createEmptyExpenseForm());
      setNotice(
        editingExpense
          ? "Expense changes submitted for approval. No changes have been applied yet."
          : "Expense creation submitted for approval. It will appear after approval.",
      );
      return;
    }

    if (saveError) {
      setDialogError(saveError);
      return;
    }

    setShowDialog(false);
    setEditingExpense(null);
    setForm(createEmptyExpenseForm());
  }

  async function handleDelete(expense: Expense) {
    const confirmed = window.confirm(
      `Delete "${expense.title}"? This action cannot be undone.`,
    );

    if (!confirmed) return;

    setError("");
    await deleteExpense(expense);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-white">Expenses</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Track your Minecraft server operating costs.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateDialog}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200"
        >
          <Plus size={17} />
          Add Expense
        </button>
      </div>

      {notice && (
        <div
          role="status"
          className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300"
        >
          {notice}
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <ExpenseStats expenses={expenses} />

      <section className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#111114]">
        <ExpenseToolbar search={search} onSearchChange={setSearch} />

        <ExpenseTable
          expenses={filteredExpenses}
          loading={loading}
          search={search}
          onEdit={openEditDialog}
          onDelete={(expense) => void handleDelete(expense)}
        />
      </section>

      <ExpenseDialog
        open={showDialog}
        editing={Boolean(editingExpense)}
        form={form}
        saving={saving}
        error={dialogError}
        onChange={setForm}
        onSubmit={(event) => void handleSubmit(event)}
        onClose={closeDialog}
      />
    </div>
  );
}
