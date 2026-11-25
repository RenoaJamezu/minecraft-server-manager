
import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type {
  ApprovalRequest,
  AuditLog,
  PlayerRecord,
} from "../types/auditLog";

const PAGE_LIMIT = 500;

const auditLogsQueryKey = (serverId: string, isOwner: boolean) =>
  ["audit-logs", serverId, isOwner] as const;

interface AuditLogsData {
  logs: AuditLog[];
  approvals: Record<string, ApprovalRequest>;
  players: Record<string, PlayerRecord>;
}

interface UseAuditLogsResult extends AuditLogsData {
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
}

async function fetchAuditLogs(serverId: string): Promise<AuditLogsData> {
  const { data, error: queryError } = await supabase
    .from("server_audit_logs")
    .select(
      "id, server_id, actor_user_id, actor_label, action, target_type, target_id, details, created_at",
    )
    .eq("server_id", serverId)
    .order("created_at", { ascending: false })
    .limit(PAGE_LIMIT);

  if (queryError) throw queryError;

  const logs = (data ?? []) as AuditLog[];

  const approvalIds = [
    ...new Set(
      logs
        .filter(
          (log) =>
            log.target_type === "approval_request" &&
            Boolean(log.target_id),
        )
        .map((log) => log.target_id as string),
    ),
  ];

  const playerIds = new Set<string>();

  for (const log of logs) {
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
        typeof (allocation as Record<string, unknown>).player_id === "string"
      ) {
        playerIds.add(
          (allocation as Record<string, unknown>).player_id as string,
        );
      }
    }
  }

  const approvals: Record<string, ApprovalRequest> = {};
  const players: Record<string, PlayerRecord> = {};

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
        approvals[approval.id] = approval;
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
        players[player.id] = player;
      }
    }
  }

  return { logs, approvals, players };
}

export function useAuditLogs(
  serverId: string | undefined,
  isOwner: boolean,
): UseAuditLogsResult {
  const queryClient = useQueryClient();

  const auditLogsQuery = useQuery({
    queryKey: serverId
      ? auditLogsQueryKey(serverId, isOwner)
      : ["audit-logs", "no-workspace", false],
    queryFn: () => fetchAuditLogs(serverId!),
    enabled: Boolean(serverId && isOwner),
  });

  const {
    data,
    error: queryError,
    isPending,
    refetch,
  } = auditLogsQuery;

  useEffect(() => {
    if (!serverId || !isOwner) return;

    const invalidateAuditLogs = () => {
      void queryClient.invalidateQueries({
        queryKey: auditLogsQueryKey(serverId, true),
      });
    };

    const channel = supabase
      .channel(`audit-logs-${serverId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "server_audit_logs",
          filter: `server_id=eq.${serverId}`,
        },
        invalidateAuditLogs,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "server_approval_requests",
          filter: `server_id=eq.${serverId}`,
        },
        invalidateAuditLogs,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `server_id=eq.${serverId}`,
        },
        invalidateAuditLogs,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isOwner, queryClient, serverId]);

  const reload = useCallback(async () => {
    if (!serverId || !isOwner) return;
    await refetch();
  }, [isOwner, refetch, serverId]);

  return {
    logs: data?.logs ?? [],
    approvals: data?.approvals ?? {},
    players: data?.players ?? {},
    loading: Boolean(serverId && isOwner) && isPending,
    error:
      queryError instanceof Error ? queryError.message : "",
    reload,
  };
}
