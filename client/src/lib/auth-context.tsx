import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { loginRequest, DEV_MODE } from "./msal-config";

export type AppRole = "ATO Admin" | "Account Manager" | "Alliance Team";

interface AuthCtx {
  isAuthed: boolean;
  loading: boolean;
  roles: AppRole[];
  isAdmin: boolean;
  hasRole: (r: AppRole) => boolean;
  signIn: () => void;
  signOut: () => Promise<void>;
  user: { email: string; name: string; oid: string } | null;
  getToken: () => Promise<string>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const account = accounts[0] || null;

  const isAuthed = DEV_MODE || isAuthenticated;

  const user = DEV_MODE
    ? { email: "dev@localhost", name: "Dev User", oid: "dev-user-oid" }
    : account
      ? {
          email: account.username || "",
          name: account.name || "",
          oid: account.localAccountId || "",
        }
      : null;

  const getToken = async (): Promise<string> => {
    if (DEV_MODE) return "dev-token";
    if (!account) return "";
    try {
      const response = await instance.acquireTokenSilent({
        ...loginRequest,
        account,
      });
      return response.accessToken;
    } catch {
      const response = await instance.acquireTokenPopup(loginRequest);
      return response.accessToken;
    }
  };

  useEffect(() => {
    if (!isAuthed) {
      setLoading(false);
      return;
    }
    const fetchRoles = async () => {
      try {
        const token = await getToken();
        const res = await fetch("/api/profiles/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setRoles(data.roles || []);
        }
      } catch {
        if (DEV_MODE) {
          setRoles(["ATO Admin", "Account Manager", "Alliance Team"]);
        }
      }
      setLoading(false);
    };
    fetchRoles();
  }, [isAuthed]);

  const signIn = () => {
    if (!DEV_MODE) instance.loginRedirect(loginRequest);
  };

  const signOut = async () => {
    if (DEV_MODE) {
      window.location.reload();
      return;
    }
    await instance.logoutRedirect();
  };

  const value: AuthCtx = {
    isAuthed,
    loading,
    roles,
    isAdmin: roles.includes("ATO Admin"),
    hasRole: (r) => roles.includes(r),
    signIn,
    signOut,
    user,
    getToken,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
};
