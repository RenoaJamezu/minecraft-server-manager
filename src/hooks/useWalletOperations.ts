import { useCallback, type Dispatch, type SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import {
  APPROVAL_SUBMITTED_MESSAGE,
  submitApprovalIfRequired,
} from "../lib/approval";
import type {
  PaymentFormValues,
  WalletPaymentResult,
  WalletPlayer,
  WalletSpendFormValues,
  WalletSpendResult,
  WalletWithdrawalFormValues,
  WalletWithdrawalResult,
} from "../types/wallet";

const toCents = (value: number) => Math.round(value * 100);

interface UseWalletOperationsOptions {
  hasUser: boolean;
  serverId: string | null;
  workspaceLoading: boolean;
  players: WalletPlayer[];
  fetchWallets: () => Promise<void>;
  refreshAffectedHistory: (playerIds: string[]) => Promise<void>;
  setSaving: Dispatch<SetStateAction<boolean>>;
}

export function useWalletOperations({
  hasUser,
  serverId,
  workspaceLoading,
  players,
  fetchWallets,
  refreshAffectedHistory,
  setSaving,
}: UseWalletOperationsOptions) {
  const queryClient = useQueryClient();

  const recordPayment = useCallback(
    async (
      values: PaymentFormValues,
      requestId: string,
    ): Promise<{ error: string | null; result?: WalletPaymentResult }> => {
      if (!hasUser || !serverId || workspaceLoading) {
        return {
          error: "Select a workspace before recording a payment.",
        };
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

      if (!values.payment_date) {
        return { error: "Payment date is required." };
      }

      if (!values.payer_player_id) {
        return { error: "Select the person who made the payment." };
      }

      if (!values.allocations.length) {
        return { error: "Add at least one allocation." };
      }

      if (!requestId) {
        return { error: "Payment request ID is missing. Please try again." };
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

        const beneficiary = players.find(
          (player) => player.id === allocation.player_id,
        );

        if (!beneficiary) {
          return {
            error: "One or more selected players are not in this workspace.",
          };
        }

        if (allocation.purpose === "membership") {
          const monthlyFeeCents = toCents(beneficiary.monthly_fee);

          if (
            monthlyFeeCents <= 0 ||
            toCents(allocationAmount) % monthlyFeeCents !== 0
          ) {
            return {
              error: `Membership allocation for ${beneficiary.minecraft_username} must be a complete number of monthly fees.`,
            };
          }
        }

        allocationTotalCents += toCents(allocationAmount);
      }

      if (!players.some((player) => player.id === values.payer_player_id)) {
        return { error: "The selected payer is not in this workspace." };
      }

      if (allocationTotalCents > toCents(amount)) {
        return {
          error: "The total allocations cannot exceed the payment received.",
        };
      }

      setSaving(true);

      try {
        const payload = {
          payer_player_id: values.payer_player_id,
          amount,
          allocations: values.allocations.map((allocation) => ({
            player_id: allocation.player_id,
            amount: allocation.amount,
            purpose: allocation.purpose,
            description: allocation.description?.trim() || null,
          })),
          request_id: requestId,
          payment_date: values.payment_date,
          notes: values.notes.trim() || null,
        };

        const submitted = await submitApprovalIfRequired({
          serverId,
          requestType: "payment.cash",
          payload,
          clientRequestId: requestId,
        });

        if (submitted) {
          return { error: APPROVAL_SUBMITTED_MESSAGE };
        }

        const { data, error: paymentError } = await supabase.rpc(
          "record_cash_payment",
          {
            p_server_id: serverId,
            p_payer_player_id: values.payer_player_id,
            p_amount: amount,
            p_allocations: payload.allocations,
            p_request_id: requestId,
            p_payment_date: values.payment_date,
            p_notes: payload.notes,
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

        const affectedPlayerIds = [
          values.payer_player_id,
          ...values.allocations.map((allocation) => allocation.player_id),
        ];

        await Promise.all([
          fetchWallets(),
          refreshAffectedHistory(affectedPlayerIds),
          queryClient.invalidateQueries({
            queryKey: ["players", serverId],
          }),
        ]);

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
    [
      hasUser,
      serverId,
      workspaceLoading,
      players,
      fetchWallets,
      refreshAffectedHistory,
      queryClient,
      setSaving,
    ],
  );

  const recordWalletSpend = useCallback(
    async (
      values: WalletSpendFormValues,
      requestId: string,
    ): Promise<{ error: string | null; result?: WalletSpendResult }> => {
      if (!hasUser || !serverId || workspaceLoading) {
        return {
          error: "Select a workspace before spending wallet balance.",
        };
      }

      if (!requestId) {
        return {
          error: "Request ID is missing. Please try again.",
        };
      }

      const player = players.find(
        (candidate) => candidate.id === values.player_id,
      );

      if (!player) {
        return {
          error: "Player not found in this workspace. Refresh and try again.",
        };
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
        const payload = {
          player_id: values.player_id,
          allocations: values.allocations.map((allocation) => ({
            amount: allocation.amount,
            purpose: allocation.purpose,
            description: allocation.description?.trim() || null,
          })),
          request_id: requestId,
        };

        const submitted = await submitApprovalIfRequired({
          serverId,
          requestType: "wallet.spend",
          payload,
          clientRequestId: requestId,
        });

        if (submitted) {
          return { error: APPROVAL_SUBMITTED_MESSAGE };
        }

        const { data, error: spendError } = await supabase.rpc(
          "record_wallet_spend",
          {
            p_server_id: serverId,
            p_player_id: values.player_id,
            p_allocations: payload.allocations,
            p_request_id: requestId,
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

        await Promise.all([
          fetchWallets(),
          refreshAffectedHistory([values.player_id]),
          queryClient.invalidateQueries({
            queryKey: ["players", serverId],
          }),
        ]);

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
    [
      hasUser,
      serverId,
      workspaceLoading,
      players,
      fetchWallets,
      refreshAffectedHistory,
      queryClient,
      setSaving,
    ],
  );

  const withdrawWalletBalance = useCallback(
    async (
      values: WalletWithdrawalFormValues,
    ): Promise<{ error: string | null; result?: WalletWithdrawalResult }> => {
      if (!hasUser || !serverId || workspaceLoading) {
        return {
          error: "Select a workspace before withdrawing wallet balance.",
        };
      }

      const player = players.find(
        (candidate) => candidate.id === values.player_id,
      );

      if (!player) {
        return {
          error: "Player not found in this workspace. Refresh and try again.",
        };
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
        const payload = {
          player_id: values.player_id,
          amount,
          description: values.description?.trim() || null,
        };

        const submitted = await submitApprovalIfRequired({
          serverId,
          requestType: "wallet.withdraw",
          payload,
        });

        if (submitted) {
          return { error: APPROVAL_SUBMITTED_MESSAGE };
        }

        const { data, error: withdrawalError } = await supabase.rpc(
          "withdraw_player_wallet_balance",
          {
            p_server_id: serverId,
            p_player_id: values.player_id,
            p_amount: amount,
            p_description: payload.description,
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

        await Promise.all([
          fetchWallets(),
          refreshAffectedHistory([values.player_id]),
        ]);

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
    [
      hasUser,
      serverId,
      workspaceLoading,
      players,
      fetchWallets,
      refreshAffectedHistory,
      setSaving,
    ],
  );

  return {
    recordPayment,
    recordWalletSpend,
    withdrawWalletBalance,
  };
}
