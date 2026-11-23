import { useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil } from "lucide-react";
import type { Player } from "../../types/player";
import { getPlayerDisplayStatus } from "../../types/player";

type SortColumn = "player" | "discord" | "joined" | "nextDue" | "status";
type SortDirection = "asc" | "desc";

interface PlayerTableProps {
  players: Player[];
  loading: boolean;
  totalPlayers: number;
  onEdit: (player: Player) => void;
}

interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

function formatDate(date: string | null | undefined) {
  if (!date) return "—";

  return new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getNextDueDateValue(player: Player): string | null {
  if (
    (player.membership_status === "paid" ||
      player.membership_status === "grace") &&
    player.paid_through
  ) {
    const nextDue = new Date(`${player.paid_through}T00:00:00`);
    nextDue.setDate(nextDue.getDate() + 1);

    const year = nextDue.getFullYear();
    const month = String(nextDue.getMonth() + 1).padStart(2, "0");
    const day = String(nextDue.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  if (player.membership_status === "scheduled" && player.next_period_start) {
    return player.next_period_start;
  }

  return null;
}

function isDueNow(player: Player): boolean {
  return (
    player.membership_status === "expired" ||
    player.membership_status === "unpaid"
  );
}

function getNextDueDate(player: Player): string {
  if (isDueNow(player)) return "Due now";

  return formatDate(getNextDueDateValue(player));
}

function getStatusClass(status: string) {
  switch (status) {
    case "Active":
      return "bg-emerald-500/10 text-emerald-400";
    case "Expired":
      return "bg-amber-500/10 text-amber-400";
    case "Banned":
      return "bg-red-500/10 text-red-400";
    default:
      return "bg-zinc-500/10 text-zinc-400";
  }
}

function getSortValue(player: Player, column: SortColumn): string | null {
  switch (column) {
    case "player":
      return player.minecraft_username;
    case "discord":
      return player.discord_username;
    case "joined":
      return player.joined_at;
    case "nextDue":
      if (isDueNow(player)) return "";
      return getNextDueDateValue(player);
    case "status":
      return getPlayerDisplayStatus(player);
  }
}

function SortableHeader({
  label,
  column,
  sort,
  onSort,
  align = "left",
}: {
  label: string;
  column: SortColumn;
  sort: SortState | null;
  onSort: (column: SortColumn) => void;
  align?: "left" | "right";
}) {
  const active = sort?.column === column;

  return (
    <th
      className={`px-5 py-3 font-medium ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1.5 transition hover:text-white ${
          active ? "text-emerald-400" : "text-zinc-500"
        }`}
      >
        {label}

        {active ? (
          sort.direction === "asc" ? (
            <ArrowUp size={13} />
          ) : (
            <ArrowDown size={13} />
          )
        ) : (
          <ArrowUpDown size={13} className="text-zinc-600" />
        )}
      </button>
    </th>
  );
}

export default function PlayerTable({
  players,
  loading,
  totalPlayers,
  onEdit,
}: PlayerTableProps) {
  const [sort, setSort] = useState<SortState | null>(null);

  function handleSort(column: SortColumn) {
    setSort((current) => {
      if (!current || current.column !== column) {
        return { column, direction: "asc" };
      }

      if (current.direction === "asc") {
        return { column, direction: "desc" };
      }

      return null;
    });
  }

  const sortedPlayers = sort
    ? players
        .map((player, index) => ({ player, index }))
        .sort((a, b) => {
          const aValue = getSortValue(a.player, sort.column);
          const bValue = getSortValue(b.player, sort.column);

          // Keep missing values at the bottom in either direction.
          if (aValue === null && bValue === null) return a.index - b.index;
          if (aValue === null) return 1;
          if (bValue === null) return -1;

          const comparison = aValue.localeCompare(bValue, undefined, {
            numeric: true,
            sensitivity: "base",
          });

          if (comparison === 0) return a.index - b.index;

          return sort.direction === "asc" ? comparison : -comparison;
        })
        .map(({ player }) => player)
    : players;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-left">
          <thead>
            <tr className="border-b border-white/[0.06] text-xs">
              <SortableHeader
                label="Player"
                column="player"
                sort={sort}
                onSort={handleSort}
              />

              <SortableHeader
                label="Discord"
                column="discord"
                sort={sort}
                onSort={handleSort}
              />

              <SortableHeader
                label="Joined"
                column="joined"
                sort={sort}
                onSort={handleSort}
              />

              <SortableHeader
                label="Next Due"
                column="nextDue"
                sort={sort}
                onSort={handleSort}
              />

              <SortableHeader
                label="Status"
                column="status"
                sort={sort}
                onSort={handleSort}
              />

              <th className="px-5 py-3 text-right font-medium text-zinc-500">
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-12 text-center text-sm text-zinc-500"
                >
                  Loading players...
                </td>
              </tr>
            ) : sortedPlayers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center">
                  <p className="text-sm font-medium text-zinc-300">
                    {totalPlayers === 0
                      ? "No players yet"
                      : "No matching players"}
                  </p>

                  <p className="mt-1 text-xs text-zinc-500">
                    {totalPlayers === 0
                      ? "Add your first player to get started."
                      : "Try changing your search or filter."}
                  </p>
                </td>
              </tr>
            ) : (
              sortedPlayers.map((player) => {
                const status = getPlayerDisplayStatus(player);

                return (
                  <tr
                    key={player.id}
                    className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-white">
                          {player.minecraft_username}
                        </p>

                        {(player.titles ?? []).map((title) => (
                          <span
                            key={title}
                            className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300"
                          >
                            {title}
                          </span>
                        ))}
                      </div>

                      <p className="mt-1 text-xs text-zinc-500">Player</p>
                    </td>

                    <td className="px-5 py-4 text-sm text-zinc-400">
                      {player.discord_username || "—"}
                    </td>

                    <td className="px-5 py-4 text-sm text-zinc-500">
                      {formatDate(player.joined_at)}
                    </td>

                    <td className="px-5 py-4 text-sm text-zinc-400">
                      {getNextDueDate(player)}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClass(status)}`}
                      >
                        {status}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => onEdit(player)}
                        aria-label={`Edit ${player.minecraft_username}`}
                        className="rounded-lg p-2 text-zinc-500 transition hover:bg-white/[0.06] hover:text-white"
                      >
                        <Pencil size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-white/[0.06] px-5 py-3">
        <p className="text-xs text-zinc-500">
          Showing {sortedPlayers.length} of {totalPlayers} players
        </p>
      </div>
    </>
  );
}
