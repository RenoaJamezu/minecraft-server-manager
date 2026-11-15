import DashboardStats from "../components/dashboard/DashboardStats";
import RecentTransactions from "../components/dashboard/RecentTransactions";
import FinancialSummary from "../components/dashboard/FinancialSummary";
import MonthSelector from "../components/dashboard/MonthSelector";
import { useDashboard } from "../hooks/useDashboard";

export default function Dashboard() {
  const {
    totalPlayers,
    newPlayers,
    monthlyIncome,
    totalExpenses,
    netEarnings,
    recentTransactions,
    monthLabel,
    selectedMonth,
    canGoNext,
    loading,
    error,
    refresh,
    goToPreviousMonth,
    goToNextMonth,
  } = useDashboard();

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">
            Overview
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Monitor your players and server finances.
          </p>
        </div>

        <MonthSelector
          selectedMonth={selectedMonth}
          canGoNext={canGoNext}
          onPrevious={goToPreviousMonth}
          onNext={goToNextMonth}
        />
      </div>

      {error && (
        <div className="flex flex-col gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-red-400">{error}</p>

          <button
            type="button"
            onClick={() => void refresh()}
            className="text-sm font-medium text-red-300 hover:text-white"
          >
            Try again
          </button>
        </div>
      )}

      <DashboardStats
        totalPlayers={totalPlayers}
        newPlayers={newPlayers}
        monthlyIncome={monthlyIncome}
        totalExpenses={totalExpenses}
        netEarnings={netEarnings}
        loading={loading}
      />

      <section className="grid gap-4 xl:grid-cols-3">
        <RecentTransactions
          transactions={recentTransactions}
          loading={loading}
        />

        <FinancialSummary
          monthlyIncome={monthlyIncome}
          totalExpenses={totalExpenses}
          netEarnings={netEarnings}
          monthLabel={monthLabel}
          loading={loading}
        />
      </section>
    </div>
  );
}
