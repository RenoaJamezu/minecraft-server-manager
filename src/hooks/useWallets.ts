import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import type {
  PaymentFormValues,
  WalletHistoryEntry,
  WalletPaymentResult,
  WalletPlayer,
  WalletSpendFormValues,
  WalletSpendResult,
  WalletWithdrawalFormValues,
  WalletWithdrawalResult,
} from "../types/wallet";

const toCents = (value: number) => Math.round(value * 100);

export function useWallets() {
  const { user } = useAuth();

  const [players, setPlayers] = useState<WalletPlayer[]>([]);
  const [transactions, setTransactions] = useState<WalletHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchWallets = useCallback(async () => {
    if (!user) {
      setPlayers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const [playersResult, balancesResult] = await Promise.all([
      supabase
        .from("players")
        .select("id, minecraft_username, discord_username, monthly_fee, status")
        .order("minecraft_username", { ascending: true }),

      supabase.from("player_wallet_balances").select("player_id, balance"),
    ]);

    const fetchError = playersResult.error || balancesResult.error;

    if (fetchError) {
      console.error("Failed to load wallets:", fetchError);
      setError("Unable to load wallets. Please try again.");
      setPlayers([]);
      setLoading(false);
      return;
    }

    const balanceMap = new Map<string, number>();

    for (const row of balancesResult.data ?? []) {
      if (row.player_id) {
        balanceMap.set(row.player_id, Number(row.balance ?? 0));
      }
    }

    setPlayers(
      (playersResult.data ?? []).map((player) => ({
        ...player,
        monthly_fee: Number(player.monthly_fee),
        balance: balanceMap.get(player.id) ?? 0,
      })),
    );

    setLoading(false);
  }, [user]);

  const recordPayment = useCallback(
    async (
      values: PaymentFormValues,
    ): Promise<{ error: string | null; result?: WalletPaymentResult }> => {
      const amount = Number(values.amount);

      if (
        !Number.isFinite(amount) ||
        amount <= 0 ||
        toCents(amount) !== amount * 100
      ) {
        return {
          error: "Enter a valid amount with at most two decimal places.",
        };
      }

      if (!values.payment_date) {
        return { error: "Payment date is required." };
      }

      if (!values.payer_player_id) {
        return { error: "Select the person who made the payment." };
      }

      if (!values.allocations.length) {
        return { error: "Add at least one allocation." };
      }

      if (!user) {
        return {
          error: "Your session has expired. Please sign in again.",
        };
      }

      let allocationTotalCents = 0;

      for (const allocation of values.allocations) {
        const allocationAmount = Number(allocation.amount);

        if (
          !allocation.player_id ||
          !["membership", "custom_title", "other"].includes(
            allocation.purpose,
          ) ||
          !Number.isFinite(allocationAmount) ||
          allocationAmount <= 0 ||
          toCents(allocationAmount) !== allocationAmount * 100
        ) {
          return {
            error:
              "Check that every allocation has a valid player, purpose, and amount.",
          };
        }

        if (allocation.purpose === "membership") {
          const beneficiary = players.find(
            (player) => player.id === allocation.player_id,
          );

          const monthlyFeeCents = beneficiary
            ? toCents(beneficiary.monthly_fee)
            : 0;

          if (
            monthlyFeeCents <= 0 ||
            toCents(allocationAmount) % monthlyFeeCents !== 0
          ) {
            return {
              error: `Membership allocation for ${beneficiary?.minecraft_username ?? "the selected player"} must be a complete number of monthly fees.`,
            };
          }
        }

        allocationTotalCents += toCents(allocationAmount);
      }

      if (allocationTotalCents > toCents(amount)) {
        return {
          error: "The total allocations cannot exceed the payment received.",
        };
      }

      setSaving(true);

      try {
        const { data, error: paymentError } = await supabase.rpc(
          "record_cash_payment",
          {
            p_payer_player_id: values.payer_player_id,
            p_amount: amount,
            p_allocations: values.allocations.map((allocation) => ({
              player_id: allocation.player_id,
              amount: allocation.amount,
              purpose: allocation.purpose,
              description: allocation.description?.trim() || null,
            })),
            p_payment_date: values.payment_date,
            p_notes: values.notes.trim() || null,
          },
        );

        if (paymentError) {
          console.error("Failed to record payment:", paymentError);
          return {
            error:
              paymentError.message ||
              "Unable to record payment. Please try again.",
          };
        }

        const result = data as WalletPaymentResult;

        if (
          !result?.success ||
          !result.payment_id ||
          !Array.isArray(result.allocations)
        ) {
          return {
            error:
              "The payment could not be confirmed. Please refresh and check your records.",
          };
        }

        await fetchWallets();

        return { error: null, result };
      } catch (paymentError) {
        console.error("Unexpected payment error:", paymentError);

        return {
          error: "An unexpected error occurred while recording the payment.",
        };
      } finally {
        setSaving(false);
      }
    },
    [user, players, fetchWallets],
  );

  const recordWalletSpend = useCallback(
    async (
      values: WalletSpendFormValues,
    ): Promise<{ error: string | null; result?: WalletSpendResult }> => {
      if (!user) {
        return {
          error: "Your session has expired. Please sign in again.",
        };
      }

      const player = players.find(
        (candidate) => candidate.id === values.player_id,
      );

      if (!player) {
        return { error: "Player not found. Refresh and try again." };
      }

      if (!values.allocations.length) {
        return { error: "Add at least one allocation." };
      }

      let totalCents = 0;

      for (const allocation of values.allocations) {
        const amount = Number(allocation.amount);

        if (
          !["membership", "custom_title", "other"].includes(
            allocation.purpose,
          ) ||
          !Number.isFinite(amount) ||
          amount <= 0 ||
          toCents(amount) !== amount * 100
        ) {
          return {
            error:
              "Check that every allocation has a valid purpose and amount.",
          };
        }

        if (allocation.purpose === "membership") {
          const feeCents = toCents(player.monthly_fee);

          if (feeCents <= 0 || toCents(amount) % feeCents !== 0) {
            return {
              error: `Membership spending must be a complete number of monthly fees (${player.monthly_fee.toFixed(2)} each).`,
            };
          }
        }

        totalCents += toCents(amount);
      }

      if (totalCents > toCents(player.balance)) {
        return { error: "Insufficient wallet balance." };
      }

      setSaving(true);

      try {
        const { data, error: spendError } = await supabase.rpc(
          "record_wallet_spend",
          {
            p_player_id: values.player_id,
            p_allocations: values.allocations.map((allocation) => ({
              amount: allocation.amount,
              purpose: allocation.purpose,
              description: allocation.description?.trim() || null,
            })),
          },
        );

        if (spendError) {
          console.error("Failed to spend wallet balance:", spendError);
          return {
            error:
              spendError.message ||
              "Unable to spend wallet balance. Please try again.",
          };
        }

        const result = data as WalletSpendResult;

        if (
          !result?.success ||
          !result.player_id ||
          !Array.isArray(result.allocations)
        ) {
          return {
            error:
              "The wallet spending could not be confirmed. Please refresh and check the history.",
          };
        }

        await fetchWallets();

        return { error: null, result };
      } catch (spendError) {
        console.error("Unexpected wallet spending error:", spendError);

        return {
          error:
            "An unexpected error occurred while spending the wallet balance.",
        };
      } finally {
        setSaving(false);
      }
    },
    [user, players, fetchWallets],
  );

  const withdrawWalletBalance = useCallback(
    async (
      values: WalletWithdrawalFormValues,
    ): Promise<{ error: string | null; result?: WalletWithdrawalResult }> => {
      if (!user) {
        return {
          error: "Your session has expired. Please sign in again.",
        };
      }

      const player = players.find(
        (candidate) => candidate.id === values.player_id,
      );

      if (!player) {
        return { error: "Player not found. Refresh and try again." };
      }

      const amount = Number(values.amount);

      if (
        !Number.isFinite(amount) ||
        amount <= 0 ||
        toCents(amount) !== amount * 100
      ) {
        return {
          error: "Enter a valid amount with at most two decimal places.",
        };
      }

      if (toCents(amount) > toCents(player.balance)) {
        return { error: "Insufficient wallet balance." };
      }

      setSaving(true);

      try {
        const { data, error: withdrawalError } = await supabase.rpc(
          "withdraw_player_wallet_balance",
          {
            p_player_id: values.player_id,
            p_amount: amount,
            p_description: values.description?.trim() || null,
          },
        );

        if (withdrawalError) {
          console.error("Failed to withdraw wallet balance:", withdrawalError);
          return {
            error:
              withdrawalError.message ||
              "Unable to withdraw wallet balance. Please try again.",
          };
        }

        const result = data as WalletWithdrawalResult;

        if (!result?.success || !result.transaction_id || !result.player_id) {
          return {
            error:
              "The withdrawal could not be confirmed. Please refresh and check the wallet history.",
          };
        }

        await fetchWallets();

        return { error: null, result };
      } catch (withdrawalError) {
        console.error("Unexpected wallet withdrawal error:", withdrawalError);

        return {
          error:
            "An unexpected error occurred while withdrawing the wallet balance.",
        };
      } finally {
        setSaving(false);
      }
    },
    [user, players, fetchWallets],
  );

  const fetchHistory = useCallback(async (playerId: string) => {
    setHistoryLoading(true);
    setTransactions([]);
    setError("");

    try {
      const [allocationResult, walletResult] = await Promise.all([
        supabase
          .from("player_payment_allocations")
          .select("id, payment_id, player_id, amount, purpose, description")
          .eq("player_id", playerId),

        supabase
          .from("wallet_transactions")
          .select(
            "id, transaction_type, amount, description, created_at, payment_id",
          )
          .eq("player_id", playerId)
          .order("created_at", { ascending: false }),
      ]);

      if (allocationResult.error) throw allocationResult.error;
      if (walletResult.error) throw walletResult.error;

      const allocations = allocationResult.data ?? [];
      const walletRows = walletResult.data ?? [];

      const paymentIds = [...new Set(allocations.map((row) => row.payment_id))];

      let payments: {
        id: string;
        payment_date: string;
        player_id: string;
        amount: number;
        notes: string | null;
      }[] = [];

      if (paymentIds.length > 0) {
        const { data, error: paymentsError } = await supabase
          .from("player_payments")
          .select("id, payment_date, player_id, amount, notes")
          .in("id", paymentIds);

        if (paymentsError) throw paymentsError;
        payments = data ?? [];
      }

      const payerIds = [
        ...new Set(
          payments.map((payment) => payment.player_id).filter(Boolean),
        ),
      ];

      const payerNameMap = new Map<string, string>();

      if (payerIds.length > 0) {
        const { data, error: payerError } = await supabase
          .from("players")
          .select("id, minecraft_username")
          .in("id", payerIds);

        if (payerError) throw payerError;

        for (const payer of data ?? []) {
          payerNameMap.set(payer.id, payer.minecraft_username);
        }
      }

      const paymentMap = new Map(
        payments.map((payment) => [payment.id, payment]),
      );

      const paymentEntries: WalletHistoryEntry[] = allocations.flatMap(
        (allocation): WalletHistoryEntry[] => {
          const payment = paymentMap.get(allocation.payment_id);

          if (!payment) return [];

          return [
            {
              id: `payment-${allocation.id}`,
              kind: "payment",
              date: payment.payment_date,
              amount: Number(allocation.amount),
              allocated_amount: Number(allocation.amount),
              description: allocation.description || payment.notes,
              purpose: allocation.purpose,
              payer_username:
                payerNameMap.get(payment.player_id) ?? "Unknown payer",
            },
          ];
        },
      );

      const walletEntries: WalletHistoryEntry[] = walletRows.map((row) => ({
        id: `transaction-${row.id}`,
        kind: "transaction",
        date: row.created_at,
        amount: Number(row.amount),
        description: row.description,
        transaction_type: row.transaction_type,
      }));

      setTransactions(
        [...paymentEntries, ...walletEntries].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        ),
      );
    } catch (historyError) {
      console.error("Failed to load wallet history:", historyError);
      setError("Unable to load wallet history. Please try again.");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWallets();
  }, [fetchWallets]);

  return {
    players,
    transactions,
    loading,
    saving,
    historyLoading,
    error,
    fetchWallets,
    recordPayment,
    recordWalletSpend,
    withdrawWalletBalance,
    fetchHistory,
  };
}
