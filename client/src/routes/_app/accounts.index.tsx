import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getAccounts, createAccount } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/accounts/")({ component: AccountsList });

function AccountsList() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [am, setAm] = useState("");
  const [region, setRegion] = useState("");
  const [classification, setClassification] = useState("");

  const { data } = useQuery({ queryKey: ["accounts-list"], queryFn: getAccounts });

  const create = useMutation({
    mutationFn: async () => { await createAccount({ account_name: name.trim(), account_manager_name: am || null, region: region || null, classification: classification || null }); },
    onSuccess: () => { toast.success("Account created"); setOpen(false); setName(""); setAm(""); setRegion(""); setClassification(""); qc.invalidateQueries({ queryKey: ["accounts-list"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold tracking-tight">Accounts</h1><p className="text-sm text-muted-foreground">All client accounts.</p></div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> New Account</Button>
      </div>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Account</TableHead><TableHead>Account Manager</TableHead><TableHead>Region</TableHead><TableHead>Classification</TableHead><TableHead>Workshops</TableHead></TableRow></TableHeader>
          <TableBody>
            {(data ?? []).map((a: any) => (
              <TableRow key={a.id}>
                <TableCell><Link to="/accounts/$id" params={{ id: a.id }} className="text-primary hover:underline">{a.account_name}</Link></TableCell>
                <TableCell>{a.account_manager_name ?? "—"}</TableCell>
                <TableCell>{a.region ?? "—"}</TableCell>
                <TableCell>{a.classification ?? "—"}</TableCell>
                <TableCell>{a.workshops?.length ?? 0}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Account</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Account name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>Account Manager</Label><Input value={am} onChange={(e) => setAm(e.target.value)} /></div>
            <div><Label>Region</Label><Input value={region} onChange={(e) => setRegion(e.target.value)} /></div>
            <div><Label>Classification</Label><Input value={classification} onChange={(e) => setClassification(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={!name.trim() || create.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
