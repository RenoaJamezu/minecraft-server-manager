import { ChevronLeft, ChevronRight } from "lucide-react";

interface MonthSelectorProps {
  selectedMonth: string;
  canGoNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

export default function MonthSelector({
  selectedMonth,
  canGoNext,
  onPrevious,
  onNext,
}: MonthSelectorProps) {
  const [year, month] = selectedMonth.split("-").map(Number);

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-[#111114] p-1">
      <button
        type="button"
        onClick={onPrevious}
        aria-label="Previous month"
        className="rounded-md p-2 text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
      >
        <ChevronLeft size={18} />
      </button>

      <span className="min-w-[130px] text-center text-sm font-medium text-white">
        {monthLabel}
      </span>

      <button
        type="button"
        onClick={onNext}
        disabled={!canGoNext}
        aria-label="Next month"
        className="rounded-md p-2 text-zinc-400 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
