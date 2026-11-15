import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import type { Transaction } from "../types/transaction";

function getMatchKey(
  playerId: string | null | undefined,
  amount: number | string,
  date: string,
) {
  if (!playerId) return null;

  return `${playerId}|${Number(amount || 0).toFixed(2)}|${date.slice(0, 10)}`;
}

function incrementCount(counts: Map<string, number>, key: string | null) {
  if (!key) return;

  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function consumeCount(counts: Map<string, number>, key: string | null) {
  if (!key) return false;

  const count = counts.get(key) ?? 0;

  if (count <= 0) return false;

  if (count === 1) {
    counts.delete(key);
  } else {
    counts.set(key, count - 1);
  }

  return true;
}

export function useTransactions() {
  const { user } = useAuth();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchTransactions = useCallback(async () => {
    if (!user) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [incomeResult, expenseResult, membershipResult] = await Promise.all(
        [
          supabase
            .from("income_transactions")
            .select(
              "id, player_id, source_type, description, amount, income_date",
            )
            .eq("owner_id", user.id)
            .order("income_date", { ascending: false }),

          supabase
            .from("expenses")
            .select("id, title, category, amount, expense_date")
            .eq("owner_id", user.id)
            .order("expense_date", { ascending: false }),

          supabase
            .from("player_payment_allocations")
            .select("id, player_id, payment_id, amount, purpose, description")
            .eq("owner_id", user.id)
            .eq("purpose", "membership"),
        ],
      );

      if (incomeResult.error) throw incomeResult.error;
      if (expenseResult.error) throw expenseResult.error;
      if (membershipResult.error) throw membershipResult.error;

      const incomeRows = incomeResult.data ?? [];
      const membershipAllocations = membershipResult.data ?? [];
      const expenseRows = expenseResult.data ?? [];

      // Retrieve original cash payment dates for membership allocations.
      const paymentIds = [
        ...new Set(membershipAllocations.map((item) => item.payment_id)),
      ];

      let paymentMap = new Map<string, { id: string; payment_date: string }>();

      if (paymentIds.length > 0) {
        const { data, error: paymentsError } = await supabase
          .from("player_payments")
          .select("id, payment_date")
          .eq("owner_id", user.id)
          .in("id", paymentIds);

        if (paymentsError) throw paymentsError;

        paymentMap = new Map(
          (data ?? []).map((payment) => [payment.id, payment]),
        );
      }

      const datedMembershipAllocations = membershipAllocations.flatMap(
        (allocation) => {
          const payment = paymentMap.get(allocation.payment_id);

          if (!payment) return [];

          return [{ allocation, payment }];
        },
      );

      // Match cash membership income records against their allocations.
      // This prevents the same payment from appearing twice.
      const cashMembershipCounts = new Map<string, number>();

      for (const { allocation, payment } of datedMembershipAllocations) {
        incrementCount(
          cashMembershipCounts,
          getMatchKey(
            allocation.player_id,
            allocation.amount,
            payment.payment_date,
          ),
        );
      }

      const filteredIncomeRows = incomeRows.filter((item) => {
        if (item.source_type?.trim().toLowerCase() !== "membership") {
          return true;
        }

        return !consumeCount(
          cashMembershipCounts,
          getMatchKey(item.player_id, item.amount, item.income_date),
        );
      });

      // Collect all associated player IDs.
      const playerIds = [
        ...new Set(
          [
            ...filteredIncomeRows.map((item) => item.player_id),
            ...datedMembershipAllocations.map(
              ({ allocation }) => allocation.player_id,
            ),
          ].filter((id): id is string => Boolean(id)),
        ),
      ];

      let playerMap = new Map<string, string>();

      if (playerIds.length > 0) {
        const { data: players, error: playersError } = await supabase
          .from("players")
          .select("id, minecraft_username")
          .eq("owner_id", user.id)
          .in("id", playerIds);

        if (playersError) throw playersError;

        playerMap = new Map(
          (players ?? []).map((player) => [
            player.id,
            player.minecraft_username,
          ]),
        );
      }

      // Custom title, other, and wallet-funded membership income.
      const income: Transaction[] = filteredIncomeRows.map((item) => ({
        id: `income-${item.id}`,
        player: item.player_id ? (playerMap.get(item.player_id) ?? null) : null,
        description: item.description || "Income",
        category: item.source_type || "Other",
        date: item.income_date,
        amount: Number(item.amount || 0),
        kind: "income",
      }));

      // Cash membership payments are sourced from allocations.
      const membershipIncome: Transaction[] = datedMembershipAllocations.map(
        ({ allocation, payment }) => ({
          id: `membership-${allocation.id}`,
          player: playerMap.get(allocation.player_id) ?? null,
          description: allocation.description || "Membership payment",
          category: "Membership",
          date: payment.payment_date,
          amount: Number(allocation.amount || 0),
          kind: "income",
        }),
      );

      const expenses: Transaction[] = expenseRows.map((item) => ({
        id: `expense-${item.id}`,
        player: null,
        description: item.title,
        category: item.category || "Other",
        date: item.expense_date,
        amount: Number(item.amount || 0),
        kind: "expense",
      }));

      const combined = [...income, ...membershipIncome, ...expenses].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );

      setTransactions(combined);
    } catch (err) {
      console.error("Failed to fetch transactions:", err);
      setError("Unable to load transactions. Please try again.");
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchTransactions();
  }, [fetchTransactions]);

  return {
    transactions,
    loading,
    error,
    refresh: fetchTransactions,
  };
}
