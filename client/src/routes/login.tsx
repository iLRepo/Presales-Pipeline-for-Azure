import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { isAuthed, signIn } = useAuth();
  const nav = useNavigate();

  useEffect(() => { if (isAuthed) nav({ to: "/pipeline" }); }, [isAuthed, nav]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary px-4">
      <Card className="w-full max-w-md p-8 shadow-xl">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-10 w-10 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold">PW</div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Presales Workshop</h1>
            <p className="text-xs text-muted-foreground">Pipeline Tracker</p>
          </div>
        </div>
        <h2 className="text-xl font-semibold mb-1">Sign in</h2>
        <p className="text-sm text-muted-foreground mb-6">Sign in with your Microsoft account to continue.</p>
        <Button onClick={signIn} className="w-full">
          Sign in with Microsoft
        </Button>
      </Card>
    </div>
  );
}
