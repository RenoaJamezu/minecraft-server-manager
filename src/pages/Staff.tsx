
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  RefreshCw,
  UserPlus,
  Shield,
  UserX,
  UserCheck,
  Trash2,
  KeyRound,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

interface StaffMember {
  id: string;
  user_id: string | null;
  email: string;
  role_id: string;
  role_name: string | null;
  status: "invited" | "active" | "suspended";
  created_at: string;
}

interface StaffRole {
  id: string;
  name: string;
  role_key: string;
  is_system: boolean;
  is_editable: boolean;
}

interface StaffData {
  members: StaffMember[];
  roles: StaffRole[];
}

interface AuditEntry {
  id: string;
  action: string;
  actor_label: string | null;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

function getMemberLabel(email: string) {
  return email.endsWith("@staff.invalid")
    ? email.replace("@staff.invalid", "")
    : email;
}

function getExpectedAuditAction(
  action: "change_role" | "suspend" | "activate" | "remove",
) {
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

export default function Staff() {
  const { user, activeWorkspace, hasPermission } = useAuth();

  const [members, setMembers] = useState<StaffMember[]>([]);
  const [roles, setRoles] = useState<StaffRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState("");

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const serverId = activeWorkspace?.server_id;

  const canInvite = hasPermission("staff.invite");
  const canChangeRole = hasPermission("staff.update_role");
  const canSuspend = hasPermission("staff.suspend");
  const canRemove = hasPermission("staff.remove");

  const loadStaff = useCallback(async () => {
    if (!serverId) return;

    setLoading(true);
    setError("");

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "get_server_staff_data",
        { p_server_id: serverId },
      );

      if (rpcError) throw rpcError;

      const result = data as StaffData;

      setMembers(result.members ?? []);
      setRoles(result.roles ?? []);

      setRoleId((current) =>
        current && result.roles?.some((role) => role.id === current)
          ? current
          : (result.roles?.[0]?.id ?? ""),
      );
    } catch (err) {
      console.error("Failed to load staff:", err);
      setError(
        err instanceof Error ? err.message : "Unable to load workspace staff.",
      );
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!serverId || !canInvite || !roleId) return;

    const normalizedUsername = username.trim().toLowerCase();

    if (!/^[a-z0-9._-]{3,24}$/.test(normalizedUsername)) {
      setError(
        "Username must be 3–24 characters and use only letters, numbers, dots, underscores, or hyphens.",
      );
      return;
    }

    if (password.length < 8) {
      setError("Temporary password must be at least 8 characters.");
      return;
    }

    setCreatingAccount(true);
    setError("");
    setNotice("");

    try {
      const { data, error: functionError } = await supabase.functions.invoke(
        "create-staff-account",
        {
          body: {
            serverId,
            username: normalizedUsername,
            displayName: displayName.trim(),
            password,
            roleId,
          },
        },
      );

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

      if (!data?.success) {
        throw new Error(data?.error ?? "Unable to create staff account.");
      }

      setNotice(
        `Account "${normalizedUsername}" created successfully. Give the staff member their username and temporary password.`,
      );

      setUsername("");
      setDisplayName("");
      setPassword("");

      await loadStaff();
    } catch (err) {
      console.error("Failed to create staff account:", err);
      setError(
        err instanceof Error ? err.message : "Unable to create staff account.",
      );
    } finally {
      setCreatingAccount(false);
    }
  }

  async function manageMember(
    member: StaffMember,
    action: "change_role" | "suspend" | "activate" | "remove",
    nextRoleId?: string,
  ) {
    if (!serverId) {
      console.error("[Staff Audit] Missing server ID.");
      return;
    }

    if (action === "change_role" && nextRoleId === member.role_id) {
      return;
    }

    const label = getMemberLabel(member.email);
    const expectedAction = getExpectedAuditAction(action);

    if (
      action === "remove" &&
      !window.confirm(
        `Remove ${label} from this workspace? This cannot be undone.`,
      )
    ) {
      return;
    }

    setBusyMemberId(member.id);
    setError("");
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

      // Verify that the database created the expected audit entry.
      const { data: auditEntry, error: auditError } = await supabase
        .from("server_audit_logs")
        .select(
          "id, action, actor_label, target_id, details, created_at",
        )
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
        console.error(
          "[Staff Audit] Check owner SELECT policy and RLS.",
        );
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

      await loadStaff();
    } catch (err) {
      console.error("[Staff Audit] Failed to manage staff member:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update this staff member.",
      );
    } finally {
      setBusyMemberId(null);
    }
  }

  function statusStyle(status: StaffMember["status"]) {
    switch (status) {
      case "active":
        return "bg-emerald-500/10 text-emerald-400";
      case "invited":
        return "bg-amber-500/10 text-amber-400";
      case "suspended":
        return "bg-red-500/10 text-red-400";
    }
  }

  if (!activeWorkspace) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">
            Staff
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manage accounts and access to {activeWorkspace.server_name}.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadStaff()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/[0.04] disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {notice && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          {notice}
        </div>
      )}

      {canInvite && (
        <section className="rounded-xl border border-white/[0.06] bg-[#111114] p-5">
          <div className="mb-4 flex items-center gap-2">
            <UserPlus size={18} className="text-emerald-400" />
            <h2 className="text-sm font-semibold text-white">
              Create staff account
            </h2>
          </div>

          <form onSubmit={handleCreateAccount} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="staff-username"
                  className="mb-2 block text-xs font-medium text-zinc-400"
                >
                  Username
                </label>
                <input
                  id="staff-username"
                  type="text"
                  required
                  minLength={3}
                  maxLength={24}
                  autoComplete="off"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="staff_username"
                  className="w-full rounded-lg border border-white/10 bg-[#09090b] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label
                  htmlFor="staff-display-name"
                  className="mb-2 block text-xs font-medium text-zinc-400"
                >
                  Display name
                </label>
                <input
                  id="staff-display-name"
                  type="text"
                  maxLength={80}
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Staff member name"
                  className="w-full rounded-lg border border-white/10 bg-[#09090b] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label
                  htmlFor="staff-password"
                  className="mb-2 block text-xs font-medium text-zinc-400"
                >
                  Temporary password
                </label>
                <input
                  id="staff-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full rounded-lg border border-white/10 bg-[#09090b] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label
                  htmlFor="staff-role"
                  className="mb-2 block text-xs font-medium text-zinc-400"
                >
                  Workspace role
                </label>
                <select
                  id="staff-role"
                  required
                  value={roleId}
                  onChange={(event) => setRoleId(event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#09090b] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={creatingAccount || !roleId}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <KeyRound size={16} />
              {creatingAccount ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="mt-3 text-xs text-zinc-500">
            Give the staff member their username and temporary password
            securely. They will be asked to change the password after signing
            in once that requirement is enabled.
          </p>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#111114]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Workspace members
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              {members.length} member{members.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-zinc-500">
            Loading staff...
          </div>
        ) : members.length === 0 ? (
          <div className="py-16 text-center">
            <Shield size={28} className="mx-auto mb-3 text-zinc-600" />
            <p className="text-sm text-zinc-400">No staff members yet.</p>
            {canInvite && (
              <p className="mt-1 text-xs text-zinc-600">
                Create an account to give someone workspace access.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="border-b border-white/[0.06] bg-white/[0.02]">
                <tr className="text-xs text-zinc-500">
                  <th className="px-5 py-3 font-medium">Member</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Joined / invited</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/[0.05]">
                {members.map((member) => {
                  const isSelf = member.user_id === user?.id;
                  const isBusy = busyMemberId === member.id;
                  const label = getMemberLabel(member.email);

                  return (
                    <tr key={member.id} className="text-sm">
                      <td className="px-5 py-4">
                        <p className="font-medium text-zinc-200">
                          {label}
                          {isSelf && (
                            <span className="ml-2 text-xs text-zinc-500">
                              You
                            </span>
                          )}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        {canChangeRole && !isSelf ? (
                          <select
                            value={member.role_id}
                            disabled={isBusy}
                            onChange={(event) =>
                              void manageMember(
                                member,
                                "change_role",
                                event.target.value,
                              )
                            }
                            className="max-w-48 rounded-md border border-white/10 bg-[#09090b] px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-emerald-500/50 disabled:opacity-50"
                          >
                            {roles.map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-zinc-400">
                            {member.role_name ?? "No role"}
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusStyle(member.status)}`}
                        >
                          {member.status}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-xs text-zinc-500">
                        {new Date(member.created_at).toLocaleDateString()}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {!isSelf &&
                            member.status === "active" &&
                            canSuspend && (
                              <button
                                type="button"
                                title="Suspend member"
                                disabled={isBusy}
                                onClick={() =>
                                  void manageMember(member, "suspend")
                                }
                                className="rounded-md p-2 text-amber-400 transition hover:bg-amber-500/10 disabled:opacity-40"
                              >
                                <UserX size={15} />
                              </button>
                            )}

                          {!isSelf &&
                            member.status === "suspended" &&
                            canSuspend && (
                              <button
                                type="button"
                                title="Reactivate member"
                                disabled={isBusy}
                                onClick={() =>
                                  void manageMember(member, "activate")
                                }
                                className="rounded-md p-2 text-emerald-400 transition hover:bg-emerald-500/10 disabled:opacity-40"
                              >
                                <UserCheck size={15} />
                              </button>
                            )}

                          {!isSelf && canRemove && (
                            <button
                              type="button"
                              title="Remove member"
                              disabled={isBusy}
                              onClick={() =>
                                void manageMember(member, "remove")
                              }
                              className="rounded-md p-2 text-red-400 transition hover:bg-red-500/10 disabled:opacity-40"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}

                          {isBusy && (
                            <RefreshCw
                              size={14}
                              className="animate-spin text-zinc-500"
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
