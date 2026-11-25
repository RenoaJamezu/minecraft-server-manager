
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

export interface DashboardTransaction {
  id: string;
  description: string;
  type: string;
  date: string;
  amount: number;
  kind: "income" | "expense";
}

interface DashboardData {
  totalPlayers: number;
  newPlayers: number;
  monthlyIncome: number;
  totalExpenses: number;
  netEarnings: number;
  recentTransactions: DashboardTransaction[];
}

interface IncomeRow {
  id: string;
  player_id: string | null;
  source_type: string | null;
  source_payment_allocation_id: string | null;
  wallet_transaction_id: string | null;
  description: string | null;
  amount: number | string;
  income_date: string;
}

interface MembershipAllocation {
  id: string;
  player_id: string;
  payment_id: string;
  amount: number | string;
  description: string | null;
}

interface WalletSpendRow {
  id: string;
  player_id: string;
  amount: number | string;
  description: string | null;
  created_at: string;
}

interface PaymentReversalRow {
  reversal_type: string;
  payment_id: string | null;
  allocation_id: string | null;
  wallet_transaction_id: string | null;
}

interface PaymentReversalEntryRow {
  entry_type: string;
  income_transaction_id: string | null;
  wallet_transaction_id: string | null;
}

const initialData: DashboardData = {
  totalPlayers: 0,
  newPlayers: 0,
  monthlyIncome: 0,
  totalExpenses: 0,
  netEarnings: 0,
  recentTransactions: [],
};

function getCurrentMonthKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  return `${now.getFullYear()}-${month}`;
}

function getMonthRange(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const formatDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");

    return `${y}-${m}-${d}`;
  };

  const formatLocalTimestamp = (date: Date) => {
    const offset = -date.getTimezoneOffset();
    const sign = offset >= 0 ? "+" : "-";
    const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
    const minutes = String(Math.abs(offset) % 60).padStart(2, "0");

    return `${formatDate(date)}T00:00:00${sign}${hours}:${minutes}`;
  };

  return {
    start: formatDate(startDate),
    end: formatDate(endDate),
    startTimestamp: formatLocalTimestamp(startDate),
    endTimestamp: formatLocalTimestamp(endDate),
    label: startDate.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    }),
  };
}

function getIncomeMatchKey(
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

export function useDashboard() {
  const { user, activeWorkspace, workspaceLoading } = useAuth();

  const [data, setData] = useState<DashboardData>(initialData);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey);
  const [monthLabel, setMonthLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef(0);

  const currentMonth = getCurrentMonthKey();
  const canGoNext = selectedMonth < currentMonth;

  const goToPreviousMonth = () => {
    setSelectedMonth((current) => {
      const [year, month] = current.split("-").map(Number);
      const previous = new Date(year, month - 2, 1);

      return `${previous.getFullYear()}-${String(
        previous.getMonth() + 1,
      ).padStart(2, "0")}`;
    });
  };

  const goToNextMonth = () => {
    if (!canGoNext) return;

    setSelectedMonth((current) => {
      const [year, month] = current.split("-").map(Number);
      const next = new Date(year, month, 1);

      return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(
        2,
        "0",
      )}`;
    });
  };

  const fetchDashboard = useCallback(async () => {
    if (workspaceLoading) return;

    const requestId = ++requestIdRef.current;
    const serverId = activeWorkspace?.server_id;

    if (!user || !serverId) {
      setData(initialData);
      setMonthLabel("");
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { start, end, startTimestamp, endTimestamp, label } =
        getMonthRange(selectedMonth);

      const [
        playersResult,
        newPlayersResult,
        incomeResult,
        expensesResult,
        membershipResult,
        walletSpendResult,
        reversalsResult,
        reversalEntriesResult,
      ] = await Promise.all([
        supabase
          .from("players")
          .select("id", { count: "exact", head: true })
          .eq("server_id", serverId),

        supabase
          .from("players")
          .select("id", { count: "exact", head: true })
          .eq("server_id", serverId)
          .gte("joined_at", start)
          .lt("joined_at", end),

        supabase
          .from("income_transactions")
          .select(
            "id, player_id, source_type, source_payment_allocation_id, wallet_transaction_id, description, amount, income_date",
          )
          .eq("server_id", serverId)
          .gte("income_date", start)
          .lt("income_date", end)
          .order("income_date", { ascending: false }),

        supabase
          .from("expenses")
          .select("id, title, category, amount, expense_date")
          .eq("server_id", serverId)
          .gte("expense_date", start)
          .lt("expense_date", end)
          .order("expense_date", { ascending: false }),

        supabase
          .from("player_payment_allocations")
          .select("id, player_id, payment_id, amount, description")
          .eq("server_id", serverId)
          .eq("purpose", "membership"),

        supabase
          .from("wallet_transactions")
          .select("id, player_id, amount, description, created_at")
          .eq("server_id", serverId)
          .eq("transaction_type", "wallet_spend")
          .gte("created_at", startTimestamp)
          .lt("created_at", endTimestamp)
          .order("created_at", { ascending: false }),

        supabase
          .from("payment_reversals")
          .select(
            "reversal_type, payment_id, allocation_id, wallet_transaction_id",
          )
          .eq("server_id", serverId),

        supabase
          .from("payment_reversal_entries")
          .select(
            "entry_type, income_transaction_id, wallet_transaction_id",
          )
          .eq("server_id", serverId)
          .eq("entry_type", "income_reversal"),
      ]);

      if (requestId !== requestIdRef.current) return;

      const results = [
        playersResult,
        newPlayersResult,
        incomeResult,
        expensesResult,
        membershipResult,
        walletSpendResult,
        reversalsResult,
        reversalEntriesResult,
      ];

      const failedResult = results.find((result) => result.error);

      if (failedResult?.error) {
        throw failedResult.error;
      }

      const allMembershipAllocations = (membershipResult.data ??
        []) as MembershipAllocation[];

      const incomeRows = (incomeResult.data ?? []) as IncomeRow[];
      const allWalletSpendRows = (walletSpendResult.data ??
        []) as WalletSpendRow[];

      const reversalRows = (reversalsResult.data ??
        []) as PaymentReversalRow[];

      const reversalEntries = (reversalEntriesResult.data ??
        []) as PaymentReversalEntryRow[];

      const expenseRows = expensesResult.data ?? [];

      // Build reversal lookup sets.
      const reversedPaymentIds = new Set<string>();
      const reversedAllocationIds = new Set<string>();
      const reversedWalletTransactionIds = new Set<string>();
      const reversedIncomeTransactionIds = new Set<string>();

      for (const reversal of reversalRows) {
        if (
          reversal.reversal_type === "full_payment" &&
          reversal.payment_id
        ) {
          reversedPaymentIds.add(reversal.payment_id);
        }

        if (
          reversal.reversal_type === "payment_allocation" &&
          reversal.allocation_id
        ) {
          reversedAllocationIds.add(reversal.allocation_id);
        }

        if (
          reversal.reversal_type === "wallet_transaction" &&
          reversal.wallet_transaction_id
        ) {
          reversedWalletTransactionIds.add(
            reversal.wallet_transaction_id,
          );
        }
      }

      for (const entry of reversalEntries) {
        if (entry.income_transaction_id) {
          reversedIncomeTransactionIds.add(entry.income_transaction_id);
        }

        if (entry.wallet_transaction_id) {
          reversedWalletTransactionIds.add(entry.wallet_transaction_id);
        }
      }

      // Exclude reversed wallet spending before calculating legacy income.
      const walletSpendRows = allWalletSpendRows.filter(
        (item) => !reversedWalletTransactionIds.has(item.id),
      );

      // Exclude membership allocations reversed individually or through
      // a full payment reversal.
      const membershipAllocations = allMembershipAllocations.filter(
        (allocation) =>
          !reversedAllocationIds.has(allocation.id) &&
          !reversedPaymentIds.has(allocation.payment_id),
      );

      const paymentIds = [
        ...new Set(membershipAllocations.map((item) => item.payment_id)),
      ];

      let paymentMap = new Map<string, { id: string; payment_date: string }>();

      if (paymentIds.length > 0) {
        const { data: payments, error: paymentsError } = await supabase
          .from("player_payments")
          .select("id, payment_date")
          .eq("server_id", serverId)
          .gte("payment_date", start)
          .lt("payment_date", end)
          .in("id", paymentIds);

        if (paymentsError) throw paymentsError;

        paymentMap = new Map(
          (payments ?? []).map((payment) => [payment.id, payment]),
        );
      }

      if (requestId !== requestIdRef.current) return;

      const datedMembershipAllocations = membershipAllocations.flatMap(
        (allocation) => {
          const payment = paymentMap.get(allocation.payment_id);

          if (!payment) return [];

          return [{ allocation, payment }];
        },
      );

      const membershipIncome = datedMembershipAllocations.reduce(
        (total, { allocation }) => total + Number(allocation.amount || 0),
        0,
      );

      const cashMembershipCounts = new Map<string, number>();

      for (const { allocation, payment } of datedMembershipAllocations) {
        incrementCount(
          cashMembershipCounts,
          getIncomeMatchKey(
            allocation.player_id,
            allocation.amount,
            payment.payment_date,
          ),
        );
      }

      // Remove income rows that have already been reversed, as well as
      // rows linked to reversed allocations or wallet transactions.
      const activeIncomeRows = incomeRows.filter((item) => {
        if (reversedIncomeTransactionIds.has(item.id)) return false;

        if (
          item.source_payment_allocation_id &&
          reversedAllocationIds.has(item.source_payment_allocation_id)
        ) {
          return false;
        }

        if (
          item.wallet_transaction_id &&
          reversedWalletTransactionIds.has(item.wallet_transaction_id)
        ) {
          return false;
        }

        const isMembership =
          item.source_type?.trim().toLowerCase() === "membership";

        if (
          isMembership &&
          item.source_payment_allocation_id &&
          allMembershipAllocations.some(
            (allocation) =>
              allocation.id === item.source_payment_allocation_id &&
              reversedPaymentIds.has(allocation.payment_id),
          )
        ) {
          return false;
        }

        return true;
      });

      const filteredIncomeRows = activeIncomeRows.filter((item) => {
        const isMembership =
          item.source_type?.trim().toLowerCase() === "membership";

        if (!isMembership) return true;

        const key = getIncomeMatchKey(
          item.player_id,
          item.amount,
          item.income_date,
        );

        return !consumeCount(cashMembershipCounts, key);
      });

      const walletSpendCounts = new Map<string, number>();

      for (const item of walletSpendRows) {
        const date = item.created_at.slice(0, 10);

        incrementCount(
          walletSpendCounts,
          getIncomeMatchKey(
            item.player_id,
            Math.abs(Number(item.amount || 0)),
            date,
          ),
        );
      }

      const unmatchedWalletSpends: WalletSpendRow[] = [];

      for (const item of walletSpendRows) {
        const date = item.created_at.slice(0, 10);
        const key = getIncomeMatchKey(
          item.player_id,
          Math.abs(Number(item.amount || 0)),
          date,
        );

        if (!consumeCount(walletSpendCounts, key)) continue;

        unmatchedWalletSpends.push(item);
      }

      const incomeMatchCounts = new Map<string, number>();

      for (const item of filteredIncomeRows) {
        incrementCount(
          incomeMatchCounts,
          getIncomeMatchKey(item.player_id, item.amount, item.income_date),
        );
      }

      const legacyWalletSpends = unmatchedWalletSpends.filter((item) => {
        const key = getIncomeMatchKey(
          item.player_id,
          Math.abs(Number(item.amount || 0)),
          item.created_at,
        );

        return !consumeCount(incomeMatchCounts, key);
      });

      const recordedIncome = filteredIncomeRows.reduce(
        (total, item) => total + Number(item.amount || 0),
        0,
      );

      const legacyWalletIncome = legacyWalletSpends.reduce(
        (total, item) => total + Math.abs(Number(item.amount || 0)),
        0,
      );

      const monthlyIncome =
        recordedIncome + membershipIncome + legacyWalletIncome;

      const totalExpenses = expenseRows.reduce(
        (total, item) => total + Number(item.amount || 0),
        0,
      );

      const recentIncome: DashboardTransaction[] = filteredIncomeRows.map(
        (item) => ({
          id: `income-${item.id}`,
          description: item.description || "Income",
          type: item.source_type || "Other",
          date: item.income_date,
          amount: Number(item.amount || 0),
          kind: "income",
        }),
      );

      const recentMembershipIncome: DashboardTransaction[] =
        datedMembershipAllocations.map(({ allocation, payment }) => ({
          id: `membership-${allocation.id}`,
          description: allocation.description || "Membership payment",
          type: "Membership",
          date: payment.payment_date,
          amount: Number(allocation.amount || 0),
          kind: "income",
        }));

      const recentLegacyWalletIncome: DashboardTransaction[] =
        legacyWalletSpends.map((item) => ({
          id: `wallet-spend-${item.id}`,
          description: item.description || "Wallet spending",
          type: "Wallet redemption",
          date: item.created_at,
          amount: Math.abs(Number(item.amount || 0)),
          kind: "income",
        }));

      const recentExpenses: DashboardTransaction[] = expenseRows.map(
        (item) => ({
          id: `expense-${item.id}`,
          description: item.title,
          type: item.category || "Other",
          date: item.expense_date,
          amount: Number(item.amount || 0),
          kind: "expense",
        }),
      );

      const recentTransactions = [
        ...recentIncome,
        ...recentMembershipIncome,
        ...recentLegacyWalletIncome,
        ...recentExpenses,
      ]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5);

      if (requestId !== requestIdRef.current) return;

      setData({
        totalPlayers: playersResult.count ?? 0,
        newPlayers: newPlayersResult.count ?? 0,
        monthlyIncome,
        totalExpenses,
        netEarnings: monthlyIncome - totalExpenses,
        recentTransactions,
      });

      setMonthLabel(label);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;

      console.error("Failed to load dashboard:", err);
      setError("Unable to load dashboard data. Please try again.");
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [user, activeWorkspace?.server_id, workspaceLoading, selectedMonth]);

  useEffect(() => {
    void fetchDashboard();

    return () => {
      requestIdRef.current += 1;
    };
  }, [fetchDashboard]);

  return {
    ...data,
    monthLabel,
    selectedMonth,
    canGoNext,
    loading,
    error,
    refresh: fetchDashboard,
    goToPreviousMonth,
    goToNextMonth,
  };
}
