
import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import {
  APPROVAL_SUBMITTED_MESSAGE,
  submitApprovalIfRequired,
} from "../lib/approval";
import { supabase } from "../lib/supabase";
import type { Expense, ExpenseFormValues } from "../types/expense";

async function fetchExpensesData(serverId: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select("id, title, category, amount, expense_date, notes")
    .eq("server_id", serverId)
    .order("expense_date", { ascending: false });

  if (error) {
    console.error("Failed to fetch expenses:", error);
    throw error;
  }

  return (data ?? []) as Expense[];
}

export function useExpenses() {
  const { user, activeWorkspace, workspaceLoading } = useAuth();
  const queryClient = useQueryClient();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const serverId = activeWorkspace?.server_id ?? null;
  const enabled = Boolean(user && serverId && !workspaceLoading);

  const queryKey = ["expenses", serverId] as const;

  const expensesQuery = useQuery({
    queryKey,
    queryFn: () => fetchExpensesData(serverId!),
    enabled,
  });

  const expenses = expensesQuery.data ?? [];

  // Subscribe to expense changes in the active workspace.
  useEffect(() => {
    if (!enabled || !serverId) return;

    const channel = supabase
      .channel(`expenses-${serverId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "expenses",
          filter: `server_id=eq.${serverId}`,
        },
        () => {
          void queryClient.invalidateQueries({
            queryKey: ["expenses", serverId],
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, serverId, queryClient]);

  const fetchExpenses = useCallback(async () => {
    if (!enabled || !serverId) return;

    await expensesQuery.refetch();
  }, [enabled, serverId, expensesQuery.refetch]);

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
      const currentServerId = activeWorkspace.server_id;

      const payload = {
        title: values.title.trim(),
        category: values.category,
        amount,
        expense_date: values.expense_date,
        notes: values.notes.trim() || null,
      };

      const submitted = await submitApprovalIfRequired({
        serverId: currentServerId,
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
            .eq("server_id", currentServerId)
        : await supabase.from("expenses").insert({
            ...payload,
            owner_id: activeWorkspace.owner_id,
            server_id: currentServerId,
          });

      if (result.error) {
        console.error("Failed to save expense:", result.error);
        return result.error.message;
      }

      await queryClient.invalidateQueries({
        queryKey: ["expenses", currentServerId],
      });

      return null;
    } catch (saveError) {
      console.error("Unexpected error saving expense:", saveError);
      return "An unexpected error occurred while saving the expense.";
    } finally {
      setSaving(false);
    }
  };

  const deleteExpense = async (
    expense: Expense,
  ): Promise<string | null> => {
    if (!user) return "You must be signed in to delete an expense.";

    if (workspaceLoading || !activeWorkspace) {
      return "No active workspace selected. Please try again.";
    }

    if (!expenses.some((item) => item.id === expense.id)) {
      return "This expense does not belong to the active workspace.";
    }

    const currentServerId = activeWorkspace.server_id;

    const { error: deleteError } = await supabase
      .from("expenses")
      .delete()
      .eq("id", expense.id)
      .eq("server_id", currentServerId);

    if (deleteError) {
      console.error("Failed to delete expense:", deleteError);
      setError(deleteError.message);
      return deleteError.message;
    }

    await queryClient.invalidateQueries({
      queryKey: ["expenses", currentServerId],
    });

    return null;
  };

  return {
    expenses,
    loading: workspaceLoading || (enabled && expensesQuery.isPending),
    saving,
    error: error || (expensesQuery.error?.message ?? ""),
    setError,
    fetchExpenses,
    saveExpense,
    deleteExpense,
  };
}
