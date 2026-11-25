import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { ApprovalRequest, PlayerRecord } from "../types/approval";

const approvalQueryKey = (serverId: string) => ["approvals", serverId] as const;

interface ApprovalsData {
  requests: ApprovalRequest[];
  playerNames: Record<string, string>;
  isApprover: boolean;
}

function getPlayerIds(requests: ApprovalRequest[]) {
  const ids = new Set<string>();

  for (const request of requests) {
    const payload = request.payload ?? {};
    const result = request.applied_result ?? {};

    for (const key of [
      "player_id",
      "payer_player_id",
      "beneficiary_player_id",
    ]) {
      const value = payload[key];

      if (typeof value === "string") {
        ids.add(value);
      }
    }

    if (typeof result.player_id === "string") {
      ids.add(result.player_id);
    }

    for (const source of [payload, result]) {
      const allocations = source.allocations;

      if (!Array.isArray(allocations)) continue;

      for (const allocation of allocations) {
        if (
          allocation &&
          typeof allocation === "object" &&
          "player_id" in allocation &&
          typeof allocation.player_id === "string"
        ) {
          ids.add(allocation.player_id);
        }
      }
    }
  }

  return [...ids];
}

async function fetchApprovalsData(serverId: string): Promise<ApprovalsData> {
  const [approverResult, requestResult] = await Promise.all([
    supabase.rpc("is_server_approver", {
      p_server_id: serverId,
    }),
    supabase
      .from("server_approval_requests")
      .select(
        "id, server_id, request_type, payload, status, submitter_user_id, submitter_label, reviewer_user_id, reviewed_at, rejection_reason, applied_result, created_at, updated_at",
      )
      .eq("server_id", serverId)
      .order("created_at", { ascending: false }),
  ]);

  if (approverResult.error) throw approverResult.error;
  if (requestResult.error) throw requestResult.error;

  const requests = (requestResult.data ?? []) as ApprovalRequest[];
  const playerIds = getPlayerIds(requests);

  let playerNames: Record<string, string> = {};

  if (playerIds.length > 0) {
    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("id, minecraft_username")
      .eq("server_id", serverId)
      .in("id", playerIds);

    if (playersError) {
      console.warn("Unable to load player names for approvals:", playersError);
    } else {
      playerNames = Object.fromEntries(
        ((players ?? []) as PlayerRecord[]).map((player) => [
          player.id,
          player.minecraft_username,
        ]),
      );
    }
  }

  return {
    requests,
    playerNames,
    isApprover: approverResult.data === true,
  };
}

export function useApprovals(serverId: string | undefined) {
  const queryClient = useQueryClient();

  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");

  const approvalsQuery = useQuery({
    queryKey: serverId
      ? approvalQueryKey(serverId)
      : ["approvals", "no-workspace"],
    queryFn: () => fetchApprovalsData(serverId!),
    enabled: Boolean(serverId),
  });

  const {
    data: approvalsData,
    error: queryError,
    isPending,
    refetch,
  } = approvalsQuery;

  // Subscribe to approval and player changes for this workspace.
  useEffect(() => {
    if (!serverId) return;

    const invalidateApprovals = () => {
      void queryClient.invalidateQueries({
        queryKey: approvalQueryKey(serverId),
      });
    };

    const channel = supabase
      .channel(`approvals-${serverId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "server_approval_requests",
          filter: `server_id=eq.${serverId}`,
        },
        invalidateApprovals,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `server_id=eq.${serverId}`,
        },
        invalidateApprovals,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, serverId]);

  const getPlayerName = useCallback(
    (id: unknown) => {
      if (typeof id !== "string") return "Unknown player";

      return approvalsData?.playerNames[id] ?? "Player record";
    },
    [approvalsData?.playerNames],
  );

  const reviewRequest = useCallback(
    async (
      request: ApprovalRequest,
      decision: "approved" | "rejected",
      rejectionReason?: string,
    ) => {
      if (
        !serverId ||
        !approvalsData?.isApprover ||
        request.status !== "pending"
      ) {
        return;
      }

      const reason = rejectionReason?.trim() ?? "";

      setBusyRequestId(request.id);
      setActionError("");
      setNotice("");

      try {
        const { data, error: rpcError } = await supabase.rpc(
          "review_server_approval_request",
          {
            p_request_id: request.id,
            p_decision: decision,
            p_rejection_reason: decision === "rejected" ? reason || null : null,
          },
        );

        if (rpcError) throw rpcError;

        if (!data?.success) {
          throw new Error(data?.error ?? "Unable to review this request.");
        }

        setNotice(
          decision === "approved"
            ? "Request approved. The requested changes have been applied."
            : "Request rejected. No changes were applied.",
        );

        await queryClient.invalidateQueries({
          queryKey: approvalQueryKey(serverId),
        });
      } catch (err) {
        console.error("Failed to review approval request:", err);

        setActionError(
          err instanceof Error ? err.message : "Unable to review this request.",
        );
      } finally {
        setBusyRequestId(null);
      }
    },
    [approvalsData?.isApprover, queryClient, serverId],
  );

  const loadRequests = useCallback(async () => {
    if (!serverId) return;
    await refetch();
  }, [refetch, serverId]);

  const setError = useCallback((message: string) => {
    setActionError(message);
  }, []);

  return {
    requests: approvalsData?.requests ?? [],
    loading: Boolean(serverId) && isPending,
    isApprover: approvalsData?.isApprover ?? false,
    busyRequestId,
    error:
      actionError || (queryError instanceof Error ? queryError.message : ""),
    notice,
    setError,
    setNotice,
    loadRequests,
    getPlayerName,
    reviewRequest,
  };
}
