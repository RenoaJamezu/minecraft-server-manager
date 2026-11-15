import { useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import PlayerDialog from "../components/players/PlayerDialog";
import PlayerStats from "../components/players/PlayerStats";
import PlayerTable from "../components/players/PlayerTable";
import PlayerToolbar from "../components/players/PlayerToolbar";
import { usePlayers } from "../hooks/usePlayers";
import {
  isPlayerActive,
  isPlayerBanned,
  type Player,
  type PlayerFilter,
  type PlayerFormValues,
} from "../types/player";

export default function Players() {
  const { players, loading, saving, error, fetchPlayers, savePlayer } =
    usePlayers();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<PlayerFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [dialogError, setDialogError] = useState("");

  const filteredPlayers = players
    .filter((player) => {
      const searchTerm = search.toLowerCase();

      const matchesSearch =
        player.minecraft_username.toLowerCase().includes(searchTerm) ||
        (player.discord_username ?? "").toLowerCase().includes(searchTerm);

      const matchesFilter =
        filter === "all" ||
        (filter === "streamers"
          ? (player.titles?.some(
              (title) => title.trim().toLowerCase() === "streamer",
            ) ?? false)
          : filter === "banned"
            ? isPlayerBanned(player)
            : filter === "active"
              ? isPlayerActive(player)
              : !isPlayerActive(player));

      return matchesSearch && matchesFilter;
    })
    .sort(
      (a, b) =>
        new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime(),
    );

  function openCreateDialog() {
    setEditingPlayer(null);
    setDialogError("");
    setDialogOpen(true);
  }

  function openEditDialog(player: Player) {
    setEditingPlayer(player);
    setDialogError("");
    setDialogOpen(true);
  }

  function closeDialog() {
    if (saving) return;

    setDialogOpen(false);
    setEditingPlayer(null);
    setDialogError("");
  }

  async function handleSubmit(values: PlayerFormValues) {
    setDialogError("");

    const saveError = await savePlayer(values, editingPlayer);

    if (saveError) {
      setDialogError(saveError);
      return;
    }

    setDialogOpen(false);
    setEditingPlayer(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">
            Players
          </h1>

          <p className="mt-1 text-sm text-zinc-500">
            Manage your Minecraft server members.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateDialog}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
        >
          <Plus size={17} />
          Add player
        </button>
      </div>

      <PlayerStats players={players} />

      <section className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#111114]">
        <PlayerToolbar
          search={search}
          filter={filter}
          onSearchChange={setSearch}
          onFilterChange={setFilter}
        />

        {error && (
          <div className="m-4 flex flex-wrap items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <span>{error}</span>

            <button
              type="button"
              onClick={() => void fetchPlayers()}
              className="inline-flex items-center gap-1 font-medium underline"
            >
              <RefreshCw size={13} />
              Retry
            </button>
          </div>
        )}

        <PlayerTable
          players={filteredPlayers}
          loading={loading}
          totalPlayers={players.length}
          onEdit={openEditDialog}
        />
      </section>

      <PlayerDialog
        open={dialogOpen}
        player={editingPlayer}
        saving={saving}
        error={dialogError}
        onClose={closeDialog}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
