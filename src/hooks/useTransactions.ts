
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import type { Transaction } from "../types/transaction";

interface Reversal {
  id: string;
  reversal_type: string;
  payment_id: string | null;
  allocation_id: string | null;
  wallet_transaction_id: string | null;
  reversed_at: string;
  reason: string | null;
}

interface ReversalInfo {
  reversedAt: string | null;
  reason: string | null;
}

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

interface DatedTransaction {
  transaction: Transaction;
  createdAt: string;
}

function toReversalInfo(reversal?: Reversal): ReversalInfo | null {
  if (!reversal) return null;

  return {
    reversedAt: reversal.reversed_at ?? null,
    reason: reversal.reason ?? null,
  };
}

export function useTransactions() {
  const { user, activeWorkspace, workspaceLoading } = useAuth();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchRequestRef = useRef(0);

  const fetchTransactions = useCallback(async () => {
    const requestId = ++fetchRequestRef.current;

    if (workspaceLoading) {
      setLoading(true);
      return;
    }

    if (!user || !activeWorkspace) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    const serverId = activeWorkspace.server_id;

    setLoading(true);
    setError("");
    setTransactions([]);

    try {
      const [
        incomeResult,
        expenseResult,
        membershipResult,
        reversalsResult,
        reversalEntriesResult,
      ] = await Promise.all([
        supabase
          .from("income_transactions")
          .select(
            "id, player_id, source_type, source_payment_allocation_id, description, amount, income_date, created_at, wallet_transaction_id",
          )
          .eq("server_id", serverId)
          .order("income_date", { ascending: false })
          .order("created_at", { ascending: false }),

        supabase
          .from("expenses")
          .select("id, title, category, amount, expense_date, created_at")
          .eq("server_id", serverId)
          .order("expense_date", { ascending: false })
          .order("created_at", { ascending: false }),

        supabase
          .from("player_payment_allocations")
          .select("id, player_id, payment_id, amount, purpose, description")
          .eq("server_id", serverId)
          .eq("purpose", "membership"),

        supabase
          .from("payment_reversals")
          .select(
            "id, reversal_type, payment_id, allocation_id, wallet_transaction_id, reversed_at, reason",
          )
          .eq("server_id", serverId),

        supabase
          .from("payment_reversal_entries")
          .select("reversal_id, income_transaction_id, entry_type")
          .eq("server_id", serverId)
          .eq("entry_type", "income_reversal"),
      ]);

      if (requestId !== fetchRequestRef.current) return;

      if (incomeResult.error) throw incomeResult.error;
      if (expenseResult.error) throw expenseResult.error;
      if (membershipResult.error) throw membershipResult.error;
      if (reversalsResult.error) throw reversalsResult.error;
      if (reversalEntriesResult.error) throw reversalEntriesResult.error;

      const incomeRows = incomeResult.data ?? [];
      const membershipAllocations = membershipResult.data ?? [];
      const expenseRows = expenseResult.data ?? [];
      const reversals = (reversalsResult.data ?? []) as Reversal[];
      const reversalEntries = reversalEntriesResult.data ?? [];

      const reversalById = new Map(
        reversals.map((reversal) => [reversal.id, reversal]),
      );

      const reversalByPaymentId = new Map<string, Reversal>();
      const reversalByAllocationId = new Map<string, Reversal>();
      const reversalByWalletTransactionId = new Map<string, Reversal>();

      for (const reversal of reversals) {
        if (reversal.reversal_type === "full_payment" && reversal.payment_id) {
          reversalByPaymentId.set(reversal.payment_id, reversal);
        }

        if (
          reversal.reversal_type === "payment_allocation" &&
          reversal.allocation_id
        ) {
          reversalByAllocationId.set(reversal.allocation_id, reversal);
        }

        if (
          reversal.reversal_type === "wallet_transaction" &&
          reversal.wallet_transaction_id
        ) {
          reversalByWalletTransactionId.set(
            reversal.wallet_transaction_id,
            reversal,
          );
        }
      }

      const reversalByIncomeTransactionId = new Map<string, Reversal>();

      for (const entry of reversalEntries) {
        if (!entry.income_transaction_id || !entry.reversal_id) continue;

        const reversal = reversalById.get(entry.reversal_id);

        if (reversal) {
          reversalByIncomeTransactionId.set(
            entry.income_transaction_id,
            reversal,
          );
        }
      }

      // Retrieve original cash payment dates and recording timestamps.
      const paymentIds = [
        ...new Set(membershipAllocations.map((item) => item.payment_id)),
      ];

      let paymentMap = new Map<
        string,
        { id: string; payment_date: string; created_at: string }
      >();

      if (paymentIds.length > 0) {
        const { data, error: paymentsError } = await supabase
          .from("player_payments")
          .select("id, payment_date, created_at")
          .eq("server_id", serverId)
          .in("id", paymentIds);

        if (paymentsError) throw paymentsError;

        paymentMap = new Map(
          (data ?? []).map((payment) => [payment.id, payment]),
        );
      }

      if (requestId !== fetchRequestRef.current) return;

      const datedMembershipAllocations = membershipAllocations.flatMap(
        (allocation) => {
          const payment = paymentMap.get(allocation.payment_id);

          if (!payment) return [];

          const reversal =
            reversalByAllocationId.get(allocation.id) ??
            reversalByPaymentId.get(allocation.payment_id);

          return [{ allocation, payment, reversal }];
        },
      );

      // Prevent cash membership payments from appearing twice.
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
        if (item.wallet_transaction_id) {
          return true;
        }

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
          .eq("server_id", serverId)
          .in("id", playerIds);

        if (playersError) throw playersError;

        playerMap = new Map(
          (players ?? []).map((player) => [
            player.id,
            player.minecraft_username,
          ]),
        );
      }

      if (requestId !== fetchRequestRef.current) return;

      // Custom title, other, and wallet-funded membership income.
      const income: DatedTransaction[] = filteredIncomeRows.map((item) => {
        const reversal =
          reversalByIncomeTransactionId.get(item.id) ??
          (item.source_payment_allocation_id
            ? reversalByAllocationId.get(item.source_payment_allocation_id)
            : undefined) ??
          (item.wallet_transaction_id
            ? reversalByWalletTransactionId.get(item.wallet_transaction_id)
            : undefined);

        const reversalInfo = toReversalInfo(reversal);

        return {
          transaction: {
            id: `income-${item.id}`,
            player: item.player_id
              ? (playerMap.get(item.player_id) ?? null)
              : null,
            description: item.description || "Income",
            category: item.wallet_transaction_id
              ? "Wallet Spend"
              : item.source_type || "Other",
            date: item.income_date,
            amount: Number(item.amount || 0),
            kind: "income",
            isReversed: Boolean(reversalInfo),
            reversedAt: reversalInfo?.reversedAt,
            reversalReason: reversalInfo?.reason,
          },
          createdAt: item.created_at,
        };
      });

      // Cash membership payments are sourced from allocations.
      const membershipIncome: DatedTransaction[] =
        datedMembershipAllocations.map(
          ({ allocation, payment, reversal }) => {
            const reversalInfo = toReversalInfo(reversal);

            return {
              transaction: {
                id: `membership-${allocation.id}`,
                player: playerMap.get(allocation.player_id) ?? null,
                description: allocation.description || "Membership payment",
                category: "Membership",
                date: payment.payment_date,
                amount: Number(allocation.amount || 0),
                kind: "income",
                isReversed: Boolean(reversalInfo),
                reversedAt: reversalInfo?.reversedAt,
                reversalReason: reversalInfo?.reason,
              },
              createdAt: payment.created_at,
            };
          },
        );

      const expenses: DatedTransaction[] = expenseRows.map((item) => ({
        transaction: {
          id: `expense-${item.id}`,
          player: null,
          description: item.title,
          category: item.category || "Other",
          date: item.expense_date,
          amount: Number(item.amount || 0),
          kind: "expense",
        },
        createdAt: item.created_at,
      }));

      // Sort by transaction date, then recording timestamp, then ID.
      const combined = [...income, ...membershipIncome, ...expenses].sort(
        (a, b) => {
          const dateComparison = b.transaction.date.localeCompare(
            a.transaction.date,
          );

          if (dateComparison !== 0) return dateComparison;

          const timestampComparison =
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

          if (timestampComparison !== 0) return timestampComparison;

          return b.transaction.id.localeCompare(a.transaction.id);
        },
      );

      setTransactions(combined.map((item) => item.transaction));
    } catch (err) {
      if (requestId !== fetchRequestRef.current) return;

      console.error("Failed to fetch transactions:", err);
      setError("Unable to load transactions. Please try again.");
      setTransactions([]);
    } finally {
      if (requestId === fetchRequestRef.current) {
        setLoading(false);
      }
    }
  }, [user, activeWorkspace, workspaceLoading]);

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
