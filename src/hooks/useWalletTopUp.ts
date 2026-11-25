import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import {
  APPROVAL_SUBMITTED_MESSAGE,
  submitApprovalIfRequired,
} from "../lib/approval";
import type { WalletTopUpFormValues, WalletTopUpResult } from "../types/wallet";

export function useWalletTopUp(fetchWallets: () => Promise<void>) {
  const { user, activeWorkspace, workspaceLoading } = useAuth();

  const [canAddWalletBalance, setCanAddWalletBalance] = useState(false);
  const [savingTopUp, setSavingTopUp] = useState(false);

  const serverId = activeWorkspace?.server_id ?? null;

  useEffect(() => {
    let active = true;

    const checkPermission = async () => {
      if (workspaceLoading || !user || !serverId) {
        setCanAddWalletBalance(false);
        return;
      }

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

      if (!active) return;

      setCanAddWalletBalance(
        (!approverResult.error && approverResult.data === true) ||
          (!adjustResult.error && adjustResult.data === true) ||
          (!requestResult.error && requestResult.data === true),
      );
    };

    void checkPermission();

    return () => {
      active = false;
    };
  }, [user, serverId, workspaceLoading]);

  const addWalletBalance = useCallback(
    async (
      values: WalletTopUpFormValues,
    ): Promise<{ error: string | null; result?: WalletTopUpResult }> => {
      if (!user || !serverId || workspaceLoading) {
        return {
          error: "Select a workspace before adding wallet balance.",
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
        const approvalSubmitted = await submitApprovalIfRequired({
          serverId,
          requestType: "wallet.top_up",
          payload: {
            player_id: values.player_id,
            amount,
            description: values.description?.trim() || null,
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
            p_description: values.description?.trim() || null,
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

        await fetchWallets();

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
    [user, serverId, workspaceLoading, canAddWalletBalance, fetchWallets],
  );

  return {
    canAddWalletBalance,
    savingTopUp,
    addWalletBalance,
  };
}
