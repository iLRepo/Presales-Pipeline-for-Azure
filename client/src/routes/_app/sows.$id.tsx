import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getSow, updateSow } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SOW_STATUSES, ACTION_OWNERS, fmtDate } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/sows/$id")({ component: SowDetail });

function SowDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [s, setS] = useState<any>(null);

  const { data } = useQuery({ queryKey: ["sow", id], queryFn: () => getSow(id) });
  useEffect(() => { if (data) setS(data); }, [data]);

  const save = async (patch: any) => {
    try { await updateSow(id, patch); toast.success("Saved"); qc.invalidateQueries({ queryKey: ["sow", id] }); } catch (e: any) { toast.error(e.message); }
  };

  if (!s) return <div className="p-6 text-muted-foreground">Loading...</div>;

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <div>
        <Link to="/workshops/$id" params={{ id: s.workshop_id }} className="text-xs text-muted-foreground hover:underline">&larr; Workshop ({s.workshops?.accounts?.account_name})</Link>
        <h1 className="text-2xl font-semibold tracking-tight">{s.sow_name}</h1>
        <div className="flex gap-2 mt-1"><Badge>{s.status}</Badge><Badge variant="outline">Owner: {s.current_action_owner}</Badge></div>
      </div>
      <Card className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div><Label className="text-xs">SOW Name</Label><Input value={s.sow_name} onChange={(e) => setS({ ...s, sow_name: e.target.value })} onBlur={() => save({ sow_name: s.sow_name })} /></div>
        <div><Label className="text-xs">Status</Label><Select value={s.status} onValueChange={(v) => save({ status: v, signed_date: v === "Signed" ? new Date().toISOString().slice(0,10) : s.signed_date })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SOW_STATUSES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div>
        <div><Label className="text-xs">Current Action Owner</Label><Select value={s.current_action_owner} onValueChange={(v) => save({ current_action_owner: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ACTION_OWNERS.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div>
        <div><Label className="text-xs">Value ($)</Label><Input type="number" step="0.01" value={s.value ?? ""} onChange={(e) => setS({ ...s, value: e.target.value })} onBlur={() => save({ value: s.value === "" || s.value == null ? null : Number(s.value) })} /></div>
        <div><Label className="text-xs">AFO Revenue ($)</Label><Input type="number" step="0.01" value={s.afo_revenue ?? ""} onChange={(e) => setS({ ...s, afo_revenue: e.target.value })} onBlur={() => save({ afo_revenue: s.afo_revenue === "" || s.afo_revenue == null ? null : Number(s.afo_revenue) })} /></div>
        <div><Label className="text-xs">Submitted Date</Label><Input type="date" value={s.submitted_date ?? ""} onChange={(e) => { const v = e.target.value || null; setS({ ...s, submitted_date: v }); save({ submitted_date: v }); }} /></div>
        <div><Label className="text-xs">Signed Date</Label><Input type="date" value={s.signed_date ?? ""} onChange={(e) => { const v = e.target.value || null; setS({ ...s, signed_date: v }); save({ signed_date: v }); }} /></div>
        <div className="md:col-span-2"><Label className="text-xs">Notes</Label><Textarea rows={4} value={s.notes ?? ""} onChange={(e) => setS({ ...s, notes: e.target.value })} onBlur={() => save({ notes: s.notes })} /></div>
      </Card>
      <Card className="p-4">
        <div className="font-semibold mb-2">Related Tasks</div>
        {(s.tasks ?? []).length === 0 ? <div className="text-sm text-muted-foreground">No tasks.</div> : (
          <ul className="space-y-1.5">{s.tasks.map((t: any) => <li key={t.id} className="text-sm flex justify-between border-b pb-1"><span>{t.title}</span><Badge variant="outline">{t.status}</Badge></li>)}</ul>
        )}
        <div className="text-xs text-muted-foreground mt-3">Submitted: {fmtDate(s.submitted_date)} &middot; Signed: {fmtDate(s.signed_date)}</div>
      </Card>
    </div>
  );
}
