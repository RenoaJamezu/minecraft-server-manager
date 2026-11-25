
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { useWalletOperations } from "./useWalletOperations";
import type {
  WalletHistoryEntry,
  WalletPlayer,
} from "../types/wallet";

type ReversalResult = {
  success?: boolean;
};

export function useWallets() {
  const { user, activeWorkspace, workspaceLoading } = useAuth();

  const [players, setPlayers] = useState<WalletPlayer[]>([]);
  const [transactions, setTransactions] = useState<WalletHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [canReversePayments, setCanReversePayments] = useState(false);
  const [error, setError] = useState("");

  const walletRequestRef = useRef(0);
  const historyRequestRef = useRef(0);
  const historyPlayerIdRef = useRef<string | null>(null);
  const fetchHistoryRef = useRef<(playerId: string) => Promise<void>>(
    async () => {},
  );

  const serverId = activeWorkspace?.server_id ?? null;

  const fetchWallets = useCallback(async () => {
    const requestId = ++walletRequestRef.current;

    if (workspaceLoading) return;

    if (!user || !serverId) {
      setPlayers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data: playerRows, error: playersError } = await supabase
        .from("players")
        .select("id, minecraft_username, discord_username, monthly_fee, status")
        .eq("server_id", serverId)
        .order("minecraft_username", { ascending: true });

      if (playersError) throw playersError;

      const playerIds = (playerRows ?? []).map((player) => player.id);

      let balanceRows: { player_id: string; balance: number | null }[] = [];

      if (playerIds.length > 0) {
        const { data, error: balancesError } = await supabase
          .from("player_wallet_balances")
          .select("player_id, balance, server_id")
          .eq("server_id", serverId)
          .in("player_id", playerIds);

        if (balancesError) throw balancesError;
        balanceRows = data ?? [];
      }

      if (requestId !== walletRequestRef.current) return;

      const balanceMap = new Map<string, number>();

      for (const row of balanceRows) {
        if (row.player_id) {
          balanceMap.set(row.player_id, Number(row.balance ?? 0));
        }
      }

      setPlayers(
        (playerRows ?? []).map((player) => ({
          ...player,
          monthly_fee: Number(player.monthly_fee),
          balance: balanceMap.get(player.id) ?? 0,
        })),
      );
    } catch (fetchError) {
      if (requestId !== walletRequestRef.current) return;

      console.error("Failed to load wallets:", fetchError);
      setError("Unable to load wallets. Please try again.");
      setPlayers([]);
    } finally {
      if (requestId === walletRequestRef.current) {
        setLoading(false);
      }
    }
  }, [user, serverId, workspaceLoading]);

  const fetchHistory = useCallback(
    async (playerId: string) => {
      historyPlayerIdRef.current = playerId;

      const requestId = ++historyRequestRef.current;

      if (workspaceLoading) return;

      if (!user || !serverId) {
        setTransactions([]);
        setHistoryLoading(false);
        return;
      }

      if (!players.some((player) => player.id === playerId)) {
        setTransactions([]);
        setHistoryLoading(false);
        return;
      }

      setHistoryLoading(true);
      setTransactions([]);
      setError("");

      try {
        const [allocationResult, walletResult] = await Promise.all([
          supabase
            .from("player_payment_allocations")
            .select("id, payment_id, player_id, amount, purpose, description")
            .eq("server_id", serverId)
            .eq("player_id", playerId),

          supabase
            .from("wallet_transactions")
            .select(
              "id, transaction_type, amount, description, created_at, payment_id",
            )
            .eq("server_id", serverId)
            .eq("player_id", playerId)
            .order("created_at", { ascending: false }),
        ]);

        if (allocationResult.error) throw allocationResult.error;
        if (walletResult.error) throw walletResult.error;

        const allocations = allocationResult.data ?? [];
        const walletRows = walletResult.data ?? [];

        const walletTransactionIds = walletRows.map((row) => row.id);
        const reversedWalletTransactionIds = new Set<string>();

        if (walletTransactionIds.length > 0) {
          const { data: reversalEntries, error: reversalEntriesError } =
            await supabase
              .from("payment_reversal_entries")
              .select("wallet_transaction_id")
              .eq("server_id", serverId)
              .eq("entry_type", "wallet_refund")
              .in("wallet_transaction_id", walletTransactionIds);

          if (reversalEntriesError) throw reversalEntriesError;

          for (const entry of reversalEntries ?? []) {
            if (entry.wallet_transaction_id) {
              reversedWalletTransactionIds.add(entry.wallet_transaction_id);
            }
          }
        }

        const paymentIds = [
          ...new Set(allocations.map((row) => row.payment_id)),
        ];

        let payments: {
          id: string;
          payment_date: string;
          created_at: string;
          player_id: string;
          amount: number;
          notes: string | null;
        }[] = [];

        if (paymentIds.length > 0) {
          const { data, error: paymentsError } = await supabase
            .from("player_payments")
            .select("id, payment_date, created_at, player_id, amount, notes")
            .eq("server_id", serverId)
            .in("id", paymentIds);

          if (paymentsError) throw paymentsError;

          payments = data ?? [];
        }

        const reversedAllocationIds = new Set<string>();
        const reversedPaymentIds = new Set<string>();

        if (paymentIds.length > 0) {
          const { data: reversals, error: reversalsError } = await supabase
            .from("payment_reversals")
            .select("payment_id, reversal_type, allocation_id")
            .eq("server_id", serverId)
            .in("payment_id", paymentIds);

          if (reversalsError) throw reversalsError;

          for (const reversal of reversals ?? []) {
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
          }
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
            .eq("server_id", serverId)
            .in("id", payerIds);

          if (payerError) throw payerError;

          for (const payer of data ?? []) {
            payerNameMap.set(payer.id, payer.minecraft_username);
          }
        }

        if (requestId !== historyRequestRef.current) return;

        const paymentMap = new Map(
          payments.map((payment) => [payment.id, payment]),
        );

        const paymentCreatedAtMap = new Map(
          payments.map((payment) => [payment.id, payment.created_at]),
        );

        const paymentEntries: WalletHistoryEntry[] = allocations.flatMap(
          (allocation): WalletHistoryEntry[] => {
            const payment = paymentMap.get(allocation.payment_id);

            if (!payment) return [];

            const isAllocationReversed = reversedAllocationIds.has(
              allocation.id,
            );
            const isPaymentReversed = reversedPaymentIds.has(
              allocation.payment_id,
            );

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
                allocation_id: allocation.id,
                payment_id: allocation.payment_id,
                is_allocation_reversed: isAllocationReversed,
                is_payment_reversed: isPaymentReversed,
                is_reversed: isAllocationReversed || isPaymentReversed,
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
          wallet_transaction_id: row.id,
          payment_id: row.payment_id,
          is_reversed: reversedWalletTransactionIds.has(row.id),
        }));

        if (requestId !== historyRequestRef.current) return;

        setTransactions(
          [...paymentEntries, ...walletEntries].sort((a, b) => {
            const dateA =
              a.kind === "payment" && a.payment_id
                ? (paymentCreatedAtMap.get(a.payment_id) ?? a.date)
                : a.date;

            const dateB =
              b.kind === "payment" && b.payment_id
                ? (paymentCreatedAtMap.get(b.payment_id) ?? b.date)
                : b.date;

            return new Date(dateB).getTime() - new Date(dateA).getTime();
          }),
        );
      } catch (historyError) {
        if (requestId !== historyRequestRef.current) return;

        console.error("Failed to load wallet history:", historyError);
        setError("Unable to load wallet history. Please try again.");
      } finally {
        if (requestId === historyRequestRef.current) {
          setHistoryLoading(false);
        }
      }
    },
    [user, serverId, workspaceLoading, players],
  );

  fetchHistoryRef.current = fetchHistory;

  const refreshAffectedHistory = useCallback(
    async (affectedPlayerIds: string[]) => {
      const openPlayerId = historyPlayerIdRef.current;

      if (openPlayerId && affectedPlayerIds.includes(openPlayerId)) {
        await fetchHistoryRef.current(openPlayerId);
      }
    },
    [],
  );

  const {
    recordPayment,
    recordWalletSpend,
    withdrawWalletBalance,
  } = useWalletOperations({
    hasUser: Boolean(user),
    serverId,
    workspaceLoading,
    players,
    fetchWallets,
    refreshAffectedHistory,
    setSaving,
  });

  const validateReversal = useCallback(
    (reason: string): string | null => {
      if (!user || !serverId || workspaceLoading) {
        return "Select a workspace before reversing a transaction.";
      }

      if (!canReversePayments) {
        return "You don't have permission to reverse payments.";
      }

      const trimmedReason = reason.trim();

      if (trimmedReason.length < 3 || trimmedReason.length > 1000) {
        return "The reversal reason must be 3–1000 characters.";
      }

      return null;
    },
    [user, serverId, workspaceLoading, canReversePayments],
  );

  const runReversal = useCallback(
    async (
      rpcName: "reverse_wallet_transaction" | "reverse_full_payment",
      args: Record<string, string>,
      playerId: string,
      failureMessage: string,
    ): Promise<{ error: string | null }> => {
      setSaving(true);

      try {
        const { data, error: reversalError } = await supabase.rpc(
          rpcName,
          args,
        );

        if (reversalError) throw reversalError;

        const result = data as ReversalResult;

        if (!result?.success) {
          return {
            error:
              "The reversal could not be confirmed. Refresh and check the history.",
          };
        }

        await Promise.all([fetchWallets(), fetchHistory(playerId)]);

        return { error: null };
      } catch (reversalError) {
        console.error(failureMessage, reversalError);

        return {
          error:
            reversalError instanceof Error
              ? reversalError.message
              : failureMessage,
        };
      } finally {
        setSaving(false);
      }
    },
    [fetchWallets, fetchHistory],
  );

  const reverseWalletTransaction = useCallback(
    async (
      playerId: string,
      transactionId: string,
      reason: string,
    ): Promise<{ error: string | null }> => {
      const validationError = validateReversal(reason);
      if (validationError) return { error: validationError };

      const transaction = transactions.find(
        (entry) => entry.wallet_transaction_id === transactionId,
      );

      if (
        !transaction ||
        transaction.kind !== "transaction" ||
        transaction.transaction_type !== "wallet_spend" ||
        transaction.amount >= 0 ||
        transaction.payment_id != null ||
        transaction.is_reversed
      ) {
        return {
          error: "This wallet transaction is not eligible for reversal.",
        };
      }

      return runReversal(
        "reverse_wallet_transaction",
        {
          p_wallet_transaction_id: transactionId,
          p_reason: reason.trim(),
        },
        playerId,
        "Unable to reverse the wallet transaction.",
      );
    },
    [transactions, validateReversal, runReversal],
  );

  const reverseFullPayment = useCallback(
    async (
      playerId: string,
      paymentId: string,
      reason: string,
    ): Promise<{ error: string | null }> => {
      const validationError = validateReversal(reason);
      if (validationError) return { error: validationError };

      const paymentAllocations = transactions.filter(
        (entry) => entry.kind === "payment" && entry.payment_id === paymentId,
      );

      if (
        paymentAllocations.length === 0 ||
        paymentAllocations.some((entry) => entry.is_payment_reversed)
      ) {
        return {
          error: "This payment is not eligible for full reversal.",
        };
      }

      return runReversal(
        "reverse_full_payment",
        {
          p_payment_id: paymentId,
          p_reason: reason.trim(),
        },
        playerId,
        "Unable to reverse the full payment.",
      );
    },
    [transactions, validateReversal, runReversal],
  );

  useEffect(() => {
    void fetchWallets();
  }, [fetchWallets]);

  useEffect(() => {
    let active = true;

    const checkPermission = async () => {
      if (workspaceLoading || !user || !serverId) {
        setCanReversePayments(false);
        return;
      }

      const { data, error: permissionError } = await supabase.rpc(
        "has_server_permission",
        {
          p_server_id: serverId,
          p_permission_key: "payments.reverse",
        },
      );

      if (!active) return;

      setCanReversePayments(!permissionError && data === true);
    };

    void checkPermission();

    return () => {
      active = false;
    };
  }, [user, serverId, workspaceLoading]);

  useEffect(() => {
    historyRequestRef.current += 1;
    historyPlayerIdRef.current = null;
    setTransactions([]);
    setHistoryLoading(false);
  }, [serverId]);

  return {
    players,
    transactions,
    loading,
    saving,
    historyLoading,
    canReversePayments,
    error,
    fetchWallets,
    recordPayment,
    recordWalletSpend,
    withdrawWalletBalance,
    fetchHistory,
    reverseWalletTransaction,
    reverseFullPayment,
  };
}
