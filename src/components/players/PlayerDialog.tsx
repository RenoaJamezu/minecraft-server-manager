import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import PlayerForm from "./PlayerForm";
import type { Player, PlayerFormValues } from "../../types/player";

interface PlayerDialogProps {
  open: boolean;
  player: Player | null;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (values: PlayerFormValues) => Promise<void>;
}

function getToday() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);

  return localDate.toISOString().slice(0, 10);
}

function getEmptyForm(): PlayerFormValues {
  return {
    minecraft_username: "",
    discord_username: "",
    monthly_fee: "50",
    status: "active",
    joined_at: getToday(),
    notes: "",
    titles: [],
    is_banned: false,
    ban_reason: "",
  };
}

function getPlayerForm(player: Player): PlayerFormValues {
  return {
    minecraft_username: player.minecraft_username,
    discord_username: player.discord_username ?? "",
    monthly_fee: String(player.monthly_fee),
    status: player.status,
    joined_at: player.joined_at,
    notes: player.notes ?? "",
    titles: player.titles ?? [],
    is_banned: player.banned_at !== null,
    ban_reason: player.ban_reason ?? "",
  };
}

export default function PlayerDialog({
  open,
  player,
  saving,
  error,
  onClose,
  onSubmit,
}: PlayerDialogProps) {
  const [form, setForm] = useState<PlayerFormValues>(getEmptyForm);

  useEffect(() => {
    if (open) {
      setForm(player ? getPlayerForm(player) : getEmptyForm());
    }
  }, [open, player]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(form);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/70 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-dialog-title"
        className="player-dialog-panel my-auto overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111114] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <div>
            <h2
              id="player-dialog-title"
              className="text-base font-semibold text-white"
            >
              {player ? "Edit player" : "Add player"}
            </h2>

            <p className="mt-1 text-xs text-zinc-500">
              Enter the player's server and payment details.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close dialog"
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="max-h-[calc(90vh-140px)] space-y-4 overflow-y-auto p-6">
            <PlayerForm form={form} onChange={setForm} />

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400"
              >
                {error}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t border-white/[0.06] px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-zinc-400 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : player ? "Save changes" : "Add player"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
