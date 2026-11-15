import { useState, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import {
  PLAYER_BUILT_IN_TITLES,
  type PlayerFormValues,
  type PlayerStatus,
} from "../../types/player";

interface PlayerFormProps {
  form: PlayerFormValues;
  onChange: (form: PlayerFormValues) => void;
}

export default function PlayerForm({ form, onChange }: PlayerFormProps) {
  const [customTitle, setCustomTitle] = useState("");

  function updateField<K extends keyof PlayerFormValues>(
    field: K,
    value: PlayerFormValues[K],
  ) {
    onChange({ ...form, [field]: value });
  }

  function updateTitles(titles: string[]) {
    const uniqueTitles = Array.from(
      new Map(
        titles
          .map((title) => title.trim())
          .filter(Boolean)
          .map((title) => [title.toLowerCase(), title]),
      ).values(),
    );

    onChange({
      ...form,
      titles: uniqueTitles,
    });
  }

  function toggleBuiltInTitle(title: string) {
    const selected = form.titles.some(
      (item) => item.toLowerCase() === title.toLowerCase(),
    );

    updateTitles(
      selected
        ? form.titles.filter(
            (item) => item.toLowerCase() !== title.toLowerCase(),
          )
        : [...form.titles, title],
    );
  }

  function addCustomTitle() {
    const title = customTitle.trim();

    if (!title) return;

    const alreadyExists = form.titles.some(
      (item) => item.toLowerCase() === title.toLowerCase(),
    );

    if (alreadyExists) {
      setCustomTitle("");
      return;
    }

    updateTitles([...form.titles, title]);
    setCustomTitle("");
  }

  function handleCustomTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      addCustomTitle();
    }
  }

  const inputClass =
    "w-full min-w-0 rounded-lg border border-white/[0.08] bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-emerald-500";

  const labelClass = "mb-2 block text-sm font-medium text-zinc-300";

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="minecraft_username" className={labelClass}>
          Minecraft username <span className="text-red-400">*</span>
        </label>

        <input
          id="minecraft_username"
          required
          maxLength={32}
          value={form.minecraft_username}
          onChange={(event) =>
            updateField("minecraft_username", event.target.value)
          }
          placeholder="e.g. Kurasuo"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="discord_username" className={labelClass}>
          Discord username
        </label>

        <input
          id="discord_username"
          value={form.discord_username}
          onChange={(event) =>
            updateField("discord_username", event.target.value)
          }
          placeholder="e.g. username"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="monthly_fee" className={labelClass}>
            Monthly fee (₱)
          </label>

          <input
            id="monthly_fee"
            type="number"
            min="0"
            step="0.01"
            required
            value={form.monthly_fee}
            onChange={(event) => updateField("monthly_fee", event.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="joined_at" className={labelClass}>
            Joined date
          </label>

          <input
            id="joined_at"
            type="date"
            value={form.joined_at}
            onChange={(event) => updateField("joined_at", event.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="status" className={labelClass}>
          Membership status
        </label>

        <select
          id="status"
          value={form.status}
          onChange={(event) =>
            updateField("status", event.target.value as PlayerStatus)
          }
          className={inputClass}
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <p className="mt-1 text-xs text-zinc-500">
          This is separate from the player's ban and membership coverage status.
        </p>
      </div>

      {/* Player titles */}
      <div className="rounded-lg border border-white/[0.08] bg-zinc-950 p-4">
        <div>
          <p className="text-sm font-medium text-white">Player Titles</p>
          <p className="mt-1 text-xs text-zinc-500">
            A player can have multiple titles.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {PLAYER_BUILT_IN_TITLES.map((title) => {
            const checked = form.titles.some(
              (item) => item.toLowerCase() === title.toLowerCase(),
            );

            return (
              <label
                key={title}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 transition ${
                  checked
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleBuiltInTitle(title)}
                  className="size-4 accent-emerald-500"
                />

                <span className="text-sm text-zinc-200">{title}</span>
              </label>
            );
          })}
        </div>

        <div className="mt-4">
          <label htmlFor="custom_title" className={labelClass}>
            Add custom title
          </label>

          <div className="flex gap-2">
            <input
              id="custom_title"
              value={customTitle}
              maxLength={40}
              onChange={(event) => setCustomTitle(event.target.value)}
              onKeyDown={handleCustomTitleKeyDown}
              placeholder="e.g. Builder, Event Host"
              className={inputClass}
            />

            <button
              type="button"
              onClick={addCustomTitle}
              disabled={!customTitle.trim()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus size={16} />
              Add
            </button>
          </div>
        </div>

        {form.titles.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-zinc-500">
              Selected titles ({form.titles.length})
            </p>

            <div className="flex flex-wrap gap-2">
              {form.titles.map((title) => (
                <span
                  key={title}
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 py-1 pl-3 pr-1 text-xs font-medium text-emerald-300"
                >
                  {title}

                  <button
                    type="button"
                    onClick={() =>
                      updateTitles(
                        form.titles.filter(
                          (item) => item.toLowerCase() !== title.toLowerCase(),
                        ),
                      )
                    }
                    aria-label={`Remove ${title} title`}
                    className="rounded-full p-1 transition hover:bg-white/10 hover:text-white"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Ban settings */}
      <div className="rounded-lg border border-white/[0.08] bg-zinc-950 p-4">
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-white">Ban player</p>
            <p className="mt-1 text-xs text-zinc-500">
              Prevent this player from accessing the server.
            </p>
          </div>

          <input
            type="checkbox"
            checked={form.is_banned}
            onChange={(event) => {
              const isBanned = event.target.checked;

              onChange({
                ...form,
                is_banned: isBanned,
                ban_reason: isBanned ? form.ban_reason : "",
              });
            }}
            className="size-4 accent-red-500"
          />
        </label>

        {form.is_banned && (
          <div className="mt-4">
            <label htmlFor="ban_reason" className={labelClass}>
              Ban reason <span className="text-red-400">*</span>
            </label>

            <textarea
              id="ban_reason"
              required
              rows={3}
              maxLength={500}
              value={form.ban_reason}
              onChange={(event) =>
                updateField("ban_reason", event.target.value)
              }
              placeholder="Explain why this player is banned..."
              className={`${inputClass} resize-y`}
            />
          </div>
        )}
      </div>

      <div>
        <label htmlFor="notes" className={labelClass}>
          Notes
        </label>

        <textarea
          id="notes"
          rows={3}
          value={form.notes}
          onChange={(event) => updateField("notes", event.target.value)}
          placeholder="Optional notes..."
          className={`${inputClass} resize-y`}
        />
      </div>
    </div>
  );
}
