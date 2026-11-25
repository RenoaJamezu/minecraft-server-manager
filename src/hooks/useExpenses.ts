
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  APPROVAL_SUBMITTED_MESSAGE,
  submitApprovalIfRequired,
} from "../lib/approval";
import { supabase } from "../lib/supabase";
import type { Expense, ExpenseFormValues } from "../types/expense";

export function useExpenses() {
  const { user, activeWorkspace, workspaceLoading } = useAuth();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchRequestRef = useRef(0);

  const fetchExpenses = useCallback(async () => {
    const requestId = ++fetchRequestRef.current;

    if (workspaceLoading) {
      setLoading(true);
      return;
    }

    if (!user || !activeWorkspace) {
      setExpenses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setExpenses([]);

    const { data, error: fetchError } = await supabase
      .from("expenses")
      .select("id, title, category, amount, expense_date, notes")
      .eq("server_id", activeWorkspace.server_id)
      .order("expense_date", { ascending: false });

    if (requestId !== fetchRequestRef.current) return;

    if (fetchError) {
      console.error("Failed to fetch expenses:", fetchError);
      setError(fetchError.message);
      setExpenses([]);
    } else {
      setExpenses((data ?? []) as Expense[]);
    }

    setLoading(false);
  }, [user, activeWorkspace, workspaceLoading]);

  useEffect(() => {
    void fetchExpenses();
  }, [fetchExpenses]);

  const saveExpense = async (
    values: ExpenseFormValues,
    editingExpense: Expense | null,
  ): Promise<string | null> => {
    if (!user) return "You must be signed in to save an expense.";

    if (workspaceLoading || !activeWorkspace) {
      return "No active workspace selected. Please try again.";
    }

    if (
      editingExpense &&
      !expenses.some((expense) => expense.id === editingExpense.id)
    ) {
      return "This expense does not belong to the active workspace.";
    }

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

    try {
      const serverId = activeWorkspace.server_id;

      const payload = {
        title: values.title.trim(),
        category: values.category,
        amount,
        expense_date: values.expense_date,
        notes: values.notes.trim() || null,
      };

      const submitted = await submitApprovalIfRequired({
        serverId,
        requestType: editingExpense ? "expense.update" : "expense.create",
        payload: editingExpense
          ? {
              ...payload,
              expense_id: editingExpense.id,
            }
          : payload,
      });

      if (submitted) {
        return APPROVAL_SUBMITTED_MESSAGE;
      }

      const result = editingExpense
        ? await supabase
            .from("expenses")
            .update(payload)
            .eq("id", editingExpense.id)
            .eq("server_id", serverId)
        : await supabase.from("expenses").insert({
            ...payload,
            owner_id: activeWorkspace.owner_id,
            server_id: serverId,
          });

      if (result.error) {
        console.error("Failed to save expense:", result.error);
        return result.error.message;
      }

      await fetchExpenses();
      return null;
    } catch (saveError) {
      console.error("Unexpected error saving expense:", saveError);
      return "An unexpected error occurred while saving the expense.";
    } finally {
      setSaving(false);
    }
  };

  const deleteExpense = async (expense: Expense): Promise<string | null> => {
    if (!user) return "You must be signed in to delete an expense.";

    if (workspaceLoading || !activeWorkspace) {
      return "No active workspace selected. Please try again.";
    }

    if (!expenses.some((item) => item.id === expense.id)) {
      return "This expense does not belong to the active workspace.";
    }

    const serverId = activeWorkspace.server_id;

    const { error: deleteError } = await supabase
      .from("expenses")
      .delete()
      .eq("id", expense.id)
      .eq("server_id", serverId);

    if (deleteError) {
      console.error("Failed to delete expense:", deleteError);
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
