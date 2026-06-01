import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Kanban, List, Building2, CheckSquare, BarChart3, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app")({ component: AppLayout });

const NAV = [
  { to: "/pipeline", label: "Pipeline", icon: Kanban },
  { to: "/workshops", label: "Workshops", icon: List },
  { to: "/accounts", label: "Accounts", icon: Building2 },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/reports", label: "Reports", icon: BarChart3 },
] as const;

function AppLayout() {
  const { isAuthed, loading, user, signOut } = useAuth();
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !isAuthed) nav({ to: "/login" });
  }, [loading, isAuthed, nav]);

  if (loading || !isAuthed) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background pl-60">
      <aside className="fixed inset-y-0 left-0 z-10 w-60 bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="p-5 border-b border-sidebar-border flex items-center gap-2">
          <div className="h-9 w-9 rounded-md bg-destructive flex items-center justify-center font-bold text-destructive-foreground">PW</div>
          <div>
            <div className="text-sm font-semibold leading-tight">Workshop Pipeline</div>
            <div className="text-[11px] text-sidebar-foreground/60">Tracker v1</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((n) => {
            const active = path === n.to || path.startsWith(n.to + "/");
            const Icon = n.icon;
            return (
              <Link key={n.to} to={n.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  active ? "bg-destructive text-destructive-foreground font-medium" : "hover:bg-sidebar-accent"
                }`}>
                <Icon className="h-4 w-4" />{n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="px-3 py-2 text-xs text-sidebar-foreground/70">
            <div className="truncate font-medium text-sidebar-foreground">{user?.email}</div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => signOut()} className="w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent">
            <LogOut className="h-3.5 w-3.5 mr-2" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="min-w-0 overflow-visible">
        <Outlet />
      </main>
    </div>
  );
}
