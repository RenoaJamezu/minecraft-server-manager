import { useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Sidebar from "./components/layout/Sidebar";
import Header from "./components/layout/Header";
import Dashboard from "./pages/Dashboard";
import Players from "./pages/Players";
import Transactions from "./pages/Transactions";
import Wallets from "./pages/Wallets";
import Expenses from "./pages/Expenses";
import Login from "./pages/Login";
import Staff from "./pages/Staff";
import AuditLogs from "./pages/AuditLogs";
import ChangePassword from "./pages/ChangePassword";

import { useAuth, type PermissionKey } from "./contexts/AuthContext";
import Approvals from "./pages/Approvals";

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="text-sm text-zinc-400">Loading...</div>
    </div>
  );
}

function NoAccess() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
        <span className="text-2xl text-red-400">!</span>
      </div>

      <h1 className="text-lg font-semibold text-white">Access restricted</h1>

      <p className="mt-2 max-w-md text-sm text-zinc-400">
        You don't have permission to access this page. Contact your workspace
        owner if you need access.
      </p>
    </div>
  );
}

function PermissionRoute({
  permission,
  children,
}: {
  permission: PermissionKey;
  children: React.ReactNode;
}) {
  const { hasPermission, permissionsLoading } = useAuth();

  if (permissionsLoading) {
    return <LoadingScreen />;
  }

  if (!hasPermission(permission)) {
    return <Navigate to="/no-access" replace />;
  }

  return <>{children}</>;
}

function OwnerRoute({ children }: { children: React.ReactNode }) {
  const { activeWorkspace, workspaceLoading } = useAuth();

  if (workspaceLoading || !activeWorkspace) {
    return <LoadingScreen />;
  }

  if (!activeWorkspace.is_owner) {
    return <Navigate to="/no-access" replace />;
  }

  return <>{children}</>;
}

function ProtectedLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const {
    user,
    loading,
    mustChangePassword,
    workspaceLoading,
    workspaceError,
    activeWorkspace,
    refreshWorkspaces,
    permissionsLoading,
  } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Login />;
  }

  if (mustChangePassword) {
    return <ChangePassword />;
  }

  if (workspaceLoading) {
    return <LoadingScreen />;
  }

  if (!activeWorkspace) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-4 text-center">
        <div>
          <h1 className="text-lg font-semibold text-white">
            {workspaceError
              ? "Unable to load workspaces"
              : "No server workspaces available"}
          </h1>

          <p className="mt-2 text-sm text-zinc-400">
            {workspaceError ||
              "You don't currently own or belong to an active server workspace."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refreshWorkspaces()}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
        >
          Retry
        </button>
      </div>
    );
  }

  if (permissionsLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-[#09090b]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="min-h-screen lg:pl-64">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          email={user.email ?? "Account"}
        />

        <main className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
          <Routes>
            <Route
              path="/"
              element={
                <PermissionRoute permission="dashboard.view">
                  <Dashboard />
                </PermissionRoute>
              }
            />

            <Route
              path="/players"
              element={
                <PermissionRoute permission="players.view">
                  <Players />
                </PermissionRoute>
              }
            />

            <Route
              path="/wallets"
              element={
                <PermissionRoute permission="wallets.view">
                  <Wallets />
                </PermissionRoute>
              }
            />

            <Route
              path="/transactions"
              element={
                <PermissionRoute permission="payments.view">
                  <Transactions />
                </PermissionRoute>
              }
            />

            <Route
              path="/expenses"
              element={
                <PermissionRoute permission="expenses.view">
                  <Expenses />
                </PermissionRoute>
              }
            />

            <Route
              path="/staff"
              element={
                <PermissionRoute permission="staff.view">
                  <Staff />
                </PermissionRoute>
              }
            />

            <Route
              path="/approvals"
              element={
                <PermissionRoute permission="staff.view">
                  <Approvals />
                </PermissionRoute>
              }
            />

            <Route
              path="/audit-logs"
              element={
                <OwnerRoute>
                  <AuditLogs />
                </OwnerRoute>
              }
            />

            <Route
              path="/change-password"
              element={
                user.app_metadata?.account_type === "staff" ? (
                  <ChangePassword />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />

            <Route path="/no-access" element={<NoAccess />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ProtectedLayout />
    </BrowserRouter>
  );
}
