import { useMemo, useState } from "react";
import { RefreshCw, Wallet, X } from "lucide-react";
import WalletStats from "../components/wallets/WalletStats";
import WalletToolbar from "../components/wallets/WalletToolbar";
import WalletTable from "../components/wallets/WalletTable";
import PaymentDialog from "../components/wallets/PaymentDialog";
import WalletSpendDialog from "../components/wallets/WalletSpendDialog";
import WalletWithdrawalDialog from "../components/wallets/WalletWithdrawalDialog";
import WalletHistoryDialog from "../components/wallets/WalletHistoryDialog";
import WalletTopUpDialog from "../components/wallets/WalletTopUpDialog";
import { useWallets } from "../hooks/useWallets";
import { useWalletTopUp } from "../hooks/useWalletTopUp";
import { APPROVAL_SUBMITTED_MESSAGE } from "../lib/approval";
import type {
  PaymentFormValues,
  WalletFilter,
  WalletPlayer,
  WalletSpendFormValues,
  WalletTopUpFormValues,
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
    canReversePayments,
    fetchWallets,
    recordPayment,
    recordWalletSpend,
    withdrawWalletBalance,
    fetchHistory,
    reverseWalletTransaction,
    reverseFullPayment,
  } = useWallets();

  const { canAddWalletBalance, savingTopUp, addWalletBalance } =
    useWalletTopUp(fetchWallets);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<WalletFilter>("all");
  const [paymentPlayer, setPaymentPlayer] = useState<WalletPlayer | null>(null);
  const [spendPlayer, setSpendPlayer] = useState<WalletPlayer | null>(null);
  const [withdrawPlayer, setWithdrawPlayer] = useState<WalletPlayer | null>(
    null,
  );
  const [topUpPlayer, setTopUpPlayer] = useState<WalletPlayer | null>(null);
  const [historyPlayer, setHistoryPlayer] = useState<WalletPlayer | null>(null);
  const [approvalNotice, setApprovalNotice] = useState<string | null>(null);

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

  const handlePayment = async (
    values: PaymentFormValues,
    requestId: string,
  ) => {
    const response = await recordPayment(values, requestId);

    if (response.error === APPROVAL_SUBMITTED_MESSAGE) {
      setPaymentPlayer(null);
      setApprovalNotice(
        "Payment submitted for approval. Wallet balances and payment records will update after it is approved.",
      );
      return { ...response, error: null };
    }

    return response;
  };

  const handleWalletSpend = async (
    values: WalletSpendFormValues,
    requestId: string,
  ) => {
    const response = await recordWalletSpend(values, requestId);

    if (response.error === APPROVAL_SUBMITTED_MESSAGE) {
      setSpendPlayer(null);
      setApprovalNotice(
        "Wallet spending request submitted for approval. The wallet balance will update after it is approved.",
      );
      return { ...response, error: null };
    }

    return response;
  };

  const handleWalletWithdrawal = async (values: WalletWithdrawalFormValues) => {
    const response = await withdrawWalletBalance(values);

    if (response.error === APPROVAL_SUBMITTED_MESSAGE) {
      setWithdrawPlayer(null);
      setApprovalNotice(
        "Wallet withdrawal submitted for approval. The wallet balance will update after it is approved.",
      );
      return { ...response, error: null };
    }

    return response;
  };

  const handleWalletTopUp = async (values: WalletTopUpFormValues) => {
    const response = await addWalletBalance(values);

    if (response.error === APPROVAL_SUBMITTED_MESSAGE) {
      setTopUpPlayer(null);
      setApprovalNotice(
        "Wallet top-up submitted for approval. The wallet balance will update after it is approved.",
      );
      return { ...response, error: null };
    }

    if (!response.error && historyPlayer?.id === values.player_id) {
      await fetchHistory(values.player_id);
    }

    return response;
  };

  const closePaymentDialog = () => {
    if (!saving) setPaymentPlayer(null);
  };

  const closeSpendDialog = () => {
    if (!saving) setSpendPlayer(null);
  };

  const closeWithdrawalDialog = () => {
    if (!saving) setWithdrawPlayer(null);
  };

  const closeTopUpDialog = () => {
    if (!savingTopUp) setTopUpPlayer(null);
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
        {approvalNotice && (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3">
            <p className="text-sm text-amber-300">{approvalNotice}</p>
            <button
              type="button"
              onClick={() => setApprovalNotice(null)}
              aria-label="Dismiss approval notice"
              className="shrink-0 text-amber-300/70 transition hover:text-amber-200"
            >
              <X size={16} />
            </button>
          </div>
        )}

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
            canAddWalletBalance={canAddWalletBalance}
            onAddWalletBalance={setTopUpPlayer}
            onAddPayment={setPaymentPlayer}
            onSpendWallet={setSpendPlayer}
            onWithdrawWallet={setWithdrawPlayer}
            onViewHistory={setHistoryPlayer}
          />
        )}
      </div>

      <WalletTopUpDialog
        player={topUpPlayer}
        open={Boolean(topUpPlayer)}
        saving={savingTopUp}
        onClose={closeTopUpDialog}
        onSubmit={handleWalletTopUp}
      />

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
        saving={saving}
        canReversePayments={canReversePayments}
        transactions={transactions}
        onClose={closeHistoryDialog}
        onLoad={fetchHistory}
        onReverse={(transactionId, reason) =>
          historyPlayer
            ? reverseWalletTransaction(historyPlayer.id, transactionId, reason)
            : Promise.resolve({ error: "No player selected." })
        }
        onReversePayment={(paymentId, reason) =>
          historyPlayer
            ? reverseFullPayment(historyPlayer.id, paymentId, reason)
            : Promise.resolve({ error: "No player selected." })
        }
      />
    </div>
  );
}
