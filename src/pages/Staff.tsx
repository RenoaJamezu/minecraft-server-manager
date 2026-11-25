import { useEffect, useState, type FormEvent } from "react";
import {
  RefreshCw,
  UserPlus,
  Shield,
  UserX,
  UserCheck,
  Trash2,
  KeyRound,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useStaff } from "../hooks/useStaff";
import type { StaffMember } from "../types/staff";

function getMemberLabel(email: string) {
  return email.endsWith("@staff.invalid")
    ? email.replace("@staff.invalid", "")
    : email;
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

export default function Staff() {
  const { user, activeWorkspace, hasPermission } = useAuth();

  const serverId = activeWorkspace?.server_id;

  const {
    members,
    roles,
    loading,
    refreshing,
    creatingAccount,
    busyMemberId,
    error,
    notice,
    setNotice,
    loadStaff,
    createStaffAccount,
    manageMember,
  } = useStaff(serverId);

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState("");

  const canInvite = hasPermission("staff.invite");
  const canChangeRole = hasPermission("staff.update_role");
  const canSuspend = hasPermission("staff.suspend");
  const canRemove = hasPermission("staff.remove");

  // Select the first available role when no valid role is selected.
  useEffect(() => {
    if (roles.length === 0) {
      setRoleId("");
      return;
    }

    setRoleId((current) =>
      current && roles.some((role) => role.id === current)
        ? current
        : roles[0].id,
    );
  }, [roles]);

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!serverId || !canInvite || !roleId) return;

    const normalizedUsername = username.trim().toLowerCase();

    if (!/^[a-z0-9._-]{3,24}$/.test(normalizedUsername)) {
      return;
    }

    if (password.length < 8) {
      return;
    }

    const success = await createStaffAccount({
      username: normalizedUsername,
      displayName: displayName.trim(),
      password,
      roleId,
    });

    if (success) {
      setUsername("");
      setDisplayName("");
      setPassword("");
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
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/[0.04] disabled:opacity-50"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
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
          <button
            type="button"
            onClick={() => setNotice("")}
            className="ml-3 text-xs underline"
          >
            Dismiss
          </button>
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
            securely. They will be asked to change the password after signing in
            once that requirement is enabled.
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
