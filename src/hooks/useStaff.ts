import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type {
  AuditEntry,
  CreateStaffAccountInput,
  StaffAction,
  StaffData,
  StaffMember,
} from "../types/staff";

const staffQueryKey = (serverId: string) => ["staff", serverId] as const;

function getMemberLabel(email: string) {
  return email.endsWith("@staff.invalid")
    ? email.replace("@staff.invalid", "")
    : email;
}

function getExpectedAuditAction(action: StaffAction) {
  switch (action) {
    case "change_role":
      return "staff.role_changed";
    case "suspend":
      return "staff.suspended";
    case "activate":
      return "staff.activated";
    case "remove":
      return "staff.removed";
  }
}

async function fetchStaff(serverId: string): Promise<StaffData> {
  const { data, error } = await supabase.rpc("get_server_staff_data", {
    p_server_id: serverId,
  });

  if (error) throw error;

  const result = data as StaffData;

  return {
    members: result?.members ?? [],
    roles: result?.roles ?? [],
  };
}

export function useStaff(serverId: string | undefined) {
  const queryClient = useQueryClient();

  const [creatingAccount, setCreatingAccount] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");

  const staffQuery = useQuery({
    queryKey: serverId ? staffQueryKey(serverId) : ["staff", "no-workspace"],
    queryFn: () => fetchStaff(serverId!),
    enabled: Boolean(serverId),
  });

  const {
    data,
    error: queryError,
    isPending,
    isFetching,
    refetch,
  } = staffQuery;

  // Keep staff lists synchronized across sessions.
  useEffect(() => {
    if (!serverId) return;

    const invalidateStaff = () => {
      void queryClient.invalidateQueries({
        queryKey: staffQueryKey(serverId),
      });
    };

    const channel = supabase
      .channel(`staff-${serverId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "server_memberships",
          filter: `server_id=eq.${serverId}`,
        },
        invalidateStaff,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "server_roles",
          filter: `server_id=eq.${serverId}`,
        },
        invalidateStaff,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, serverId]);

  const loadStaff = useCallback(async () => {
    if (!serverId) return;
    await refetch();
  }, [refetch, serverId]);

  const createStaffAccount = useCallback(
    async (input: CreateStaffAccountInput) => {
      if (!serverId) return false;

      setCreatingAccount(true);
      setActionError("");
      setNotice("");

      try {
        const { data: result, error: functionError } =
          await supabase.functions.invoke("create-staff-account", {
            body: {
              serverId,
              username: input.username,
              displayName: input.displayName,
              password: input.password,
              roleId: input.roleId,
            },
          });

        if (functionError) {
          let message = functionError.message;

          try {
            const response = await functionError.context?.json();
            if (response?.error) message = response.error;
          } catch {
            // Keep the original function error message.
          }

          throw new Error(message);
        }

        if (!result?.success) {
          throw new Error(result?.error ?? "Unable to create staff account.");
        }

        setNotice(
          `Account "${input.username}" created successfully. Give the staff member their username and temporary password.`,
        );

        await queryClient.invalidateQueries({
          queryKey: staffQueryKey(serverId),
        });

        return true;
      } catch (err) {
        console.error("Failed to create staff account:", err);

        setActionError(
          err instanceof Error
            ? err.message
            : "Unable to create staff account.",
        );

        return false;
      } finally {
        setCreatingAccount(false);
      }
    },
    [queryClient, serverId],
  );

  const manageMember = useCallback(
    async (member: StaffMember, action: StaffAction, nextRoleId?: string) => {
      if (!serverId) {
        setActionError("Missing workspace ID.");
        return false;
      }

      if (action === "change_role" && nextRoleId === member.role_id) {
        return false;
      }

      const label = getMemberLabel(member.email);
      const expectedAction = getExpectedAuditAction(action);

      if (
        action === "remove" &&
        !window.confirm(
          `Remove ${label} from this workspace? This cannot be undone.`,
        )
      ) {
        return false;
      }

      setBusyMemberId(member.id);
      setActionError("");
      setNotice("");

      console.groupCollapsed("[Staff Audit] Starting staff action");
      console.info("Server ID:", serverId);
      console.info("Membership ID:", member.id);
      console.info("Target username:", label);
      console.info("Action:", action);
      console.info("Expected audit action:", expectedAction);
      console.info("Next role ID:", nextRoleId ?? null);
      console.groupEnd();

      try {
        const { error: actionError } = await supabase.rpc(
          "manage_server_member",
          {
            p_server_id: serverId,
            p_membership_id: member.id,
            p_action: action,
            p_role_id: nextRoleId ?? null,
          },
        );

        if (actionError) {
          console.error("[Staff Audit] RPC failed:", actionError);
          throw actionError;
        }

        console.info("[Staff Audit] RPC succeeded.");

        // Preserve the existing audit verification.
        const { data: auditEntry, error: auditError } = await supabase
          .from("server_audit_logs")
          .select("id, action, actor_label, target_id, details, created_at")
          .eq("server_id", serverId)
          .eq("target_id", member.id)
          .eq("action", expectedAction)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (auditError) {
          console.error(
            "[Staff Audit] Could not read audit entry:",
            auditError,
          );
          console.error("[Staff Audit] Check owner SELECT policy and RLS.");
        } else if (!auditEntry) {
          console.warn(
            "[Staff Audit] RPC succeeded, but no matching audit entry was visible.",
          );
          console.warn("Expected server ID:", serverId);
          console.warn("Expected membership ID:", member.id);
          console.warn("Expected action:", expectedAction);
        } else {
          console.info(
            "[Staff Audit] Audit entry verified:",
            auditEntry as AuditEntry,
          );
        }

        setNotice(
          action === "remove"
            ? `${label} was removed.`
            : action === "suspend"
              ? `${label} was suspended.`
              : action === "activate"
                ? `${label} was reactivated.`
                : `Role updated for ${label}.`,
        );

        await queryClient.invalidateQueries({
          queryKey: staffQueryKey(serverId),
        });

        return true;
      } catch (err) {
        console.error("[Staff Audit] Failed to manage staff member:", err);

        setActionError(
          err instanceof Error
            ? err.message
            : "Unable to update this staff member.",
        );

        return false;
      } finally {
        setBusyMemberId(null);
      }
    },
    [queryClient, serverId],
  );

  const setError = useCallback((message: string) => {
    setActionError(message);
  }, []);

  return {
    members: data?.members ?? [],
    roles: data?.roles ?? [],
    loading: Boolean(serverId) && isPending,
    refreshing: isFetching,
    creatingAccount,
    busyMemberId,
    error:
      actionError || (queryError instanceof Error ? queryError.message : ""),
    notice,
    setError,
    setNotice,
    loadStaff,
    createStaffAccount,
    manageMember,
  };
}
