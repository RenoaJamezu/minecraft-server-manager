import { useCallback, useEffect, useState } from "react";
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
  const { user } = useAuth();

  const [data, setData] = useState<DashboardData>(initialData);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey);
  const [monthLabel, setMonthLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    if (!user) {
      setData(initialData);
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
      ] = await Promise.all([
        supabase
          .from("players")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", user.id),

        supabase
          .from("players")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", user.id)
          .gte("joined_at", start)
          .lt("joined_at", end),

        supabase
          .from("income_transactions")
          .select(
            "id, player_id, source_type, description, amount, income_date",
          )
          .eq("owner_id", user.id)
          .gte("income_date", start)
          .lt("income_date", end)
          .order("income_date", { ascending: false }),

        supabase
          .from("expenses")
          .select("id, title, category, amount, expense_date")
          .eq("owner_id", user.id)
          .gte("expense_date", start)
          .lt("expense_date", end)
          .order("expense_date", { ascending: false }),

        supabase
          .from("player_payment_allocations")
          .select("id, player_id, payment_id, amount, description")
          .eq("owner_id", user.id)
          .eq("purpose", "membership"),

        supabase
          .from("wallet_transactions")
          .select("id, player_id, amount, description, created_at")
          .eq("owner_id", user.id)
          .eq("transaction_type", "wallet_spend")
          .gte("created_at", startTimestamp)
          .lt("created_at", endTimestamp)
          .order("created_at", { ascending: false }),
      ]);

      const results = [
        playersResult,
        newPlayersResult,
        incomeResult,
        expensesResult,
        membershipResult,
        walletSpendResult,
      ];

      const failedResult = results.find((result) => result.error);

      if (failedResult?.error) {
        throw failedResult.error;
      }

      const membershipAllocations = (membershipResult.data ??
        []) as MembershipAllocation[];

      const incomeRows = (incomeResult.data ?? []) as IncomeRow[];
      const walletSpendRows = (walletSpendResult.data ??
        []) as WalletSpendRow[];

      const expenseRows = expensesResult.data ?? [];

      // Retrieve original cash payment dates for membership allocations.
      const paymentIds = [
        ...new Set(membershipAllocations.map((item) => item.payment_id)),
      ];

      let paymentMap = new Map<string, { id: string; payment_date: string }>();

      if (paymentIds.length > 0) {
        const { data: payments, error: paymentsError } = await supabase
          .from("player_payments")
          .select("id, payment_date")
          .eq("owner_id", user.id)
          .gte("payment_date", start)
          .lt("payment_date", end)
          .in("id", paymentIds);

        if (paymentsError) throw paymentsError;

        paymentMap = new Map(
          (payments ?? []).map((payment) => [payment.id, payment]),
        );
      }

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

      // Cash membership is counted from allocations. Remove matching
      // membership income records so the same payment is not counted twice.
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

      const filteredIncomeRows = incomeRows.filter((item) => {
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

      // New wallet spending is already represented in income_transactions.
      // Keep unmatched legacy wallet spending as a fallback, without
      // adding wallet spending twice when an income record exists.
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
      console.error("Failed to load dashboard:", err);
      setError("Unable to load dashboard data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user, selectedMonth]);

  useEffect(() => {
    void fetchDashboard();
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
