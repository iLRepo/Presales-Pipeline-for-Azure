import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAccounts, createAccount, createAtoOpportunity } from "@/lib/api";
import { toast } from "sonner";

interface Props { open: boolean; onOpenChange: (v: boolean) => void; onCreated?: () => void; defaultAccountId?: string; }

export function NewAtoOpportunityDialog({ open, onOpenChange, onCreated, defaultAccountId }: Props) {
  const [accountId, setAccountId] = useState<string>("");
  const [oppName, setOppName] = useState("");
  const [pocName, setPocName] = useState("");
  const [accounts, setAccounts] = useState<{ id: string; account_name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");

  useEffect(() => {
    if (!open) return;
    setOppName(""); setPocName(""); setNewAccountName("");
    setAccountId(defaultAccountId ?? "");
    getAccounts().then((data) => setAccounts(data ?? []));
  }, [open, defaultAccountId]);

  const submit = async () => {
    setBusy(true);
    try {
      let acctId = accountId;
      if (!acctId && newAccountName.trim()) {
        const data = await createAccount({ account_name: newAccountName.trim() });
        acctId = data.id;
      }
      if (!acctId) { toast.error("Pick or create an account"); setBusy(false); return; }
      await createAtoOpportunity({ account_id: acctId, opportunity_name: oppName || null, poc_name: pocName || null });
      toast.success("ATO Opportunity created");
      onCreated?.();
      onOpenChange(false);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New ATO Opportunity</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Choose existing account..." /></SelectTrigger>
              <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>)}</SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">...or create a new one:</div>
            <Input placeholder="New account name" value={newAccountName} onChange={(e) => { setNewAccountName(e.target.value); setAccountId(""); }} />
          </div>
          <div className="space-y-1.5">
            <Label>Opportunity Name</Label>
            <Input value={oppName} onChange={(e) => setOppName(e.target.value)} placeholder="Optional name for this opportunity" />
          </div>
          <div className="space-y-1.5">
            <Label>Point of Contact</Label>
            <Input value={pocName} onChange={(e) => setPocName(e.target.value)} placeholder="Name / email" />
          </div>
          <div className="text-xs text-muted-foreground">
            Track non-workshop ATO opportunities through qualification, proposal, and SOW stages.
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Creating..." : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
