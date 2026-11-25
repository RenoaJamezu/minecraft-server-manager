
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export interface ServerWorkspace {
  server_id: string;
  server_name: string;
  owner_id: string;
  is_owner: boolean;
  role_name: string | null;
  membership_id: string | null;
}

export type PermissionKey =
  | "dashboard.view"
  | "players.view"
  | "wallets.view"
  | "payments.view"
  | "expenses.view"
  | "staff.view"
  | "staff.invite"
  | "staff.update_role"
  | "staff.suspend"
  | "staff.remove";

type Permissions = Partial<Record<PermissionKey, boolean>>;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  mustChangePassword: boolean;
  workspaces: ServerWorkspace[];
  activeWorkspace: ServerWorkspace | null;
  workspaceLoading: boolean;
  workspaceError: string;
  permissions: Permissions;
  permissionsLoading: boolean;
  hasPermission: (permission: PermissionKey) => boolean;
  setActiveWorkspaceId: (serverId: string) => void;
  refreshWorkspaces: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const PAGE_PERMISSIONS: PermissionKey[] = [
  "dashboard.view",
  "players.view",
  "wallets.view",
  "payments.view",
  "expenses.view",
  "staff.view",
  "staff.invite",
  "staff.update_role",
  "staff.suspend",
  "staff.remove",
];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const [workspaces, setWorkspaces] = useState<ServerWorkspace[]>([]);
  const [workspacesUserId, setWorkspacesUserId] = useState("");
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState("");
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState("");

  const [permissions, setPermissions] = useState<Permissions>({});
  const [permissionWorkspaceId, setPermissionWorkspaceId] = useState("");
  const [permissionRequestLoading, setPermissionRequestLoading] =
    useState(false);

  const workspaceRequestRef = useRef(0);
  const permissionRequestRef = useRef(0);
  const currentUserIdRef = useRef<string | null>(null);

  const userId = user?.id ?? null;

  const mustChangePassword =
    user?.app_metadata?.must_change_password === true;

  const refreshWorkspaces = useCallback(async () => {
    const requestId = ++workspaceRequestRef.current;

    if (!userId) {
      setWorkspaces([]);
      setWorkspacesUserId("");
      setActiveWorkspaceIdState("");
      setWorkspaceError("");
      setPermissions({});
      setPermissionWorkspaceId("");
      setWorkspaceLoading(false);
      setPermissionRequestLoading(false);
      return;
    }

    setWorkspaceError("");
    setWorkspaceLoading(true);

    try {
      const { error: invitationError } = await supabase.rpc(
        "accept_my_server_invitations",
      );

      if (invitationError) {
        console.error(
          "Failed to accept pending workspace invitations:",
          invitationError,
        );
      }

      if (requestId !== workspaceRequestRef.current) return;

      const { data, error } = await supabase.rpc("list_my_server_workspaces");

      if (error) throw error;

      if (requestId !== workspaceRequestRef.current) return;

      const available = (data ?? []) as ServerWorkspace[];

      const savedId = localStorage.getItem(
        `minecraft-server-manager-workspace:${userId}`,
      );

      const selected =
        available.find((workspace) => workspace.server_id === savedId) ??
        available[0] ??
        null;

      setWorkspaces(available);
      setWorkspacesUserId(userId);
      setActiveWorkspaceIdState(selected?.server_id ?? "");

      if (selected) {
        localStorage.setItem(
          `minecraft-server-manager-workspace:${userId}`,
          selected.server_id,
        );
      } else {
        localStorage.removeItem(
          `minecraft-server-manager-workspace:${userId}`,
        );
      }
    } catch (error) {
      if (requestId !== workspaceRequestRef.current) return;

      console.error("Failed to load workspaces:", error);
      setWorkspaces([]);
      setWorkspacesUserId("");
      setActiveWorkspaceIdState("");
      setWorkspaceError("Unable to load your server workspaces.");
    } finally {
      if (requestId === workspaceRequestRef.current) {
        setWorkspaceLoading(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error("Failed to retrieve session:", error);
      }

      if (!mounted) return;

      const initialSession = data.session;
      const initialUserId = initialSession?.user.id ?? null;

      currentUserIdRef.current = initialUserId;

      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setLoading(false);
    }

    void initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const nextUserId = nextSession?.user.id ?? null;
      const previousUserId = currentUserIdRef.current;

      if (previousUserId !== nextUserId) {
        currentUserIdRef.current = nextUserId;

        // Prevent cached data from one account being reused by another.
        queryClient.clear();

        workspaceRequestRef.current += 1;
        permissionRequestRef.current += 1;

        setWorkspaces([]);
        setWorkspacesUserId("");
        setActiveWorkspaceIdState("");
        setPermissions({});
        setPermissionWorkspaceId("");
        setWorkspaceError("");
        setWorkspaceLoading(true);
        setPermissionRequestLoading(false);
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  useEffect(() => {
    if (!loading) {
      void refreshWorkspaces();
    }
  }, [loading, refreshWorkspaces]);

  const visibleWorkspaces =
    user && workspacesUserId === user.id ? workspaces : [];

  const activeWorkspace =
    visibleWorkspaces.find(
      (workspace) => workspace.server_id === activeWorkspaceId,
    ) ?? null;

  const setActiveWorkspaceId = useCallback(
    (serverId: string) => {
      const workspace = visibleWorkspaces.find(
        (item) => item.server_id === serverId,
      );

      if (!workspace || !userId) return;

      setPermissions({});
      setPermissionWorkspaceId("");
      setActiveWorkspaceIdState(serverId);

      localStorage.setItem(
        `minecraft-server-manager-workspace:${userId}`,
        serverId,
      );
    },
    [userId, visibleWorkspaces],
  );

  useEffect(() => {
    const requestId = ++permissionRequestRef.current;

    setPermissions({});
    setPermissionWorkspaceId("");

    if (workspaceLoading || !userId || !activeWorkspace) {
      setPermissionRequestLoading(false);
      return;
    }

    let cancelled = false;

    setPermissionRequestLoading(true);

    const loadPermissions = async () => {
      try {
        const results = await Promise.all(
          PAGE_PERMISSIONS.map(async (permission) => {
            const { data, error } = await supabase.rpc(
              "has_server_permission",
              {
                p_server_id: activeWorkspace.server_id,
                p_permission_key: permission,
              },
            );

            if (error) {
              console.error(
                `Failed to check permission "${permission}":`,
                error,
              );

              return [permission, false] as const;
            }

            return [permission, data === true] as const;
          }),
        );

        if (cancelled || requestId !== permissionRequestRef.current) {
          return;
        }

        setPermissions(Object.fromEntries(results));
        setPermissionWorkspaceId(activeWorkspace.server_id);
      } finally {
        if (!cancelled && requestId === permissionRequestRef.current) {
          setPermissionRequestLoading(false);
        }
      }
    };

    void loadPermissions();

    return () => {
      cancelled = true;
    };
  }, [userId, activeWorkspace?.server_id, workspaceLoading]);

  const permissionsLoading =
    !!activeWorkspace &&
    (permissionWorkspaceId !== activeWorkspace.server_id ||
      permissionRequestLoading);

  const hasPermission = useCallback(
    (permission: PermissionKey) =>
      !!activeWorkspace &&
      permissionWorkspaceId === activeWorkspace.server_id &&
      permissions[permission] === true,
    [activeWorkspace, permissionWorkspaceId, permissions],
  );

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) throw error;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        mustChangePassword,
        workspaces: visibleWorkspaces,
        activeWorkspace,
        workspaceLoading,
        workspaceError,
        permissions,
        permissionsLoading,
        hasPermission,
        setActiveWorkspaceId,
        refreshWorkspaces,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
