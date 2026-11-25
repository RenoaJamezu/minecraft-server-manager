import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useAuditLogs } from "../hooks/useAuditLogs";
import type {
  AppliedResult,
  ApprovalRequest,
  AuditLog,
  PaymentAllocation,
  PlayerRecord,
} from "../types/auditLog";

function getObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function getString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getAppliedResult(log: AuditLog): AppliedResult {
  return getObject(log.details.applied_result) as AppliedResult;
}

function getAllocations(log: AuditLog): PaymentAllocation[] {
  const allocations = getAppliedResult(log).allocations;
  return Array.isArray(allocations) ? allocations : [];
}

function formatRequestType(value: string): string {
  const labels: Record<string, string> = {
    "player.create": "Player creation",
    "player.update": "Player update",
    "player.status": "Player status change",
    "payment.cash": "Cash payment",
    "payment.wallet": "Wallet payment",
    "wallet.top_up": "Wallet top-up",
    "wallet.withdraw": "Wallet withdrawal",
    "wallet.spend": "Wallet spending",
    "expense.create": "Expense creation",
    "expense.update": "Expense update",
  };

  return (
    labels[value] ??
    value
      .split(/[._]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function formatAction(action: string): string {
  const labels: Record<string, string> = {
    "approval.approved": "Approval request approved",
    "approval.submitted": "Approval request submitted",
    "approval.rejected": "Approval request rejected",
    "staff.created": "Staff account created",
    "staff.role_changed": "Staff role changed",
    "staff.suspended": "Staff account suspended",
    "staff.activated": "Staff account activated",
    "staff.removed": "Staff account removed",
  };

  if (labels[action]) return labels[action];

  return action
    .split(".")
    .map((part) =>
      part
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" "),
    )
    .join(" · ");
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getLocalDate(value: string): string {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatPeso(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getPlayerName(
  playerId: string | undefined,
  players: Record<string, PlayerRecord>,
): string | null {
  if (!playerId) return null;
  return players[playerId]?.minecraft_username ?? null;
}

function getAffectedLabel(
  log: AuditLog,
  players: Record<string, PlayerRecord>,
): string {
  const details = log.details ?? {};

  if (log.action === "staff.role_changed") {
    return getString(details.staff_label, "Staff member");
  }

  if (log.action.startsWith("approval.")) {
    const requestType = getString(details.request_type);

    if (requestType === "player.create") {
      const playerName = getPlayerName(
        getAppliedResult(log).player_id,
        players,
      );

      return playerName ? `Player: ${playerName}` : "Player creation";
    }

    if (requestType === "payment.cash") {
      const names = getAllocations(log)
        .map((allocation) => getPlayerName(allocation.player_id, players))
        .filter((name): name is string => Boolean(name));

      return names.length ? `Players: ${names.join(", ")}` : "Cash payment";
    }

    return requestType ? formatRequestType(requestType) : "Approval request";
  }

  const label =
    getString(details.member_label) ||
    getString(details.staff_label) ||
    getString(details.target_label);

  return label || "—";
}

function getEventSummary(
  log: AuditLog,
  players: Record<string, PlayerRecord>,
): string {
  const details = log.details ?? {};

  switch (log.action) {
    case "approval.submitted":
      return `${formatRequestType(
        getString(details.request_type, "workspace"),
      )} request submitted for review.`;

    case "approval.approved": {
      const requestType = getString(details.request_type, "workspace");
      const result = getAppliedResult(log);

      if (result.success === false) {
        return `${formatRequestType(requestType)} was approved, but the operation did not complete successfully.`;
      }

      if (requestType === "player.create") {
        const playerName = getPlayerName(result.player_id, players);

        return playerName
          ? `Player ${playerName} was successfully created after approval.`
          : "Player creation was successfully approved.";
      }

      if (requestType === "payment.cash") {
        const total = getNumber(result.total_received);

        return total !== null
          ? `Cash payment of ${formatPeso(total)} was successfully approved.`
          : "Cash payment was successfully approved.";
      }

      return `${formatRequestType(requestType)} was successfully approved.`;
    }

    case "approval.rejected":
      return `${formatRequestType(
        getString(details.request_type, "Workspace"),
      )} request was rejected.`;

    case "staff.role_changed":
      return `${getString(
        details.staff_label,
        "Staff member",
      )} changed from ${getString(
        details.old_role_name,
        "previous role",
      )} to ${getString(details.new_role_name, "new role")}.`;

    case "staff.created":
      return `${getString(
        details.staff_label,
        "A staff member",
      )} was added to the workspace.`;

    case "staff.suspended":
      return `${getString(
        details.staff_label,
        "A staff member",
      )} was suspended.`;

    case "staff.activated":
      return `${getString(
        details.staff_label,
        "A staff member",
      )} was reactivated.`;

    case "staff.removed":
      return `${getString(
        details.staff_label,
        "A staff member",
      )} was removed from the workspace.`;

    default:
      return formatAction(log.action);
  }
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;

  return (
    <div className="min-w-0">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 break-words text-sm text-zinc-200">{value}</p>
    </div>
  );
}

function HumanDetails({
  log,
  approval,
  players,
}: {
  log: AuditLog;
  approval?: ApprovalRequest;
  players: Record<string, PlayerRecord>;
}) {
  const details = log.details ?? {};
  const result = getAppliedResult(log);
  const requestType = getString(details.request_type);
  const allocations = getAllocations(log);

  if (log.action === "staff.role_changed") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <DetailItem
          label="Staff member"
          value={getString(details.staff_label, "Unknown staff member")}
        />
        <DetailItem
          label="Previous role"
          value={getString(details.old_role_name)}
        />
        <DetailItem label="New role" value={getString(details.new_role_name)} />
        <DetailItem
          label="Performed by"
          value={log.actor_label || "Unknown staff member"}
        />
      </div>
    );
  }

  if (log.action.startsWith("approval.")) {
    const isSubmission = log.action === "approval.submitted";
    const isRejected = log.action === "approval.rejected";

    const submitter = isSubmission
      ? log.actor_label
      : approval?.submitter_label ||
        getString(details.submitter_label, "Unavailable");

    const playerName = getPlayerName(result.player_id, players);

    const allocationNames = allocations.map((allocation) => ({
      name:
        getPlayerName(allocation.player_id, players) ?? "Player unavailable",
      amount: getNumber(allocation.amount),
      purpose: getString(allocation.purpose),
    }));

    return (
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <DetailItem
            label="Request"
            value={formatRequestType(requestType || "workspace")}
          />
          <DetailItem
            label="Submitted by"
            value={submitter || "Unknown submitter"}
          />
          {!isSubmission && (
            <DetailItem
              label="Reviewed by"
              value={log.actor_label || "Unknown reviewer"}
            />
          )}
          {!isSubmission && (
            <DetailItem
              label="Outcome"
              value={
                isRejected
                  ? "Rejected"
                  : result.success === false
                    ? "Approved, but operation failed"
                    : "Approved successfully"
              }
            />
          )}
          {playerName && (
            <DetailItem label="Created player" value={playerName} />
          )}
          {approval?.rejection_reason && (
            <DetailItem
              label="Rejection reason"
              value={approval.rejection_reason}
            />
          )}
        </div>

        {requestType === "payment.cash" && !isSubmission && (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Payment breakdown
            </h4>

            <div className="grid gap-4 sm:grid-cols-3">
              <DetailItem
                label="Total received"
                value={
                  getNumber(result.total_received) !== null
                    ? formatPeso(result.total_received!)
                    : null
                }
              />
              <DetailItem
                label="Total allocated"
                value={
                  getNumber(result.total_allocated) !== null
                    ? formatPeso(result.total_allocated!)
                    : null
                }
              />
              <DetailItem
                label="Wallet credit"
                value={
                  getNumber(result.wallet_credited) !== null
                    ? formatPeso(result.wallet_credited!)
                    : null
                }
              />
            </div>

            {allocationNames.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-white/[0.06]">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 bg-white/[0.03] px-3 py-2 text-xs text-zinc-500">
                  <span>Player / purpose</span>
                  <span>Amount</span>
                </div>

                {allocationNames.map((allocation, index) => (
                  <div
                    key={`${allocation.name}-${index}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-t border-white/[0.05] px-3 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-zinc-200">
                        {allocation.name}
                      </p>
                      {allocation.purpose && (
                        <p className="mt-1 text-xs capitalize text-zinc-500">
                          {allocation.purpose.replaceAll("_", " ")}
                        </p>
                      )}
                    </div>
                    <span className="text-zinc-300">
                      {allocation.amount !== null
                        ? formatPeso(allocation.amount!)
                        : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <DetailItem
        label="Performed by"
        value={log.actor_label || "Unknown staff member"}
      />
      <DetailItem
        label="Affected member"
        value={getAffectedLabel(log, players)}
      />
      <DetailItem label="Activity" value={formatAction(log.action)} />
    </div>
  );
}

export default function AuditLogs() {
  const { activeWorkspace } = useAuth();

  const { logs, approvals, players, loading, error, reload } = useAuditLogs(
    activeWorkspace?.server_id,
    Boolean(activeWorkspace?.is_owner),
  );

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const actions = useMemo(
    () => [...new Set(logs.map((log) => log.action))].sort(),
    [logs],
  );

  const filteredLogs = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return logs.filter((log) => {
      if (actionFilter !== "all" && log.action !== actionFilter) {
        return false;
      }

      const logDate = getLocalDate(log.created_at);

      if (dateFrom && logDate < dateFrom) return false;
      if (dateTo && logDate > dateTo) return false;

      if (!normalizedSearch) return true;

      const approval = log.target_id ? approvals[log.target_id] : undefined;

      const searchableText = [
        formatAction(log.action),
        getEventSummary(log, players),
        log.actor_label,
        getAffectedLabel(log, players),
        approval?.submitter_label,
        approval?.rejection_reason,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [logs, search, actionFilter, dateFrom, dateTo, approvals, players]);

  if (!activeWorkspace?.is_owner) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-emerald-400" />
            <h1 className="text-xl font-semibold tracking-tight text-white">
              Audit Logs
            </h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Review activity and important changes in{" "}
            {activeWorkspace.server_name}.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void reload()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
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

      <section className="rounded-xl border border-white/[0.06] bg-[#111114] p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_minmax(180px,240px)_minmax(140px,180px)_minmax(140px,180px)]">
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search activity, staff, player..."
              className="w-full rounded-lg border border-white/10 bg-[#09090b] py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-emerald-500/50"
            />
          </div>

          <select
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[#09090b] px-3 py-2.5 text-sm text-zinc-300 outline-none focus:border-emerald-500/50"
          >
            <option value="all">All actions</option>
            {actions.map((action) => (
              <option key={action} value={action}>
                {formatAction(action)}
              </option>
            ))}
          </select>

          <input
            type="date"
            aria-label="From date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(event) => setDateFrom(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[#09090b] px-3 py-2.5 text-sm text-zinc-300 outline-none focus:border-emerald-500/50"
          />

          <input
            type="date"
            aria-label="To date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(event) => setDateTo(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[#09090b] px-3 py-2.5 text-sm text-zinc-300 outline-none focus:border-emerald-500/50"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
          <span>
            Showing {filteredLogs.length} of {logs.length} loaded events
          </span>

          <button
            type="button"
            onClick={() => {
              setSearch("");
              setActionFilter("all");
              setDateFrom("");
              setDateTo("");
            }}
            className="text-zinc-400 transition hover:text-white"
          >
            Clear filters
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#111114]">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-sm font-semibold text-white">Activity history</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Newest events appear first. Select an event to inspect what
            happened.
          </p>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-zinc-500">
            Loading audit logs...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-16 text-center">
            <ShieldCheck size={28} className="mx-auto mb-3 text-zinc-600" />
            <p className="text-sm text-zinc-400">
              {logs.length === 0
                ? "No audit events recorded yet."
                : "No events match your filters."}
            </p>
            {logs.length === 0 && (
              <p className="mt-1 text-xs text-zinc-600">
                Important workspace activity will appear here when logged.
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {filteredLogs.map((log) => {
              const expanded = expandedId === log.id;
              const approval = log.target_id
                ? approvals[log.target_id]
                : undefined;
              const affectedLabel = getAffectedLabel(log, players);

              return (
                <div key={log.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : log.id)}
                    aria-expanded={expanded}
                    className="grid w-full gap-3 px-5 py-4 text-left transition hover:bg-white/[0.02] sm:grid-cols-[minmax(0,1fr)_minmax(130px,180px)_20px] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-200">
                        {formatAction(log.action)}
                      </p>
                      <p className="mt-1 truncate text-xs text-zinc-500">
                        {getEventSummary(log, players)}
                      </p>
                      <p className="mt-1 truncate text-xs text-zinc-600">
                        {log.actor_label || "Unknown staff member"}
                        {affectedLabel !== "—" ? ` · ${affectedLabel}` : ""}
                      </p>
                    </div>

                    <span className="text-xs text-zinc-500 sm:text-right">
                      {formatDate(log.created_at)}
                    </span>

                    <span className="text-zinc-500">
                      {expanded ? (
                        <ChevronUp size={16} />
                      ) : (
                        <ChevronDown size={16} />
                      )}
                    </span>
                  </button>

                  {expanded && (
                    <div className="space-y-5 border-t border-white/[0.05] bg-black/20 px-5 py-4">
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-200">
                          What happened
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                          {getEventSummary(log, players)}
                        </p>
                      </div>

                      <div>
                        <h3 className="mb-3 text-sm font-semibold text-zinc-200">
                          Activity details
                        </h3>
                        <HumanDetails
                          log={log}
                          approval={approval}
                          players={players}
                        />
                      </div>

                      <details className="group rounded-lg border border-white/[0.06] bg-[#09090b]">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-medium text-zinc-500 transition hover:text-zinc-300">
                          Technical details
                          <ChevronDown
                            size={14}
                            className="transition group-open:rotate-180"
                          />
                        </summary>

                        <div className="space-y-3 border-t border-white/[0.06] p-4">
                          <div className="grid gap-3 text-xs sm:grid-cols-2">
                            <DetailItem label="Event ID" value={log.id} />
                            <DetailItem
                              label="Actor user ID"
                              value={log.actor_user_id}
                            />
                            <DetailItem
                              label="Target type"
                              value={log.target_type}
                            />
                            <DetailItem
                              label="Target ID"
                              value={log.target_id}
                            />
                          </div>

                          <div>
                            <p className="mb-2 text-xs font-medium text-zinc-500">
                              Original event data
                            </p>
                            <pre className="max-h-96 overflow-auto rounded-lg border border-white/[0.06] bg-black p-3 text-xs leading-relaxed text-zinc-400">
                              {JSON.stringify(log.details ?? {}, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!loading && logs.length === 500 && (
          <div className="border-t border-white/[0.06] px-5 py-3 text-xs text-zinc-500">
            Showing the latest 500 events only. Older events may exist.
          </div>
        )}
      </section>
    </div>
  );
}
