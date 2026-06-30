import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getProfiles, grantRole, revokeRole } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROLES } from "@/lib/constants";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/admin/users")({ component: AdminUsers });

type Row = { id: string; email: string | null; full_name: string | null; roles: string[] };

function AdminUsers() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const profiles = await getProfiles();
      setRows(profiles.map((p: any) => ({ id: p.id, email: p.email, full_name: p.full_name, roles: p.roles || [] })));
    } catch { /* ignore */ }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const grant = async (uid: string, role: string) => {
    try { await grantRole(uid, role); toast.success("Role granted"); load(); } catch (e: any) { toast.error(e.message); }
  };
  const revoke = async (uid: string, role: string) => {
    try { await revokeRole(uid, role); toast.success("Role revoked"); load(); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <div><h1 className="text-2xl font-semibold tracking-tight">Manage Users</h1><p className="text-sm text-muted-foreground">Grant or revoke roles for any registered user.</p></div>
      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Roles</TableHead><TableHead>Grant role</TableHead></TableRow></TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">Loading...</TableCell></TableRow>}
            {!loading && rows.map((u) => (
              <TableRow key={u.id}>
                <TableCell><div className="font-medium">{u.full_name ?? "—"}</div><div className="text-xs text-muted-foreground">{u.email}</div></TableCell>
                <TableCell><div className="flex flex-wrap gap-1.5">{u.roles.length === 0 && <span className="text-xs text-muted-foreground">No roles</span>}{u.roles.map((r) => <Badge key={r} variant="outline" className="gap-1">{r}<button onClick={() => revoke(u.id, r)} className="hover:text-destructive"><Trash2 className="h-3 w-3" /></button></Badge>)}</div></TableCell>
                <TableCell><div className="flex flex-wrap gap-1.5">{ROLES.filter((r) => !u.roles.includes(r)).map((r) => <Button key={r} size="sm" variant="outline" onClick={() => grant(u.id, r)}>+ {r}</Button>)}</div></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
