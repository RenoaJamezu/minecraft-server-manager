import type { FormEvent } from "react";
import { X } from "lucide-react";
import ExpenseForm from "./ExpenseForm";
import type { ExpenseFormValues } from "../../types/expense";

interface ExpenseDialogProps {
  open: boolean;
  editing: boolean;
  form: ExpenseFormValues;
  saving: boolean;
  error: string;
  onChange: (values: ExpenseFormValues) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}

export default function ExpenseDialog({
  open,
  editing,
  form,
  saving,
  error,
  onChange,
  onSubmit,
  onClose,
}: ExpenseDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="expense-dialog-title"
        className="w-full max-w-lg rounded-xl border border-white/[0.08] bg-[#111114] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h2 id="expense-dialog-title" className="font-semibold text-white">
            {editing ? "Edit Expense" : "Add Expense"}
          </h2>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close dialog"
            className="rounded-md p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <p role="alert" className="px-5 pt-4 text-sm text-red-400">
            {error}
          </p>
        )}

        <ExpenseForm
          form={form}
          saving={saving}
          editing={editing}
          onChange={onChange}
          onSubmit={onSubmit}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}
