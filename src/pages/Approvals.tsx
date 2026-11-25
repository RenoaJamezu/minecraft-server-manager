import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Check,
  X,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useApprovals } from "../hooks/useApprovals";
import type {
  ApprovalFilter,
  ApprovalRequest,
  ApprovalStatus,
  PaymentAllocation,
} from "../types/approval";

const REQUEST_LABELS: Record<string, string> = {
  "player.create": "Create player",
  "player.update": "Update player",
  "expense.create": "Create expense",
  "expense.update": "Update expense",
  "payment.cash": "Cash payment",
  "wallet.spend": "Wallet spending",
  "wallet.membership_payment": "Membership payment",
  "wallet.withdraw": "Wallet withdrawal",
  "wallet.purchase": "Wallet purchase",
  "wallet.top_up": "Wallet top-up",
};

const FIELD_LABELS: Record<string, string> = {
  player_id: "Player",
  payer_player_id: "Paid by",
  beneficiary_player_id: "Beneficiary",
  minecraft_username: "Minecraft username",
  discord_username: "Discord username",
  monthly_fee: "Monthly fee",
  joined_at: "Joined date",
  notes: "Notes",
  titles: "Titles",
  expense_id: "Expense",
  title: "Title",
  category: "Category",
  amount: "Amount",
  expense_date: "Expense date",
  allocations: "Payment allocations",
  payment_date: "Payment date",
  month_count: "Months",
  description: "Description",
  item_name: "Item",
  purpose: "Purpose",
  total_received: "Total received",
  total_allocated: "Total allocated",
  wallet_credited: "Wallet credit",
  status: "Status",
};

const INTERNAL_KEYS = new Set([
  "request_id",
  "payment_id",
  "expense_id",
  "id",
  "player_id",
  "payer_player_id",
  "beneficiary_player_id",
]);

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\./g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(isDateOnly ? `${value}T00:00:00` : value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString(undefined, {
        dateStyle: "medium",
        ...(isDateOnly ? {} : { timeStyle: "short" }),
      });
}

function formatMoney(value: unknown) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) return "—";

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatValue(value: unknown, key?: string): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (
    key &&
    [
      "amount",
      "monthly_fee",
      "total_received",
      "total_allocated",
      "wallet_credited",
    ].includes(key)
  ) {
    return formatMoney(value);
  }

  if (key && ["joined_at", "payment_date", "expense_date"].includes(key)) {
    return formatDate(String(value));
  }

  if (Array.isArray(value)) {
    return value.length
      ? value.map((item) => formatValue(item)).join(", ")
      : "—";
  }

  if (typeof value === "object") {
    return "Additional details";
  }

  return String(value);
}

function statusClasses(status: ApprovalStatus) {
  switch (status) {
    case "approved":
      return "bg-emerald-500/10 text-emerald-400";
    case "rejected":
      return "bg-red-500/10 text-red-400";
    default:
      return "bg-amber-500/10 text-amber-400";
  }
}

function StatusIcon({ status }: { status: ApprovalStatus }) {
  if (status === "approved") return <CheckCircle2 size={15} />;
  if (status === "rejected") return <XCircle size={15} />;
  return <Clock size={15} />;
}

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/[0.05] bg-black/20 p-3">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <div className="break-words text-sm text-zinc-200">{value}</div>
    </div>
  );
}

export default function Approvals() {
  const { user, activeWorkspace } = useAuth();
  const serverId = activeWorkspace?.server_id;

  const {
    requests,
    loading,
    isApprover,
    busyRequestId,
    error,
    notice,
    loadRequests,
    getPlayerName,
    reviewRequest,
  } = useApprovals(serverId);

  const [filter, setFilter] = useState<ApprovalFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<
    Record<string, string>
  >({});

  const filteredRequests = useMemo(
    () =>
      filter === "all"
        ? requests
        : requests.filter((request) => request.status === filter),
    [filter, requests],
  );

  const counts = useMemo(
    () => ({
      all: requests.length,
      pending: requests.filter((item) => item.status === "pending").length,
      approved: requests.filter((item) => item.status === "approved").length,
      rejected: requests.filter((item) => item.status === "rejected").length,
    }),
    [requests],
  );

  function renderAllocations(value: unknown) {
    if (!Array.isArray(value) || value.length === 0) {
      return <p className="text-sm text-zinc-500">No allocations provided.</p>;
    }

    return (
      <div className="space-y-2">
        {value.map((item, index) => {
          const allocation = item as PaymentAllocation;

          return (
            <div
              key={`${allocation.player_id ?? "allocation"}-${index}`}
              className="rounded-lg border border-white/[0.05] bg-black/20 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-zinc-200">
                    {getPlayerName(allocation.player_id)}
                  </p>
                  <p className="mt-1 text-xs capitalize text-zinc-500">
                    {(allocation.purpose ?? "Other").replace(/_/g, " ")}
                  </p>
                </div>

                <p className="text-sm font-semibold tabular-nums text-white">
                  {formatMoney(allocation.amount)}
                </p>
              </div>

              {allocation.description && (
                <p className="mt-2 text-xs text-zinc-400">
                  {allocation.description}
                </p>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function renderPlayerCreate(payload: Record<string, unknown>) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailItem
          label="Minecraft username"
          value={formatValue(payload.minecraft_username)}
        />
        <DetailItem
          label="Discord username"
          value={formatValue(payload.discord_username)}
        />
        <DetailItem
          label="Monthly fee"
          value={formatMoney(payload.monthly_fee)}
        />
        <DetailItem
          label="Joined date"
          value={formatDate(
            typeof payload.joined_at === "string" ? payload.joined_at : null,
          )}
        />
        <DetailItem label="Titles" value={formatValue(payload.titles)} />
        <DetailItem label="Notes" value={formatValue(payload.notes)} />
      </div>
    );
  }

  function renderCashPayment(payload: Record<string, unknown>) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <DetailItem
            label="Paid by"
            value={getPlayerName(payload.payer_player_id)}
          />
          <DetailItem
            label="Amount received"
            value={formatMoney(payload.amount)}
          />
          <DetailItem
            label="Payment date"
            value={formatDate(
              typeof payload.payment_date === "string"
                ? payload.payment_date
                : null,
            )}
          />
          <DetailItem label="Notes" value={formatValue(payload.notes)} />
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Payment allocations
          </p>
          {renderAllocations(payload.allocations)}
        </div>
      </div>
    );
  }

  function renderGenericPayload(payload: Record<string, unknown>) {
    const entries = Object.entries(payload).filter(
      ([key]) => !INTERNAL_KEYS.has(key),
    );

    if (!entries.length) {
      return (
        <p className="text-sm text-zinc-500">No additional details provided.</p>
      );
    }

    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {entries.map(([key, value]) => {
          if (key === "allocations") {
            return (
              <div key={key} className="sm:col-span-2">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  Payment allocations
                </p>
                {renderAllocations(value)}
              </div>
            );
          }

          if (
            value !== null &&
            typeof value === "object" &&
            !Array.isArray(value)
          ) {
            return (
              <div key={key} className="sm:col-span-2">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  {FIELD_LABELS[key] ?? formatLabel(key)}
                </p>

                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(value as Record<string, unknown>)
                    .filter(([nestedKey]) => !INTERNAL_KEYS.has(nestedKey))
                    .map(([nestedKey, nestedValue]) => (
                      <DetailItem
                        key={nestedKey}
                        label={
                          FIELD_LABELS[nestedKey] ?? formatLabel(nestedKey)
                        }
                        value={formatValue(nestedValue, nestedKey)}
                      />
                    ))}
                </div>
              </div>
            );
          }

          return (
            <DetailItem
              key={key}
              label={FIELD_LABELS[key] ?? formatLabel(key)}
              value={formatValue(value, key)}
            />
          );
        })}
      </div>
    );
  }

  function renderPayload(request: ApprovalRequest) {
    const payload = request.payload ?? {};

    switch (request.request_type) {
      case "player.create":
        return renderPlayerCreate(payload);

      case "payment.cash":
        return renderCashPayment(payload);

      default:
        return renderGenericPayload(payload);
    }
  }

  function renderAppliedResult(request: ApprovalRequest) {
    const result = request.applied_result;

    if (!result) return null;

    return (
      <div className="space-y-3">
        <p className="text-sm text-zinc-200">
          {result.success === true
            ? "The requested operation was completed successfully."
            : "The operation did not report a successful result."}
        </p>

        {request.request_type === "player.create" &&
          typeof result.player_id === "string" && (
            <DetailItem
              label="Created player"
              value={getPlayerName(result.player_id)}
            />
          )}

        {request.request_type === "payment.cash" && (
          <div className="grid gap-3 sm:grid-cols-3">
            <DetailItem
              label="Total received"
              value={formatMoney(result.total_received)}
            />
            <DetailItem
              label="Total allocated"
              value={formatMoney(result.total_allocated)}
            />
            <DetailItem
              label="Credited to payer wallet"
              value={formatMoney(result.wallet_credited)}
            />
          </div>
        )}

        {Array.isArray(result.allocations) && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Applied allocations
            </p>
            {renderAllocations(result.allocations)}
          </div>
        )}
      </div>
    );
  }

  if (!activeWorkspace) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">
            Approvals
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {isApprover
              ? `Review workspace requests for ${activeWorkspace.server_name}.`
              : "Track the status of your submitted requests."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadRequests()}
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["all", "All requests"],
            ["pending", "Pending"],
            ["approved", "Approved"],
            ["rejected", "Rejected"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-xl border p-4 text-left transition ${
              filter === key
                ? "border-emerald-500/30 bg-emerald-500/[0.07]"
                : "border-white/[0.06] bg-[#111114] hover:bg-white/[0.03]"
            }`}
          >
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-white">
              {counts[key]}
            </p>
          </button>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#111114]">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-sm font-semibold text-white">
            {filter === "all"
              ? "All requests"
              : `${formatLabel(filter)} requests`}
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            {filteredRequests.length} request
            {filteredRequests.length === 1 ? "" : "s"}
          </p>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-zinc-500">
            Loading requests...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-16 text-center">
            <ClipboardCheck size={30} className="mx-auto mb-3 text-zinc-600" />
            <p className="text-sm text-zinc-400">No requests found.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {filteredRequests.map((request) => {
              const expanded = expandedId === request.id;
              const busy = busyRequestId === request.id;

              return (
                <article key={request.id} className="p-5">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId(expanded ? null : request.id)
                      }
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-zinc-100">
                          {REQUEST_LABELS[request.request_type] ??
                            formatLabel(request.request_type)}
                        </h3>

                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${statusClasses(request.status)}`}
                        >
                          <StatusIcon status={request.status} />
                          {request.status}
                        </span>
                      </div>

                      <p className="mt-2 text-xs text-zinc-500">
                        Submitted by{" "}
                        <span className="text-zinc-300">
                          {request.submitter_label ||
                            (request.submitter_user_id === user?.id
                              ? "You"
                              : "Workspace member")}
                        </span>
                        {" · "}
                        {formatDate(request.created_at)}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId(expanded ? null : request.id)
                      }
                      className="inline-flex items-center gap-2 self-start text-xs text-zinc-400 hover:text-white"
                    >
                      {expanded ? "Hide details" : "View details"}
                      {expanded ? (
                        <ChevronUp size={15} />
                      ) : (
                        <ChevronDown size={15} />
                      )}
                    </button>
                  </div>

                  {expanded && (
                    <div className="mt-5 space-y-4 border-t border-white/[0.06] pt-4">
                      <div>
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Request details
                        </p>
                        {renderPayload(request)}
                      </div>

                      {request.status !== "pending" && (
                        <div className="grid gap-3 border-t border-white/[0.06] pt-4 sm:grid-cols-2">
                          <DetailItem
                            label="Reviewed at"
                            value={formatDate(request.reviewed_at)}
                          />
                          <DetailItem
                            label="Reviewer"
                            value={
                              request.reviewer_user_id === user?.id
                                ? "You"
                                : request.reviewer_user_id
                                  ? "Workspace approver"
                                  : "—"
                            }
                          />
                        </div>
                      )}

                      {request.status === "rejected" &&
                        request.rejection_reason && (
                          <div className="rounded-lg border border-red-500/20 bg-red-500/[0.06] p-3">
                            <p className="text-xs font-semibold text-red-400">
                              Rejection reason
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-300">
                              {request.rejection_reason}
                            </p>
                          </div>
                        )}

                      {request.status === "approved" &&
                        request.applied_result && (
                          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
                            <p className="mb-3 text-xs font-semibold text-emerald-400">
                              Applied result
                            </p>
                            {renderAppliedResult(request)}
                          </div>
                        )}

                      {isApprover && request.status === "pending" && (
                        <div className="space-y-3 border-t border-white/[0.06] pt-4">
                          <div>
                            <label
                              htmlFor={`rejection-${request.id}`}
                              className="mb-2 block text-xs font-medium text-zinc-400"
                            >
                              Rejection reason (optional)
                            </label>
                            <textarea
                              id={`rejection-${request.id}`}
                              rows={2}
                              maxLength={1000}
                              value={rejectionReasons[request.id] ?? ""}
                              onChange={(event) =>
                                setRejectionReasons((current) => ({
                                  ...current,
                                  [request.id]: event.target.value,
                                }))
                              }
                              placeholder="Explain why this request is being rejected..."
                              className="w-full resize-y rounded-lg border border-white/10 bg-[#09090b] px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-emerald-500/50"
                            />
                          </div>

                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void reviewRequest(
                                  request,
                                  "rejected",
                                  rejectionReasons[request.id],
                                )
                              }
                              className="inline-flex items-center gap-2 rounded-lg border border-red-500/20 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
                            >
                              <X size={15} />
                              Reject
                            </button>

                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void reviewRequest(request, "approved")
                              }
                              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50"
                            >
                              {busy ? (
                                <RefreshCw size={15} className="animate-spin" />
                              ) : (
                                <Check size={15} />
                              )}
                              {busy ? "Processing..." : "Approve"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
