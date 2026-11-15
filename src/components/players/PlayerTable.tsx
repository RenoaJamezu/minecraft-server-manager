import { Pencil } from "lucide-react";
import type { Player } from "../../types/player";
import { getPlayerDisplayStatus } from "../../types/player";

interface PlayerTableProps {
  players: Player[];
  loading: boolean;
  totalPlayers: number;
  onEdit: (player: Player) => void;
}

function formatDate(date: string | null | undefined) {
  if (!date) return "—";

  return new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getNextDueDate(player: Player): string {
  if (
    (player.membership_status === "paid" ||
      player.membership_status === "grace") &&
    player.paid_through
  ) {
    // Renewal is due the day after the current paid coverage ends.
    const nextDue = new Date(`${player.paid_through}T00:00:00`);
    nextDue.setDate(nextDue.getDate() + 1);

    const year = nextDue.getFullYear();
    const month = String(nextDue.getMonth() + 1).padStart(2, "0");
    const day = String(nextDue.getDate()).padStart(2, "0");

    return formatDate(`${year}-${month}-${day}`);
  }

  if (player.membership_status === "scheduled" && player.next_period_start) {
    return formatDate(player.next_period_start);
  }

  if (
    player.membership_status === "expired" ||
    player.membership_status === "unpaid"
  ) {
    return "Due now";
  }

  return "—";
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

export default function PlayerTable({
  players,
  loading,
  totalPlayers,
  onEdit,
}: PlayerTableProps) {
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-left">
          <thead>
            <tr className="border-b border-white/[0.06] text-xs text-zinc-500">
              <th className="px-5 py-3 font-medium">Player</th>
              <th className="px-5 py-3 font-medium">Discord</th>
              <th className="px-5 py-3 font-medium">Joined</th>
              <th className="px-5 py-3 font-medium">Next Due</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 text-right font-medium">Actions</th>
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
            ) : players.length === 0 ? (
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
              players.map((player) => {
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
          Showing {players.length} of {totalPlayers} players
        </p>
      </div>
    </>
  );
}
