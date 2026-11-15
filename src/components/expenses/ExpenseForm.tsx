import type { FormEvent } from "react";
import {
  EXPENSE_CATEGORIES,
  type ExpenseFormValues,
} from "../../types/expense";

interface ExpenseFormProps {
  form: ExpenseFormValues;
  saving: boolean;
  editing: boolean;
  onChange: (values: ExpenseFormValues) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}

export default function ExpenseForm({
  form,
  saving,
  editing,
  onChange,
  onSubmit,
  onCancel,
}: ExpenseFormProps) {
  function update<K extends keyof ExpenseFormValues>(
    key: K,
    value: ExpenseFormValues[K],
  ) {
    onChange({ ...form, [key]: value });
  }

  const inputClass =
    "w-full rounded-lg border border-white/[0.08] bg-[#09090b] px-3 py-2.5 text-sm text-white outline-none focus:border-white/20";

  return (
    <form onSubmit={onSubmit} className="space-y-4 p-5">
      <div>
        <label className="mb-2 block text-sm text-zinc-300">
          Expense Title
        </label>
        <input
          required
          maxLength={120}
          value={form.title}
          onChange={(event) => update("title", event.target.value)}
          placeholder="e.g. November Server Hosting"
          className={inputClass}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm text-zinc-300">Category</label>
          <select
            required
            value={form.category}
            onChange={(event) => update("category", event.target.value)}
            className={inputClass}
          >
            {EXPENSE_CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm text-zinc-300">Amount (₱)</label>
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            value={form.amount}
            onChange={(event) => update("amount", event.target.value)}
            placeholder="750.00"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm text-zinc-300">Expense Date</label>
        <input
          required
          type="date"
          value={form.expense_date}
          onChange={(event) => update("expense_date", event.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-2 block text-sm text-zinc-300">
          Notes <span className="text-zinc-600">(Optional)</span>
        </label>
        <textarea
          rows={3}
          maxLength={1000}
          value={form.notes}
          onChange={(event) => update("notes", event.target.value)}
          placeholder="Additional details..."
          className={`${inputClass} resize-none placeholder:text-zinc-600`}
        />
      </div>

      <div className="flex justify-end gap-3 border-t border-white/[0.06] pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-white/[0.08] px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/[0.04] disabled:opacity-50"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving..." : editing ? "Save Changes" : "Add Expense"}
        </button>
      </div>
    </form>
  );
}
