export type PlayerStatus = "active" | "inactive";

export type PlayerFilter = "all" | PlayerStatus | "banned" | "streamers";

export type MembershipCoverageStatus =
  | "paid"
  | "grace"
  | "expired"
  | "unpaid"
  | "scheduled";

export const PLAYER_BUILT_IN_TITLES = [
  "Owner",
  "Admin",
  "Mod",
  "Streamer",
  "Booster",
] as const;

export type PlayerBuiltInTitle = (typeof PLAYER_BUILT_IN_TITLES)[number];

export interface Player {
  id: string;
  minecraft_username: string;
  discord_username: string | null;
  monthly_fee: number;
  status: PlayerStatus;
  joined_at: string;
  notes: string | null;
  titles: string[];
  ban_reason: string | null;
  banned_at: string | null;
  wallet_balance: number;
  membership_status: MembershipCoverageStatus;
  paid_through: string | null;
  grace_ends_at: string | null;
  next_period_start: string | null;
}

export function isPlayerBanned(player: Player): boolean {
  return player.banned_at !== null;
}

export function isPlayerActive(player: Player): boolean {
  return (
    !isPlayerBanned(player) &&
    (player.membership_status === "paid" ||
      player.membership_status === "grace")
  );
}

export function getPlayerDisplayStatus(
  player: Player,
): "Banned" | "Active" | "Expired" | "Inactive" {
  if (isPlayerBanned(player)) return "Banned";
  if (isPlayerActive(player)) return "Active";
  if (player.membership_status === "expired") return "Expired";
  return "Inactive";
}

export interface PlayerFormValues {
  minecraft_username: string;
  discord_username: string;
  monthly_fee: string;
  status: PlayerStatus;
  joined_at: string;
  notes: string;
  titles: string[];
  is_banned: boolean;
  ban_reason: string;
}
