import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { getAccount, updateAccount } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { STAGES } from "@/lib/constants";
import { toast } from "sonner";
import { NewWorkshopDialog } from "@/components/dialogs/NewWorkshopDialog";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_app/accounts/$id")({ component: AccountDetail });

function AccountDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [a, setA] = useState<any>(null);
  const [openNew, setOpenNew] = useState(false);

  const { data } = useQuery({ queryKey: ["account", id], queryFn: () => getAccount(id) });
  useEffect(() => { if (data) setA(data); }, [data]);

  const save = async (patch: any) => {
    try { await updateAccount(id, patch); toast.success("Saved"); qc.invalidateQueries({ queryKey: ["account", id] }); } catch (e: any) { toast.error(e.message); }
  };

  if (!a) return <div className="p-6 text-muted-foreground">Loading...</div>;

  const counts = {
    byStage: STAGES.map((s) => ({ s, n: a.workshops.filter((w: any) => w.stage === s).length })).filter((x: any) => x.n > 0),
    byPart: (["101","201","301"] as const).map((p) => ({ p, n: a.workshops.filter((w: any) => w[`part_${p}_complete`]).length })),
  };

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <div>
        <Link to="/accounts" className="text-xs text-muted-foreground hover:underline">&larr; Accounts</Link>
        <Input value={a.account_name ?? ""} onChange={(e) => setA({ ...a, account_name: e.target.value })} onBlur={() => save({ account_name: a.account_name })}
          className="text-2xl font-semibold tracking-tight px-2 h-auto py-1 border border-dashed border-transparent hover:border-border focus-visible:border-primary bg-transparent" />
      </div>
      <Card className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div><Label className="text-xs">Account Manager</Label><Input value={a.account_manager_name ?? ""} onChange={(e) => setA({ ...a, account_manager_name: e.target.value })} onBlur={() => save({ account_manager_name: a.account_manager_name })} /></div>
        <div><Label className="text-xs">Region</Label><Input value={a.region ?? ""} onChange={(e) => setA({ ...a, region: e.target.value })} onBlur={() => save({ region: a.region })} /></div>
        <div><Label className="text-xs">Classification</Label><Input value={a.classification ?? ""} onChange={(e) => setA({ ...a, classification: e.target.value })} onBlur={() => save({ classification: a.classification })} /></div>
        <div className="md:col-span-2"><Label className="text-xs">Notes</Label><Textarea rows={3} value={a.notes ?? ""} onChange={(e) => setA({ ...a, notes: e.target.value })} onBlur={() => save({ notes: a.notes })} /></div>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className="p-4"><div className="font-semibold text-sm mb-2">By Stage</div><div className="flex flex-wrap gap-1.5">{counts.byStage.length === 0 && <div className="text-sm text-muted-foreground">No workshops yet.</div>}{counts.byStage.map(({ s, n }: any) => <Badge key={s} variant="outline">{s}: {n}</Badge>)}</div></Card>
        <Card className="p-4"><div className="font-semibold text-sm mb-2">Envisioning Parts Completed</div><div className="flex flex-wrap gap-1.5">{counts.byPart.map(({ p, n }: any) => <Badge key={p} variant="outline">Part {p}: {n}</Badge>)}</div></Card>
      </div>
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3"><h2 className="font-semibold">Workshops</h2><Button size="sm" onClick={() => setOpenNew(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Add Workshop</Button></div>
        <Table>
          <TableHeader><TableRow><TableHead>Workshop</TableHead><TableHead>Parts</TableHead><TableHead>Stage</TableHead><TableHead>Planned</TableHead><TableHead>Owner</TableHead></TableRow></TableHeader>
          <TableBody>
            {a.workshops.map((w: any) => (
              <TableRow key={w.id}>
                <TableCell><Link to="/workshops/$id" params={{ id: w.id }} className="text-primary hover:underline">{w.workshop_name || "Envisioning workshop"}</Link></TableCell>
                <TableCell><div className="flex gap-1">{(["101","201","301"] as const).map((p) => <Badge key={p} variant="outline" className={w[`part_${p}_complete`] ? "bg-success/15 text-success border-success/30" : "text-muted-foreground"}>{p}</Badge>)}</div></TableCell>
                <TableCell><Badge variant="outline">{w.stage}</Badge></TableCell>
                <TableCell>{w.planned_date_time ? new Date(w.planned_date_time).toLocaleString() : "—"}</TableCell>
                <TableCell>{w.ato_owner}</TableCell>
              </TableRow>
            ))}
            {a.workshops.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No workshops yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
      <NewWorkshopDialog open={openNew} onOpenChange={setOpenNew} defaultAccountId={id} onCreated={() => qc.invalidateQueries({ queryKey: ["account", id] })} />
    </div>
  );
}
