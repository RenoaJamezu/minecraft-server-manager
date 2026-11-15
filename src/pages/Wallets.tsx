import { useMemo, useState } from "react";
import { RefreshCw, Wallet } from "lucide-react";
import WalletStats from "../components/wallets/WalletStats";
import WalletToolbar from "../components/wallets/WalletToolbar";
import WalletTable from "../components/wallets/WalletTable";
import PaymentDialog from "../components/wallets/PaymentDialog";
import WalletSpendDialog from "../components/wallets/WalletSpendDialog";
import WalletWithdrawalDialog from "../components/wallets/WalletWithdrawalDialog";
import WalletHistoryDialog from "../components/wallets/WalletHistoryDialog";
import { useWallets } from "../hooks/useWallets";
import type {
  PaymentFormValues,
  WalletFilter,
  WalletPlayer,
  WalletSpendFormValues,
  WalletWithdrawalFormValues,
} from "../types/wallet";

export default function Wallets() {
  const {
    players,
    transactions,
    loading,
    saving,
    historyLoading,
    error,
    fetchWallets,
    recordPayment,
    recordWalletSpend,
    withdrawWalletBalance,
    fetchHistory,
  } = useWallets();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<WalletFilter>("all");
  const [paymentPlayer, setPaymentPlayer] = useState<WalletPlayer | null>(null);
  const [spendPlayer, setSpendPlayer] = useState<WalletPlayer | null>(null);
  const [withdrawPlayer, setWithdrawPlayer] = useState<WalletPlayer | null>(
    null,
  );
  const [historyPlayer, setHistoryPlayer] = useState<WalletPlayer | null>(null);

  const filteredPlayers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return players.filter((player) => {
      const matchesSearch = player.minecraft_username
        .toLowerCase()
        .includes(normalizedSearch);

      const matchesFilter =
        filter === "all" ||
        (filter === "positive" && player.balance > 0) ||
        (filter === "zero" && player.balance === 0) ||
        (filter === "negative" && player.balance < 0);

      return matchesSearch && matchesFilter;
    });
  }, [players, search, filter]);

  const handlePayment = (values: PaymentFormValues) => recordPayment(values);

  const handleWalletSpend = (values: WalletSpendFormValues) =>
    recordWalletSpend(values);

  const handleWalletWithdrawal = (values: WalletWithdrawalFormValues) =>
    withdrawWalletBalance(values);

  const closePaymentDialog = () => {
    if (!saving) {
      setPaymentPlayer(null);
    }
  };

  const closeSpendDialog = () => {
    if (!saving) {
      setSpendPlayer(null);
    }
  };

  const closeWithdrawalDialog = () => {
    if (!saving) {
      setWithdrawPlayer(null);
    }
  };

  const closeHistoryDialog = () => {
    setHistoryPlayer(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Wallet size={21} className="text-emerald-400" />
            <h1 className="text-xl font-semibold text-white">Player Wallets</h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Manage player payments, wallet credits, withdrawals, and balances.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void fetchWallets()}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/[0.08] px-4 text-sm text-zinc-300 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <WalletStats players={players} />

      <div className="space-y-4">
        <WalletToolbar
          search={search}
          filter={filter}
          onSearchChange={setSearch}
          onFilterChange={setFilter}
        />

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-500/20 bg-rose-500/[0.06] px-4 py-3">
            <p className="text-sm text-rose-400">{error}</p>
            <button
              type="button"
              onClick={() => void fetchWallets()}
              className="text-sm font-medium text-rose-300 hover:text-white"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-white/[0.06] bg-[#111114] py-14 text-center text-sm text-zinc-500">
            Loading wallets...
          </div>
        ) : (
          <WalletTable
            players={filteredPlayers}
            onAddPayment={setPaymentPlayer}
            onSpendWallet={setSpendPlayer}
            onWithdrawWallet={setWithdrawPlayer}
            onViewHistory={setHistoryPlayer}
          />
        )}
      </div>

      <PaymentDialog
        player={paymentPlayer}
        players={players}
        open={Boolean(paymentPlayer)}
        saving={saving}
        onClose={closePaymentDialog}
        onSubmit={handlePayment}
      />

      <WalletSpendDialog
        player={spendPlayer}
        open={Boolean(spendPlayer)}
        saving={saving}
        onClose={closeSpendDialog}
        onSubmit={handleWalletSpend}
      />

      <WalletWithdrawalDialog
        player={withdrawPlayer}
        open={Boolean(withdrawPlayer)}
        saving={saving}
        onClose={closeWithdrawalDialog}
        onSubmit={handleWalletWithdrawal}
      />

      <WalletHistoryDialog
        player={historyPlayer}
        open={Boolean(historyPlayer)}
        loading={historyLoading}
        transactions={transactions}
        onClose={closeHistoryDialog}
        onLoad={fetchHistory}
      />
    </div>
  );
}
