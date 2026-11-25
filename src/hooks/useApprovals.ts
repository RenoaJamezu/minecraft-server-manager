import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type {
  ApprovalRequest,
  PlayerRecord,
} from "../types/approval";

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

export function useApprovals(serverId: string | undefined) {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [isApprover, setIsApprover] = useState(false);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadRequests = useCallback(async () => {
    if (!serverId) {
      setRequests([]);
      setPlayerNames({});
      setIsApprover(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
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

      const loadedRequests = (requestResult.data ?? []) as ApprovalRequest[];

      setIsApprover(approverResult.data === true);
      setRequests(loadedRequests);

      const playerIds = getPlayerIds(loadedRequests);

      if (playerIds.length === 0) {
        setPlayerNames({});
      } else {
        const { data: players, error: playersError } = await supabase
          .from("players")
          .select("id, minecraft_username")
          .eq("server_id", serverId)
          .in("id", playerIds);

        if (playersError) {
          console.warn(
            "Unable to load player names for approvals:",
            playersError,
          );
          setPlayerNames({});
        } else {
          const names: Record<string, string> = {};

          for (const player of (players ?? []) as PlayerRecord[]) {
            names[player.id] = player.minecraft_username;
          }

          setPlayerNames(names);
        }
      }
    } catch (err) {
      console.error("Failed to load approval requests:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load approval requests.",
      );
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const getPlayerName = useCallback(
    (id: unknown) => {
      if (typeof id !== "string") return "Unknown player";

      return playerNames[id] ?? "Player record";
    },
    [playerNames],
  );

  const reviewRequest = useCallback(
    async (
      request: ApprovalRequest,
      decision: "approved" | "rejected",
      rejectionReason?: string,
    ) => {
      if (!isApprover || request.status !== "pending") return;

      const reason = rejectionReason?.trim() ?? "";

      setBusyRequestId(request.id);
      setError("");
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

        await loadRequests();
      } catch (err) {
        console.error("Failed to review approval request:", err);

        setError(
          err instanceof Error ? err.message : "Unable to review this request.",
        );
      } finally {
        setBusyRequestId(null);
      }
    },
    [isApprover, loadRequests],
  );

  return {
    requests,
    loading,
    isApprover,
    busyRequestId,
    error,
    notice,
    setError,
    setNotice,
    loadRequests,
    getPlayerName,
    reviewRequest,
  };
}
