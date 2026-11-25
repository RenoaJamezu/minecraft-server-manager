import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import {
  APPROVAL_SUBMITTED_MESSAGE,
  submitApprovalIfRequired,
} from "../lib/approval";
import type { WalletTopUpFormValues, WalletTopUpResult } from "../types/wallet";

async function checkWalletTopUpPermission(serverId: string) {
  const [approverResult, adjustResult, requestResult] = await Promise.all([
    supabase.rpc("is_server_approver", {
      p_server_id: serverId,
    }),
    supabase.rpc("has_server_permission", {
      p_server_id: serverId,
      p_permission_key: "wallets.adjust",
    }),
    supabase.rpc("has_server_permission", {
      p_server_id: serverId,
      p_permission_key: "wallets.request_top_up",
    }),
  ]);

  return (
    (!approverResult.error && approverResult.data === true) ||
    (!adjustResult.error && adjustResult.data === true) ||
    (!requestResult.error && requestResult.data === true)
  );
}

export function useWalletTopUp(fetchWallets: () => Promise<void>) {
  const queryClient = useQueryClient();
  const { user, activeWorkspace, workspaceLoading } = useAuth();

  const [savingTopUp, setSavingTopUp] = useState(false);

  const serverId = activeWorkspace?.server_id ?? null;

  const permissionQuery = useQuery({
    queryKey: ["wallet-top-up-permission", serverId, user?.id],
    queryFn: () => checkWalletTopUpPermission(serverId!),
    enabled: Boolean(user && serverId && !workspaceLoading),
  });

  const canAddWalletBalance = permissionQuery.data ?? false;

  const addWalletBalance = useCallback(
    async (
      values: WalletTopUpFormValues,
    ): Promise<{ error: string | null; result?: WalletTopUpResult }> => {
      if (!user || !serverId || workspaceLoading) {
        return {
          error: "Select a workspace before adding wallet balance.",
        };
      }

      if (permissionQuery.isPending) {
        return {
          error: "Checking wallet permissions. Please try again.",
        };
      }

      if (!canAddWalletBalance) {
        return {
          error: "You don't have permission to adjust wallet balances.",
        };
      }

      const amount = Number(values.amount);

      if (
        !Number.isFinite(amount) ||
        amount <= 0 ||
        Math.round(amount * 100) !== amount * 100
      ) {
        return {
          error: "Enter a valid amount with at most two decimal places.",
        };
      }

      if (!values.player_id) {
        return { error: "Select a player." };
      }

      setSavingTopUp(true);

      try {
        const description = values.description?.trim() || null;

        const approvalSubmitted = await submitApprovalIfRequired({
          serverId,
          requestType: "wallet.top_up",
          payload: {
            player_id: values.player_id,
            amount,
            description,
          },
        });

        if (approvalSubmitted) {
          return { error: APPROVAL_SUBMITTED_MESSAGE };
        }

        const { data, error: topUpError } = await supabase.rpc(
          "add_player_wallet_balance",
          {
            p_server_id: serverId,
            p_player_id: values.player_id,
            p_amount: amount,
            p_description: description,
          },
        );

        if (topUpError) {
          console.error("Failed to add wallet balance:", topUpError);

          return {
            error:
              topUpError.message ||
              "Unable to add wallet balance. Please try again.",
          };
        }

        const result = data as WalletTopUpResult;

        if (!result?.success || !result.transaction_id || !result.player_id) {
          return {
            error:
              "The wallet top-up could not be confirmed. Refresh and check the wallet history.",
          };
        }

        await Promise.all([
          fetchWallets(),
          queryClient.invalidateQueries({
            queryKey: ["wallet-history", serverId],
          }),
        ]);

        return { error: null, result };
      } catch (topUpError) {
        if (
          topUpError instanceof Error &&
          topUpError.message === APPROVAL_SUBMITTED_MESSAGE
        ) {
          return { error: APPROVAL_SUBMITTED_MESSAGE };
        }

        console.error("Unexpected wallet top-up error:", topUpError);

        return {
          error: "An unexpected error occurred while adding wallet balance.",
        };
      } finally {
        setSavingTopUp(false);
      }
    },
    [
      user,
      serverId,
      workspaceLoading,
      permissionQuery.isPending,
      canAddWalletBalance,
      fetchWallets,
      queryClient,
    ],
  );

  return {
    canAddWalletBalance,
    permissionLoading: permissionQuery.isPending,
    savingTopUp,
    addWalletBalance,
  };
}
