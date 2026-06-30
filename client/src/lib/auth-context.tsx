import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type AppRole = "ATO Admin" | "Account Manager" | "Alliance Team";

interface AuthCtx {
  isAuthed: boolean;
  loading: boolean;
  roles: AppRole[];
  isAdmin: boolean;
  hasRole: (r: AppRole) => boolean;
  signIn: () => void;
  signOut: () => void;
  user: { email: string; name: string; oid: string };
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const res = await fetch("/api/profiles/me");
        if (res.ok) {
          const data = await res.json();
          setRoles(data.roles || []);
        }
      } catch {
        setRoles(["ATO Admin", "Account Manager", "Alliance Team"]);
      }
      setLoading(false);
    };
    fetchRoles();
  }, []);

  const value: AuthCtx = {
    isAuthed: true,
    loading,
    roles,
    isAdmin: roles.includes("ATO Admin"),
    hasRole: (r) => roles.includes(r),
    signIn: () => {},
    signOut: () => {},
    user: { email: "user@app", name: "App User", oid: "anonymous" },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
};
