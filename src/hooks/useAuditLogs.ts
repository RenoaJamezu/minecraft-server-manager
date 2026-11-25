import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type {
  ApprovalRequest,
  AuditLog,
  PlayerRecord,
} from "../types/auditLog";

const PAGE_LIMIT = 500;

interface UseAuditLogsResult {
  logs: AuditLog[];
  approvals: Record<string, ApprovalRequest>;
  players: Record<string, PlayerRecord>;
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
}

export function useAuditLogs(
  serverId: string | undefined,
  isOwner: boolean,
): UseAuditLogsResult {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [approvals, setApprovals] = useState<Record<string, ApprovalRequest>>(
    {},
  );
  const [players, setPlayers] = useState<Record<string, PlayerRecord>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadLogs = useCallback(async () => {
    if (!serverId || !isOwner) {
      setLogs([]);
      setApprovals({});
      setPlayers({});
      setError("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error: queryError } = await supabase
        .from("server_audit_logs")
        .select(
          "id, server_id, actor_user_id, actor_label, action, target_type, target_id, details, created_at",
        )
        .eq("server_id", serverId)
        .order("created_at", { ascending: false })
        .limit(PAGE_LIMIT);

      if (queryError) throw queryError;

      const loadedLogs = (data ?? []) as AuditLog[];
      setLogs(loadedLogs);

      const approvalIds = [
        ...new Set(
          loadedLogs
            .filter(
              (log) =>
                log.target_type === "approval_request" &&
                Boolean(log.target_id),
            )
            .map((log) => log.target_id as string),
        ),
      ];

      const playerIds = new Set<string>();

      for (const log of loadedLogs) {
        const appliedResult =
          log.details?.applied_result &&
          typeof log.details.applied_result === "object"
            ? (log.details.applied_result as Record<string, unknown>)
            : {};

        if (typeof appliedResult.player_id === "string") {
          playerIds.add(appliedResult.player_id);
        }

        const allocations = Array.isArray(appliedResult.allocations)
          ? appliedResult.allocations
          : [];

        for (const allocation of allocations) {
          if (
            allocation &&
            typeof allocation === "object" &&
            typeof (allocation as Record<string, unknown>).player_id ===
              "string"
          ) {
            playerIds.add(
              (allocation as Record<string, unknown>).player_id as string,
            );
          }
        }
      }

      const nextApprovals: Record<string, ApprovalRequest> = {};
      const nextPlayers: Record<string, PlayerRecord> = {};

      if (approvalIds.length > 0) {
        const { data: approvalData, error: approvalError } = await supabase
          .from("server_approval_requests")
          .select("id, submitter_label, request_type, rejection_reason, status")
          .eq("server_id", serverId)
          .in("id", approvalIds);

        if (approvalError) {
          console.warn(
            "Unable to load approval details for audit logs:",
            approvalError,
          );
        } else {
          for (const approval of (approvalData ?? []) as ApprovalRequest[]) {
            nextApprovals[approval.id] = approval;
          }
        }
      }

      if (playerIds.size > 0) {
        const { data: playerData, error: playerError } = await supabase
          .from("players")
          .select("id, minecraft_username")
          .eq("server_id", serverId)
          .in("id", [...playerIds]);

        if (playerError) {
          console.warn(
            "Unable to load player names for audit logs:",
            playerError,
          );
        } else {
          for (const player of (playerData ?? []) as PlayerRecord[]) {
            nextPlayers[player.id] = player;
          }
        }
      }

      setApprovals(nextApprovals);
      setPlayers(nextPlayers);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
      setError(
        err instanceof Error ? err.message : "Unable to load audit logs.",
      );
    } finally {
      setLoading(false);
    }
  }, [serverId, isOwner]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  return {
    logs,
    approvals,
    players,
    loading,
    error,
    reload: loadLogs,
  };
}
