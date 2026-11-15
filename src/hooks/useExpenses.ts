import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import type { Expense, ExpenseFormValues } from "../types/expense";

export function useExpenses() {
  const { user } = useAuth();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchExpenses = useCallback(async () => {
    if (!user) {
      setExpenses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const { data, error: fetchError } = await supabase
      .from("expenses")
      .select("id, title, category, amount, expense_date, notes")
      .eq("owner_id", user.id)
      .order("expense_date", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setExpenses([]);
    } else {
      setExpenses((data ?? []) as Expense[]);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    void fetchExpenses();
  }, [fetchExpenses]);

  const saveExpense = async (
    values: ExpenseFormValues,
    editingExpense: Expense | null,
  ): Promise<string | null> => {
    if (!user) return "You must be signed in to save an expense.";

    const amount = Number(values.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return "Enter a valid expense amount greater than zero.";
    }

    if (!values.title.trim()) {
      return "Expense title is required.";
    }

    if (!values.expense_date) {
      return "Expense date is required.";
    }

    setSaving(true);
    setError("");

    const payload = {
      title: values.title.trim(),
      category: values.category,
      amount,
      expense_date: values.expense_date,
      notes: values.notes.trim() || null,
    };

    const result = editingExpense
      ? await supabase
          .from("expenses")
          .update(payload)
          .eq("id", editingExpense.id)
          .eq("owner_id", user.id)
      : await supabase
          .from("expenses")
          .insert({ ...payload, owner_id: user.id });

    setSaving(false);

    if (result.error) {
      return result.error.message;
    }

    await fetchExpenses();
    return null;
  };

  const deleteExpense = async (expense: Expense): Promise<string | null> => {
    if (!user) return "You must be signed in to delete an expense.";

    const { error: deleteError } = await supabase
      .from("expenses")
      .delete()
      .eq("id", expense.id)
      .eq("owner_id", user.id);

    if (deleteError) {
      setError(deleteError.message);
      return deleteError.message;
    }

    await fetchExpenses();
    return null;
  };

  return {
    expenses,
    loading,
    saving,
    error,
    setError,
    fetchExpenses,
    saveExpense,
    deleteExpense,
  };
}