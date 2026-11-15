interface ExpenseToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
}

export default function ExpenseToolbar({
  search,
  onSearchChange,
}: ExpenseToolbarProps) {
  return (
    <div className="border-b border-white/[0.06] p-4">
      <input
        type="search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search expenses..."
        className="w-full rounded-lg border border-white/[0.08] bg-[#09090b] px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-white/20 sm:max-w-sm"
      />
    </div>
  );
}
