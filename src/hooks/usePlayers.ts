
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  APPROVAL_SUBMITTED_MESSAGE,
  submitApprovalIfRequired,
} from "../lib/approval";
import { supabase } from "../lib/supabase";
import type {
  MembershipCoverageStatus,
  Player,
  PlayerFormValues,
} from "../types/player";

interface MembershipPeriod {
  player_id: string;
  period_start: string;
  period_end: string;
}

interface MembershipCoverage {
  membership_status: MembershipCoverageStatus;
  paid_through: string | null;
  grace_ends_at: string | null;
  next_period_start: string | null;
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(dateString: string, days: number) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  date.setDate(date.getDate() + days);

  return getLocalDateString(date);
}

function normalizePlayerTitles(titles: unknown): string[] {
  const normalizedTitles = Array.isArray(titles)
    ? titles
        .filter(
          (title): title is string =>
            typeof title === "string" && title.trim().length > 0,
        )
        .map((title) => title.trim())
    : [];

  return Array.from(
    new Map(
      normalizedTitles.map((title) => [title.toLowerCase(), title]),
    ).values(),
  );
}

function calculateMembershipCoverage(
  periods: MembershipPeriod[],
  today: string,
): MembershipCoverage {
  if (periods.length === 0) {
    return {
      membership_status: "unpaid",
      paid_through: null,
      grace_ends_at: null,
      next_period_start: null,
    };
  }

  const sortedPeriods = [...periods].sort((a, b) =>
    a.period_end.localeCompare(b.period_end),
  );

  const latestPeriod = sortedPeriods[sortedPeriods.length - 1];

  const currentPeriod = sortedPeriods.find(
    (period) => period.period_start <= today && period.period_end >= today,
  );

  const nextPeriod = sortedPeriods.find(
    (period) => period.period_start > today,
  );

  const previousPeriods = sortedPeriods.filter(
    (period) => period.period_end < today,
  );

  const latestEndedPeriod =
    previousPeriods.length > 0
      ? previousPeriods[previousPeriods.length - 1]
      : null;

  const paidThrough = latestPeriod.period_end;

  if (currentPeriod) {
    return {
      membership_status: "paid",
      paid_through: paidThrough,
      grace_ends_at: addDays(paidThrough, 3),
      next_period_start: nextPeriod?.period_start ?? null,
    };
  }

  if (latestEndedPeriod) {
    const graceEndsAt = addDays(latestEndedPeriod.period_end, 3);

    if (today <= graceEndsAt) {
      return {
        membership_status: "grace",
        paid_through: paidThrough,
        grace_ends_at: graceEndsAt,
        next_period_start: nextPeriod?.period_start ?? null,
      };
    }

    return {
      membership_status: "expired",
      paid_through: paidThrough,
      grace_ends_at: graceEndsAt,
      next_period_start: nextPeriod?.period_start ?? null,
    };
  }

  return {
    membership_status: "scheduled",
    paid_through: paidThrough,
    grace_ends_at: addDays(paidThrough, 3),
    next_period_start: nextPeriod?.period_start ?? latestPeriod.period_start,
  };
}

export function usePlayers() {
  const { user, activeWorkspace, workspaceLoading } = useAuth();

  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchRequestRef = useRef(0);

  const fetchPlayers = useCallback(async () => {
    const requestId = ++fetchRequestRef.current;

    if (workspaceLoading) {
      setLoading(true);
      return;
    }

    if (!user || !activeWorkspace) {
      setPlayers([]);
      setLoading(false);
      return;
    }

    const serverId = activeWorkspace.server_id;

    setLoading(true);
    setError("");
    setPlayers([]);

    const { data: playerData, error: playerError } = await supabase
      .from("players")
      .select(
        "id, minecraft_username, discord_username, monthly_fee, status, joined_at, notes, titles, ban_reason, banned_at",
      )
      .eq("server_id", serverId)
      .order("minecraft_username", { ascending: true });

    if (requestId !== fetchRequestRef.current) return;

    if (playerError) {
      console.error("Failed to fetch players:", playerError);
      setError("Unable to load players. Please try again.");
      setPlayers([]);
      setLoading(false);
      return;
    }

    const fetchedPlayers = playerData ?? [];

    if (fetchedPlayers.length === 0) {
      setPlayers([]);
      setLoading(false);
      return;
    }

    const playerIds = fetchedPlayers.map((player) => player.id);

    const [balancesResult, periodsResult] = await Promise.all([
      supabase
        .from("player_wallet_balances")
        .select("player_id, balance, server_id")
        .eq("server_id", serverId)
        .in("player_id", playerIds),

      supabase
        .from("membership_periods")
        .select("player_id, period_start, period_end")
        .eq("server_id", serverId)
        .in("player_id", playerIds)
        .is("reversed_at", null)
        .order("period_end", { ascending: false }),
    ]);

    if (requestId !== fetchRequestRef.current) return;

    const secondaryError = balancesResult.error || periodsResult.error;

    if (secondaryError) {
      console.error("Failed to fetch player balances or membership periods:", {
        balancesError: balancesResult.error,
        periodsError: periodsResult.error,
      });

      setError("Unable to load complete player information. Please try again.");
      setPlayers([]);
      setLoading(false);
      return;
    }

    const balanceMap = new Map<string, number>();

    for (const row of balancesResult.data ?? []) {
      if (row.player_id) {
        balanceMap.set(row.player_id, Number(row.balance ?? 0));
      }
    }

    const periodsByPlayer = new Map<string, MembershipPeriod[]>();

    for (const period of (periodsResult.data ?? []) as MembershipPeriod[]) {
      const existing = periodsByPlayer.get(period.player_id) ?? [];
      existing.push(period);
      periodsByPlayer.set(period.player_id, existing);
    }

    const today = getLocalDateString();

    const mappedPlayers: Player[] = fetchedPlayers.map((player) => {
      const periods = periodsByPlayer.get(player.id) ?? [];
      const coverage = calculateMembershipCoverage(periods, today);

      return {
        ...player,
        monthly_fee: Number(player.monthly_fee),
        titles: normalizePlayerTitles(player.titles),
        wallet_balance: balanceMap.get(player.id) ?? 0,
        ...coverage,
      };
    });

    setPlayers(mappedPlayers);
    setLoading(false);
  }, [user, activeWorkspace, workspaceLoading]);

  useEffect(() => {
    void fetchPlayers();
  }, [fetchPlayers]);

  const savePlayer = async (
    values: PlayerFormValues,
    editingPlayer: Player | null,
  ): Promise<string | null> => {
    const username = values.minecraft_username.trim();
    const monthlyFee = Number(values.monthly_fee);

    if (!username) {
      return "Minecraft username is required.";
    }

    if (!Number.isFinite(monthlyFee) || monthlyFee < 0) {
      return "Enter a valid monthly fee.";
    }

    if (!user) {
      return "Your session has expired. Please sign in again.";
    }

    if (workspaceLoading || !activeWorkspace) {
      return "No active workspace selected. Please try again.";
    }

    if (
      editingPlayer &&
      !players.some((player) => player.id === editingPlayer.id)
    ) {
      return "This player does not belong to the active workspace.";
    }

    const serverId = activeWorkspace.server_id;

    const payload = {
      minecraft_username: username,
      discord_username: values.discord_username.trim() || null,
      monthly_fee: monthlyFee,
      joined_at: values.joined_at,
      notes: values.notes.trim() || null,
      titles: normalizePlayerTitles(values.titles),
    };

    setSaving(true);

    try {
      const submitted = await submitApprovalIfRequired({
        serverId,
        requestType: editingPlayer ? "player.update" : "player.create",
        payload: editingPlayer
          ? {
              ...payload,
              player_id: editingPlayer.id,
            }
          : payload,
      });

      if (submitted) {
        return APPROVAL_SUBMITTED_MESSAGE;
      }

      if (editingPlayer) {
        const { error: updateError } = await supabase
          .from("players")
          .update(payload)
          .eq("id", editingPlayer.id)
          .eq("server_id", serverId);

        if (updateError) {
          console.error("Failed to update player:", updateError);

          await fetchPlayers();

          return updateError.code === "23505"
            ? "That Minecraft username already exists."
            : "Unable to update player details. Please try again.";
        }
      } else {
        const { error: insertError } = await supabase.from("players").insert({
          ...payload,
          status: "active",
          owner_id: activeWorkspace.owner_id,
          server_id: serverId,
        });

        if (insertError) {
          console.error("Failed to create player:", insertError);

          return insertError.code === "23505"
            ? "That Minecraft username already exists."
            : "Unable to create player. Please check your permissions and try again.";
        }
      }

      await fetchPlayers();

      return null;
    } catch (saveError) {
      console.error("Unexpected error saving player:", saveError);

      return "An unexpected error occurred. Please try again.";
    } finally {
      setSaving(false);
    }
  };

  return {
    players,
    loading,
    saving,
    error,
    fetchPlayers,
    savePlayer,
  };
}
