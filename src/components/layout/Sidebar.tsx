import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Wallet,
  ArrowLeftRight,
  Receipt,
  Gamepad2,
  UserCog,
  ScrollText,
  ClipboardCheck,
  X,
} from "lucide-react";
import { useAuth, type PermissionKey } from "../../contexts/AuthContext";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const navigation: {
  label: string;
  icon: typeof LayoutDashboard;
  href: string;
  permission?: PermissionKey;
  ownerOnly?: boolean;
}[] = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/",
    permission: "dashboard.view",
  },
  {
    label: "Players",
    icon: Users,
    href: "/players",
    permission: "players.view",
  },
  {
    label: "Wallets",
    icon: Wallet,
    href: "/wallets",
    permission: "wallets.view",
  },
  {
    label: "Transactions",
    icon: ArrowLeftRight,
    href: "/transactions",
    permission: "payments.view",
  },
  {
    label: "Expenses",
    icon: Receipt,
    href: "/expenses",
    permission: "expenses.view",
  },
  {
    label: "Approvals",
    icon: ClipboardCheck,
    href: "/approvals",
    permission: "staff.view",
  },
  {
    label: "Staff",
    icon: UserCog,
    href: "/staff",
    permission: "staff.view",
  },
  {
    label: "Audit Logs",
    icon: ScrollText,
    href: "/audit-logs",
    ownerOnly: true,
  },
];

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { hasPermission, permissionsLoading, activeWorkspace } = useAuth();

  const visibleNavigation = navigation.filter((item) => {
    if (item.ownerOnly) {
      return activeWorkspace?.is_owner === true;
    }

    return item.permission ? hasPermission(item.permission) : false;
  });

  return (
    <>
      {open && (
        <button
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-white/[0.06] bg-[#0d0d10] transition-transform duration-200 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/[0.06] px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <Gamepad2 size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Server Manager</p>
              <p className="text-xs text-zinc-500">Administration</p>
            </div>
          </div>

          <button
            aria-label="Close sidebar"
            onClick={onClose}
            className="text-zinc-500 hover:text-white lg:hidden"
          >
            <X size={19} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-6">
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
            Management
          </p>

          {!permissionsLoading &&
            visibleNavigation.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.label}
                  to={item.href}
                  end={item.href === "/"}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                      isActive
                        ? "bg-emerald-500/10 font-medium text-emerald-400"
                        : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
                    }`
                  }
                >
                  <Icon size={18} />
                  {item.label}
                </NavLink>
              );
            })}
        </nav>
      </aside>
    </>
  );
}
