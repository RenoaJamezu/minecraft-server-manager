import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Menu, Bell, LogOut } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

interface HeaderProps {
  onMenuClick: () => void;
  email: string;
}

const pageDetails: Record<string, { title: string; subtitle: string }> = {
  "/": {
    title: "Dashboard",
    subtitle: "Overview of your server finances",
  },
  "/players": {
    title: "Players",
    subtitle: "Manage your Minecraft server members",
  },
  "/wallets": {
    title: "Wallets",
    subtitle: "Manage player wallet balances",
  },
  "/transactions": {
    title: "Transactions",
    subtitle: "View recorded financial activity",
  },
  "/expenses": {
    title: "Expenses",
    subtitle: "Manage server expenses",
  },
  "/settings": {
    title: "Settings",
    subtitle: "Manage your server settings",
  },
};

export default function Header({ onMenuClick, email }: HeaderProps) {
  const { signOut } = useAuth();
  const location = useLocation();

  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");

  const page = pageDetails[location.pathname] ?? pageDetails["/"];
  const initials = email.slice(0, 2).toUpperCase();

  async function handleSignOut() {
    setSigningOut(true);
    setError("");

    try {
      await signOut();
    } catch (err) {
      console.error("Sign out failed:", err);
      setError("Unable to sign out. Please try again.");
      setSigningOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/[0.06] bg-[#09090b]/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="text-zinc-400 hover:text-white lg:hidden"
        >
          <Menu size={21} />
        </button>

        <div className="min-w-0">
          <p className="text-sm font-medium text-white">{page.title}</p>
          <p className="hidden text-xs text-zinc-500 sm:block">
            {page.subtitle}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 sm:gap-4">
        {error && (
          <p role="alert" className="hidden text-xs text-red-400 sm:block">
            {error}
          </p>
        )}

        <button
          type="button"
          aria-label="Notifications"
          className="text-zinc-400 hover:text-white"
        >
          <Bell size={19} />
        </button>

        <div className="flex items-center gap-2 border-l border-white/[0.08] pl-3 sm:pl-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-semibold text-emerald-400">
            {initials}
          </div>

          <div className="hidden max-w-40 sm:block">
            <p className="text-xs font-medium text-white">Owner</p>
            <p className="truncate text-[11px] text-zinc-500">{email}</p>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            title="Sign out"
            aria-label="Sign out"
            className="ml-1 rounded-lg p-2 text-zinc-400 transition hover:bg-white/[0.06] hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </header>
  );
}
