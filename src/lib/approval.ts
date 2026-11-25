import { supabase } from "./supabase";

export const APPROVAL_SUBMITTED_MESSAGE = "APPROVAL_SUBMITTED";

export type ApprovalRequestType =
  | "player.create"
  | "player.update"
  | "expense.create"
  | "expense.update"
  | "payment.cash"
  | "wallet.spend"
  | "wallet.membership_payment"
  | "wallet.withdraw"
  | "wallet.purchase"
  | "wallet.top_up";

interface SubmitApprovalOptions {
  serverId: string;
  requestType: ApprovalRequestType;
  payload: Record<string, unknown>;
  clientRequestId?: string;
}

export async function submitApprovalIfRequired({
  serverId,
  requestType,
  payload,
  clientRequestId,
}: SubmitApprovalOptions): Promise<boolean> {
  const { data: isApprover, error: approverError } = await supabase.rpc(
    "is_server_approver",
    {
      p_server_id: serverId,
    },
  );

  if (approverError) {
    throw approverError;
  }

  // Owner and Administrator actions continue through the existing direct path.
  if (isApprover === true) {
    return false;
  }

  const { data, error } = await supabase.rpc("submit_server_approval_request", {
    p_server_id: serverId,
    p_request_type: requestType,
    p_payload: payload,
    p_client_request_id: clientRequestId ?? null,
  });

  if (error) {
    throw error;
  }

  if (!data?.success || !data?.request_id) {
    throw new Error("The approval request could not be confirmed.");
  }

  return true;
}
