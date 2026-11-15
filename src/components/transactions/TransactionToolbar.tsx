import { Search } from "lucide-react";
import type { TransactionFilter } from "../../types/transaction";

interface TransactionToolbarProps {
  search: string;
  filter: TransactionFilter;
  onSearchChange: (value: string) => void;
  onFilterChange: (value: TransactionFilter) => void;
}

const filters: { label: string; value: TransactionFilter }[] = [
  { label: "All", value: "all" },
  { label: "Income", value: "income" },
  { label: "Expenses", value: "expense" },
];

export default function TransactionToolbar({
  search,
  filter,
  onSearchChange,
  onFilterChange,
}: TransactionToolbarProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-white/[0.06] p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative min-w-0 flex-1">
        <Search
          size={17}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
        />

        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search username, description or category..."
          className="w-full rounded-lg border border-white/[0.08] bg-zinc-950 py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-emerald-500"
        />
      </div>

      <div className="flex items-center gap-1 self-start rounded-lg bg-zinc-950 p-1">
        {filters.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onFilterChange(item.value)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              filter === item.value
                ? "bg-emerald-500/10 text-emerald-400"
                : "text-zinc-400 hover:bg-white/[0.05] hover:text-white"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
