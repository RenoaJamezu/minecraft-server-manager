import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import TransactionTable from "../components/transactions/TransactionTable";
import TransactionToolbar from "../components/transactions/TransactionToolbar";
import { useTransactions } from "../hooks/useTransactions";
import type { Transaction, TransactionFilter } from "../types/transaction";

export default function Transactions() {
  const { transactions, loading, error, refresh } = useTransactions();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TransactionFilter>("all");

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return transactions.filter((transaction: Transaction) => {
      const matchesFilter = filter === "all" || transaction.kind === filter;

      const matchesSearch =
        !query ||
        (transaction.player ?? "").toLowerCase().includes(query) ||
        (transaction.description ?? "").toLowerCase().includes(query) ||
        (transaction.category ?? "").toLowerCase().includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [transactions, search, filter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-white">
          Transactions
        </h1>

        <p className="mt-1 text-sm text-zinc-500">
          View recorded income and server expenses.
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#111114]">
        <TransactionToolbar
          search={search}
          filter={filter}
          onSearchChange={setSearch}
          onFilterChange={setFilter}
        />

        {error && (
          <div className="m-4 flex flex-wrap items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3">
            <p role="alert" className="flex-1 text-sm text-red-400">
              {error}
            </p>

            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex items-center gap-1 text-sm font-medium text-red-300 hover:text-white"
            >
              <RefreshCw size={14} />
              Retry
            </button>
          </div>
        )}

        <TransactionTable
          transactions={filteredTransactions}
          totalTransactions={transactions.length}
          loading={loading}
          search={search}
        />
      </section>
    </div>
  );
}
