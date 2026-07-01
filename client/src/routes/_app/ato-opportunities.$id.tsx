import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { getAtoOpportunity, updateAtoOpportunity, updateAccount } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ATO_OPP_STAGES, daysSince } from "@/lib/constants";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/ato-opportunities/$id")({ component: AtoOpportunityDetail });

function AtoOpportunityDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [o, setO] = useState<any>(null);

  const { data } = useQuery({ queryKey: ["ato-opportunity", id], queryFn: () => getAtoOpportunity(id) });
  useEffect(() => { if (data) setO(data); }, [data]);

  const save = useMutation({
    mutationFn: async (patch: any) => { await updateAtoOpportunity(id, patch); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ato-opportunity", id] }); toast.success("Saved"); },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!o) return <div className="p-6 text-muted-foreground">Loading...</div>;

  const set = (patch: any) => setO({ ...o, ...patch });

  const stageIdx = ATO_OPP_STAGES.indexOf(o.stage);
  const changeStage = (v: string) => { set({ stage: v }); save.mutate({ stage: v }); };
  const advance = () => { if (stageIdx < ATO_OPP_STAGES.length - 1) changeStage(ATO_OPP_STAGES[stageIdx + 1]); };
  const back = () => { if (stageIdx > 0) changeStage(ATO_OPP_STAGES[stageIdx - 1]); };

  return (
    <div className="p-6 space-y-4 max-w-6xl">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Link to="/ato-opportunities" className="text-xs text-muted-foreground hover:underline">&larr; ATO Opportunities</Link>
          <Input value={o.opportunity_name ?? ""} placeholder={o.accounts?.account_name ?? "Opportunity name"}
            onChange={(e) => set({ opportunity_name: e.target.value })}
            onBlur={() => save.mutate({ opportunity_name: o.opportunity_name })}
            className="text-2xl font-semibold tracking-tight px-2 h-auto py-1 border border-dashed border-transparent hover:border-border focus-visible:border-primary bg-transparent" />
          <p className="text-sm text-muted-foreground">{o.accounts?.account_name} &middot; ATO Opportunity &middot; {daysSince(o.stage_last_updated_at)}d in stage</p>
        </div>
        <Badge>{o.stage}</Badge>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div><h2 className="font-semibold">Stage Progress</h2><p className="text-xs text-muted-foreground">Move this opportunity through its lifecycle.</p></div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={back} disabled={stageIdx <= 0}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
            <Select value={o.stage} onValueChange={changeStage}><SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger><SelectContent>{ATO_OPP_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
            <Button size="sm" onClick={advance} disabled={stageIdx >= ATO_OPP_STAGES.length - 1}>Advance <ChevronRight className="h-4 w-4 ml-1" /></Button>
          </div>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {ATO_OPP_STAGES.map((s, i) => { const done = i < stageIdx; const current = i === stageIdx; return (
            <button key={s} onClick={() => changeStage(s)} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap transition-colors ${current ? "bg-primary text-primary-foreground border-primary" : done ? "bg-success/10 text-success border-success/30" : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"}`}>
              {done ? <Check className="h-3 w-3" /> : <span className="font-mono text-[10px] opacity-70">{i + 1}</span>}{s}
            </button>
          ); })}
        </div>
      </Card>

      <Section title="Notes" cols={1}>
        <Textarea rows={4} value={o.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} onBlur={() => save.mutate({ notes: o.notes })} />
      </Section>

      <Section title="Overview">
        <Field label="ATO Owner"><Input value={o.ato_owner ?? ""} onChange={(e) => set({ ato_owner: e.target.value })} onBlur={() => save.mutate({ ato_owner: o.ato_owner })} /></Field>
        <Field label="Account Manager"><Input value={o.accounts?.account_manager_name ?? ""} onChange={(e) => set({ accounts: { ...o.accounts, account_manager_name: e.target.value } })} onBlur={async () => { if (!o.account_id) return; try { await updateAccount(o.account_id, { account_manager_name: o.accounts?.account_manager_name || null }); toast.success("Saved"); qc.invalidateQueries({ queryKey: ["ato-opportunity", id] }); } catch (e: any) { toast.error(e.message); } }} /></Field>
        <Field label="Region"><Input value={o.accounts?.region ?? ""} onChange={(e) => set({ accounts: { ...o.accounts, region: e.target.value } })} onBlur={async () => { if (!o.account_id) return; try { await updateAccount(o.account_id, { region: o.accounts?.region || null }); toast.success("Saved"); qc.invalidateQueries({ queryKey: ["ato-opportunity", id] }); } catch (e: any) { toast.error(e.message); } }} placeholder="e.g. East, West, EMEA" /></Field>
      </Section>

      <Section title="Opportunity Tracker" cols={1}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="POC (Point of Contact)"><Input value={o.poc_name ?? ""} onChange={(e) => set({ poc_name: e.target.value })} onBlur={() => save.mutate({ poc_name: o.poc_name || null })} /></Field>
          <Field label="Estimated Revenue (free text)"><Input value={o.est_revenue_text ?? ""} onChange={(e) => set({ est_revenue_text: e.target.value })} onBlur={() => save.mutate({ est_revenue_text: o.est_revenue_text || null })} placeholder="e.g. $50K-$100K, $165K (Beak)" /></Field>
          <Field label="Estimated Revenue Salesforce URL"><Input value={o.est_revenue_url ?? ""} onChange={(e) => set({ est_revenue_url: e.target.value })} onBlur={() => save.mutate({ est_revenue_url: o.est_revenue_url || null })} placeholder="https://mycompany.lightning.force.com/lightning/r/Opportunity/..." /></Field>
          <Field label="MS Funding"><Input value={o.ms_funding_status ?? ""} onChange={(e) => set({ ms_funding_status: e.target.value })} onBlur={() => save.mutate({ ms_funding_status: o.ms_funding_status || null })} /></Field>
          <Field label="Bucket"><Input value={o.bucket ?? ""} onChange={(e) => set({ bucket: e.target.value })} onBlur={() => save.mutate({ bucket: o.bucket || null })} /></Field>
          <Field label="Use Cases"><Select value={o.use_cases_status ?? "none"} onValueChange={(v) => { const val = v === "none" ? null : v; set({ use_cases_status: val }); save.mutate({ use_cases_status: val }); }}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent><SelectItem value="none">—</SelectItem><SelectItem value="Yes">Yes</SelectItem><SelectItem value="No">No</SelectItem><SelectItem value="Multi-track">Multi-track</SelectItem><SelectItem value="RFP">RFP</SelectItem></SelectContent></Select></Field>
          <Field label="Proposal"><Select value={o.proposal_status ?? "none"} onValueChange={(v) => { const val = v === "none" ? null : v; set({ proposal_status: val }); save.mutate({ proposal_status: val }); }}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent><SelectItem value="none">—</SelectItem><SelectItem value="Yes">Yes</SelectItem><SelectItem value="No">No</SelectItem><SelectItem value="In Progress">In Progress</SelectItem><SelectItem value="Closed">Closed</SelectItem><SelectItem value="RFP responded">RFP responded</SelectItem></SelectContent></Select></Field>
          <Field label="Funding Anticipated ($)"><Input type="number" value={o.funding_anticipated_amount ?? ""} onChange={(e) => set({ funding_anticipated_amount: e.target.value })} onBlur={() => save.mutate({ funding_anticipated_amount: o.funding_anticipated_amount ? Number(o.funding_anticipated_amount) : null })} /></Field>
          <Field label="Funding Recognized ($)"><Input type="number" value={o.funding_recognized_amount ?? ""} onChange={(e) => set({ funding_recognized_amount: e.target.value })} onBlur={() => save.mutate({ funding_recognized_amount: o.funding_recognized_amount ? Number(o.funding_recognized_amount) : null })} /></Field>
        </div>
        <Field label="Current Status"><Textarea rows={2} value={o.current_status ?? ""} onChange={(e) => set({ current_status: e.target.value })} onBlur={() => save.mutate({ current_status: o.current_status || null })} /></Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Description"><Textarea rows={4} value={o.description ?? ""} onChange={(e) => set({ description: e.target.value })} onBlur={() => save.mutate({ description: o.description || null })} /></Field>
          <Field label="Opportunities (one per line: Name $Value | Salesforce URL)">
            <Textarea rows={4} value={(o.opportunities ?? []).map((op: any) => `${op.name ?? ""}${op.value ? ` ${op.value}` : ""}${op.url ? ` | ${op.url}` : ""}`).join("\n")}
              onChange={(e) => set({ opportunities: e.target.value.split("\n").map((line: string) => { const [left, ...urlParts] = line.split("|"); const url = urlParts.join("|").trim(); const m = (left ?? "").match(/^(.*?)(\s+(\$?[\d.,KMB]+.*))?$/); return { name: (m?.[1] ?? left ?? "").trim(), value: (m?.[3] ?? "").trim(), url }; }).filter((op: any) => op.name) })}
              onBlur={() => save.mutate({ opportunities: o.opportunities ?? [] })} />
          </Field>
          <Field label="Dependency / Risks"><Textarea rows={3} value={o.dependency_risks ?? ""} onChange={(e) => set({ dependency_risks: e.target.value })} onBlur={() => save.mutate({ dependency_risks: o.dependency_risks || null })} /></Field>
          <Field label="Next Steps"><Textarea rows={3} value={o.next_steps ?? ""} onChange={(e) => set({ next_steps: e.target.value })} onBlur={() => save.mutate({ next_steps: o.next_steps || null })} /></Field>
        </div>
      </Section>

      <Section title="Blockers" cols={1}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <ToggleField label="Technical Blocker" value={o.technical_blocker} onChange={(v) => { set({ technical_blocker: v }); save.mutate({ technical_blocker: v }); }} />
            <Field label="Technical Blocker Comments"><Textarea rows={3} value={o.technical_blocker_comments ?? ""} onChange={(e) => set({ technical_blocker_comments: e.target.value })} onBlur={() => save.mutate({ technical_blocker_comments: o.technical_blocker_comments })} /></Field>
          </div>
          <div className="space-y-2">
            <ToggleField label="Personnel Blocker" value={o.personnel_blocker} onChange={(v) => { set({ personnel_blocker: v }); save.mutate({ personnel_blocker: v }); }} />
            <Field label="Personnel Blocker Comments"><Textarea rows={3} value={o.personnel_blocker_comments ?? ""} onChange={(e) => set({ personnel_blocker_comments: e.target.value })} onBlur={() => save.mutate({ personnel_blocker_comments: o.personnel_blocker_comments })} /></Field>
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children, cols = 2 }: { title: string; children: React.ReactNode; cols?: number }) {
  return (<Card className="p-4"><div className="mb-3"><h2 className="font-semibold">{title}</h2></div><div className={`grid gap-3 ${cols === 1 ? "" : "grid-cols-1 md:grid-cols-2"}`}>{children}</div></Card>);
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>; }
function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (<div className="flex items-center justify-between rounded-md border bg-secondary/30 px-3 py-2"><Label className="text-sm">{label}</Label><Switch checked={!!value} onCheckedChange={onChange} /></div>);
}
