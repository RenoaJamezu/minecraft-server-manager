import { Search } from "lucide-react";
import type { WalletFilter } from "../../types/wallet";

interface WalletToolbarProps {
  search: string;
  filter: WalletFilter;
  onSearchChange: (value: string) => void;
  onFilterChange: (value: WalletFilter) => void;
}

export default function WalletToolbar({
  search,
  filter,
  onSearchChange,
  onFilterChange,
}: WalletToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-xs">
        <Search
          size={17}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
        />
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search Minecraft username..."
          className="h-10 w-full rounded-lg border border-white/[0.08] bg-[#111114] pl-10 pr-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-emerald-500/50"
        />
      </div>

      <select
        value={filter}
        onChange={(event) => onFilterChange(event.target.value as WalletFilter)}
        className="h-10 rounded-lg border border-white/[0.08] bg-[#111114] px-3 text-sm text-zinc-300 outline-none focus:border-emerald-500/50"
      >
        <option value="all">All balances</option>
        <option value="positive">Has wallet credit</option>
        <option value="zero">Zero balance</option>
        <option value="negative">Negative balance</option>
      </select>
    </div>
  );
}
