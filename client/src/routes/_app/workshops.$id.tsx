import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { getWorkshop, updateWorkshop, updateAccount, createSow, updateSow, deleteSow as apiDeleteSow, createTask, updateTask } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STAGES, ELIGIBILITY, SOW_STATUSES, ACTION_OWNERS, ROLES, TASK_STATUSES, fmtDate, daysSince, eligibilityBadgeClass } from "@/lib/constants";
import { Plus, Trash2, AlertCircle, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

const SECTION_STAGES: Record<string, string[]> = {
  "Proposed": ["Identified", "Proposed"],
  "Planning": ["Planning"],
  "Delivery": ["Scheduled", "Delivered"],
  "Follow-up": ["Follow-up"],
  "Proposal / Conversion": ["Conversion"],
  "Alliance & Funding": ["Delivered", "Follow-up", "Conversion", "SOW Submitted", "SOW Signed"],
  "SOWs": ["SOW Submitted", "SOW Signed"],
};

export const Route = createFileRoute("/_app/workshops/$id")({ component: WorkshopDetail });

function WorkshopDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { isAdmin, hasRole } = useAuth();
  const canEdit = isAdmin || hasRole("Account Manager") || hasRole("Alliance Team");
  const [w, setW] = useState<any>(null);

  const { data } = useQuery({ queryKey: ["workshop", id], queryFn: () => getWorkshop(id) });
  useEffect(() => { if (data) setW(data); }, [data]);

  const save = useMutation({
    mutationFn: async (patch: any) => { await updateWorkshop(id, patch); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["workshop", id] }); toast.success("Saved"); },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!w) return <div className="p-6 text-muted-foreground">Loading...</div>;

  const set = (patch: any) => setW({ ...w, ...patch });
  const stageWarnings: string[] = [];
  if (w.stage === "Scheduled" && !w.planned_date_time) stageWarnings.push("Stage is Scheduled but no planned date is set.");
  if (w.stage === "Delivered" && !w.delivered_date_time) stageWarnings.push("Stage is Delivered but no delivered date is set.");
  if ((w.stage === "SOW Submitted" || w.stage === "SOW Signed") && (!w.sows || w.sows.length === 0)) stageWarnings.push("No SOW records linked to this workshop yet.");

  const stageIdx = STAGES.indexOf(w.stage);
  const canSetStage = (v: string) => {
    if (v === "Delivered") {
      const delivered = w.delivered_date_time ? new Date(w.delivered_date_time) : null;
      const planned = w.planned_date_time ? new Date(w.planned_date_time) : null;
      const now = new Date();
      if (delivered && delivered > now) { toast.error("Delivered date is in the future."); return false; }
      if (!delivered && planned && planned > now) { toast.error("Workshop is scheduled in the future."); return false; }
    }
    return true;
  };
  const changeStage = (v: string) => { if (!canSetStage(v)) return; set({ stage: v }); save.mutate({ stage: v }); };
  const advance = () => { if (stageIdx < STAGES.length - 1) changeStage(STAGES[stageIdx + 1]); };
  const back = () => { if (stageIdx > 0) changeStage(STAGES[stageIdx - 1]); };

  return (
    <div className="p-6 space-y-4 max-w-6xl">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Link to="/workshops" className="text-xs text-muted-foreground hover:underline">&larr; Workshops</Link>
          <Input value={w.workshop_name ?? ""} placeholder={w.accounts?.account_name ?? "Workshop name"} onChange={(e) => set({ workshop_name: e.target.value })} onBlur={() => save.mutate({ workshop_name: w.workshop_name })}
            className="text-2xl font-semibold tracking-tight px-2 h-auto py-1 border border-dashed border-transparent hover:border-border focus-visible:border-primary bg-transparent" />
          <p className="text-sm text-muted-foreground">{w.accounts?.account_name} &middot; Envisioning workshop &middot; {daysSince(w.stage_last_updated_at)}d in stage</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className={eligibilityBadgeClass(w.eligibility_status)}>{w.eligibility_status}</Badge>
          <Badge>{w.stage}</Badge>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div><h2 className="font-semibold">Stage Progress</h2><p className="text-xs text-muted-foreground">Move this workshop through its lifecycle.</p></div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={back} disabled={stageIdx === 0}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
            <Select value={w.stage} onValueChange={changeStage}><SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger><SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
            <Button size="sm" onClick={advance} disabled={stageIdx === STAGES.length - 1}>Advance <ChevronRight className="h-4 w-4 ml-1" /></Button>
          </div>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {STAGES.map((s, i) => { const done = i < stageIdx; const current = i === stageIdx; return (
            <button key={s} onClick={() => changeStage(s)} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap transition-colors ${current ? "bg-primary text-primary-foreground border-primary" : done ? "bg-success/10 text-success border-success/30" : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"}`}>
              {done ? <Check className="h-3 w-3" /> : <span className="font-mono text-[10px] opacity-70">{i + 1}</span>}{s}
            </button>
          ); })}
        </div>
      </Card>

      {stageWarnings.length > 0 && <Card className="p-3 bg-warning/10 border-warning/30 flex gap-2 items-start"><AlertCircle className="h-4 w-4 text-warning-foreground mt-0.5" /><ul className="text-sm space-y-0.5">{stageWarnings.map((x) => <li key={x}>{x}</li>)}</ul></Card>}

      <Section title="Notes" cols={1}><Textarea rows={4} value={w.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} onBlur={() => save.mutate({ notes: w.notes })} /></Section>

      <Section title="Overview">
        <Field label="ATO Owner"><Input value={w.ato_owner ?? ""} onChange={(e) => set({ ato_owner: e.target.value })} onBlur={() => save.mutate({ ato_owner: w.ato_owner })} /></Field>
        <Field label="Account Manager"><Input value={w.accounts?.account_manager_name ?? ""} onChange={(e) => set({ accounts: { ...w.accounts, account_manager_name: e.target.value } })} onBlur={async () => { if (!w.account_id) return; try { await updateAccount(w.account_id, { account_manager_name: w.accounts?.account_manager_name || null }); toast.success("Saved"); qc.invalidateQueries({ queryKey: ["workshop", id] }); } catch (e: any) { toast.error(e.message); } }} /></Field>
        <Field label="Planned Date/Time"><Input type="datetime-local" value={toLocal(w.planned_date_time)} onChange={(e) => { const v = fromLocal(e.target.value); set({ planned_date_time: v }); save.mutate({ planned_date_time: v }); }} /></Field>
        <Field label="Region"><Input value={w.accounts?.region ?? ""} onChange={(e) => set({ accounts: { ...w.accounts, region: e.target.value } })} onBlur={async () => { if (!w.account_id) return; try { await updateAccount(w.account_id, { region: w.accounts?.region || null }); toast.success("Saved"); qc.invalidateQueries({ queryKey: ["workshop", id] }); } catch (e: any) { toast.error(e.message); } }} placeholder="e.g. East, West, EMEA" /></Field>
      </Section>

      <Section title="Proposed" currentStage={w.stage}>
        <Field label="Stakeholder Contact"><Input value={w.stakeholder_contact ?? ""} onChange={(e) => set({ stakeholder_contact: e.target.value })} onBlur={() => save.mutate({ stakeholder_contact: w.stakeholder_contact })} /></Field>
        <ToggleField label="First Meeting Scheduled" value={w.first_meeting_scheduled} onChange={(v) => { set({ first_meeting_scheduled: v }); save.mutate({ first_meeting_scheduled: v }); }} />
        <ToggleField label="Envisioning Proposed" value={w.envisioning_proposed} onChange={(v) => { set({ envisioning_proposed: v }); save.mutate({ envisioning_proposed: v }); }} />
      </Section>

      <Section title="Planning" currentStage={w.stage}>
        <ToggleField label="Workshop Agreed" value={w.workshop_agreed} onChange={(v) => { set({ workshop_agreed: v }); save.mutate({ workshop_agreed: v }); }} />
        <ToggleField label="Attendees / Roles Collected" value={w.attendees_roles_collected} onChange={(v) => { set({ attendees_roles_collected: v }); save.mutate({ attendees_roles_collected: v }); }} />
        <ToggleField label="Additional Use Cases Needed" value={w.additional_use_cases_needed} onChange={(v) => { set({ additional_use_cases_needed: v }); save.mutate({ additional_use_cases_needed: v }); }} />
        <ToggleField label="Content Built" value={w.content_built} onChange={(v) => { set({ content_built: v }); save.mutate({ content_built: v }); }} />
      </Section>

      <Section title="Delivery" currentStage={w.stage}>
        <Field label="Delivered Date/Time"><Input type="datetime-local" value={toLocal(w.delivered_date_time)} onChange={(e) => { const v = fromLocal(e.target.value); if (v && new Date(v) > new Date()) { toast.error("Delivered date cannot be in the future."); return; } set({ delivered_date_time: v }); save.mutate({ delivered_date_time: v }); }} /></Field>
        <div className="md:col-span-2 space-y-1.5">
          <Label className="text-xs">Envisioning Parts (checklist)</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <ToggleField label="Part 101" value={w.part_101_complete} onChange={(v) => { set({ part_101_complete: v }); save.mutate({ part_101_complete: v }); }} />
            <ToggleField label="Part 201" value={w.part_201_complete} onChange={(v) => { set({ part_201_complete: v }); save.mutate({ part_201_complete: v }); }} />
            <ToggleField label="Part 301" value={w.part_301_complete} onChange={(v) => { set({ part_301_complete: v }); save.mutate({ part_301_complete: v }); }} />
          </div>
        </div>
      </Section>

      <Section title="Follow-up" currentStage={w.stage}>
        <ToggleField label="Workshop Results Sent" value={w.workshop_results_sent} onChange={(v) => { set({ workshop_results_sent: v }); save.mutate({ workshop_results_sent: v }); }} />
      </Section>

      <Section title="Proposal / Conversion" currentStage={w.stage}>
        <ToggleField label="Use Cases Identified" value={w.use_cases_identified} onChange={(v) => { set({ use_cases_identified: v }); save.mutate({ use_cases_identified: v }); }} />
        <ToggleField label="ATO Proposed" value={w.ato_proposed} onChange={(v) => { set({ ato_proposed: v }); save.mutate({ ato_proposed: v }); }} />
        <ToggleField label="Proposal Created" value={w.proposal_created} onChange={(v) => { set({ proposal_created: v }); save.mutate({ proposal_created: v }); }} />
      </Section>

      <Section title="Alliance & Funding" currentStage={w.stage}>
        <Field label="Eligibility Status"><Select value={w.eligibility_status} onValueChange={(v) => { set({ eligibility_status: v }); save.mutate({ eligibility_status: v }); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ELIGIBILITY.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Account Designation"><Input value={w.account_designation ?? ""} onChange={(e) => set({ account_designation: e.target.value })} onBlur={() => save.mutate({ account_designation: w.account_designation })} /></Field>
        <ToggleField label="Funding Submitted" value={w.funding_submitted} onChange={(v) => { set({ funding_submitted: v }); save.mutate({ funding_submitted: v }); }} />
        <Field label="Funding Submitted Date"><Input type="date" value={w.funding_submitted_date ?? ""} onChange={(e) => { const v = e.target.value || null; set({ funding_submitted_date: v }); save.mutate({ funding_submitted_date: v }); }} /></Field>
        <Field label="Funding Anticipated ($)"><Input type="number" value={w.funding_anticipated_amount ?? ""} onChange={(e) => set({ funding_anticipated_amount: e.target.value })} onBlur={() => save.mutate({ funding_anticipated_amount: w.funding_anticipated_amount ? Number(w.funding_anticipated_amount) : null })} /></Field>
        <Field label="Funding Recognized ($)"><Input type="number" value={w.funding_recognized_amount ?? ""} onChange={(e) => set({ funding_recognized_amount: e.target.value })} onBlur={() => save.mutate({ funding_recognized_amount: w.funding_recognized_amount ? Number(w.funding_recognized_amount) : null })} /></Field>
      </Section>

      <Section title="Post-Workshop Tracker" cols={1}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="POC (Point of Contact)"><Input value={w.poc_name ?? ""} onChange={(e) => set({ poc_name: e.target.value })} onBlur={() => save.mutate({ poc_name: w.poc_name || null })} /></Field>
          <Field label="Estimated Revenue (free text)"><Input value={w.est_revenue_text ?? ""} onChange={(e) => set({ est_revenue_text: e.target.value })} onBlur={() => save.mutate({ est_revenue_text: w.est_revenue_text || null })} /></Field>
          <Field label="MS Funding"><Input value={w.ms_funding_status ?? ""} onChange={(e) => set({ ms_funding_status: e.target.value })} onBlur={() => save.mutate({ ms_funding_status: w.ms_funding_status || null })} /></Field>
          <Field label="Bucket"><Input value={w.bucket ?? ""} onChange={(e) => set({ bucket: e.target.value })} onBlur={() => save.mutate({ bucket: w.bucket || null })} /></Field>
          <Field label="Use Cases"><Select value={w.use_cases_status ?? "none"} onValueChange={(v) => { const val = v === "none" ? null : v; set({ use_cases_status: val }); save.mutate({ use_cases_status: val }); }}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent><SelectItem value="none">—</SelectItem><SelectItem value="Yes">Yes</SelectItem><SelectItem value="No">No</SelectItem><SelectItem value="Multi-track">Multi-track</SelectItem><SelectItem value="RFP">RFP</SelectItem></SelectContent></Select></Field>
          <Field label="Proposal"><Select value={w.proposal_status ?? "none"} onValueChange={(v) => { const val = v === "none" ? null : v; set({ proposal_status: val }); save.mutate({ proposal_status: val }); }}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent><SelectItem value="none">—</SelectItem><SelectItem value="Yes">Yes</SelectItem><SelectItem value="No">No</SelectItem><SelectItem value="In Progress">In Progress</SelectItem><SelectItem value="Closed">Closed</SelectItem><SelectItem value="RFP responded">RFP responded</SelectItem></SelectContent></Select></Field>
        </div>
        <Field label="Current Status"><Textarea rows={2} value={w.current_status ?? ""} onChange={(e) => set({ current_status: e.target.value })} onBlur={() => save.mutate({ current_status: w.current_status || null })} /></Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Workshop Details"><Textarea rows={4} value={w.workshop_details ?? ""} onChange={(e) => set({ workshop_details: e.target.value })} onBlur={() => save.mutate({ workshop_details: w.workshop_details || null })} /></Field>
          <Field label="Opportunities (one per line: Name $Value | Salesforce URL)">
            <Textarea rows={4} value={(w.opportunities ?? []).map((o: any) => `${o.name ?? ""}${o.value ? ` ${o.value}` : ""}${o.url ? ` | ${o.url}` : ""}`).join("\n")}
              onChange={(e) => set({ opportunities: e.target.value.split("\n").map((line: string) => { const [left, ...urlParts] = line.split("|"); const url = urlParts.join("|").trim(); const m = (left ?? "").match(/^(.*?)(\s+(\$?[\d.,KMB]+.*))?$/); return { name: (m?.[1] ?? left ?? "").trim(), value: (m?.[3] ?? "").trim(), url }; }).filter((o: any) => o.name) })}
              onBlur={() => save.mutate({ opportunities: w.opportunities ?? [] })} />
          </Field>
          <Field label="Dependency / Risks"><Textarea rows={3} value={w.dependency_risks ?? ""} onChange={(e) => set({ dependency_risks: e.target.value })} onBlur={() => save.mutate({ dependency_risks: w.dependency_risks || null })} /></Field>
          <Field label="Next Steps"><Textarea rows={3} value={w.next_steps ?? ""} onChange={(e) => set({ next_steps: e.target.value })} onBlur={() => save.mutate({ next_steps: w.next_steps || null })} /></Field>
        </div>
      </Section>

      <SowsBlock workshopId={id} sows={w.sows ?? []} canEdit={canEdit} onChange={() => qc.invalidateQueries({ queryKey: ["workshop", id] })} />
      <TasksBlock workshopId={id} tasks={w.tasks ?? []} onChange={() => qc.invalidateQueries({ queryKey: ["workshop", id] })} />

      <Section title="Blockers" cols={1}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <ToggleField label="Technical Blocker" value={w.technical_blocker} onChange={(v) => { set({ technical_blocker: v }); save.mutate({ technical_blocker: v }); }} />
            <Field label="Technical Blocker Comments"><Textarea rows={3} value={w.technical_blocker_comments ?? ""} onChange={(e) => set({ technical_blocker_comments: e.target.value })} onBlur={() => save.mutate({ technical_blocker_comments: w.technical_blocker_comments })} /></Field>
          </div>
          <div className="space-y-2">
            <ToggleField label="Personnel Blocker" value={w.personnel_blocker} onChange={(v) => { set({ personnel_blocker: v }); save.mutate({ personnel_blocker: v }); }} />
            <Field label="Personnel Blocker Comments"><Textarea rows={3} value={w.personnel_blocker_comments ?? ""} onChange={(e) => set({ personnel_blocker_comments: e.target.value })} onBlur={() => save.mutate({ personnel_blocker_comments: w.personnel_blocker_comments })} /></Field>
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children, cols = 2, currentStage }: { title: string; children: React.ReactNode; cols?: number; currentStage?: string }) {
  const stages = SECTION_STAGES[title]; const isActive = stages && currentStage && stages.includes(currentStage);
  return (<Card className={`p-4 ${isActive ? "ring-1 ring-primary/40" : ""}`}><div className="flex items-center justify-between mb-3 flex-wrap gap-2"><h2 className="font-semibold">{title}</h2>{isActive && <Badge className="text-[10px] py-0 h-5">Active stage</Badge>}</div><div className={`grid gap-3 ${cols === 1 ? "" : "grid-cols-1 md:grid-cols-2"}`}>{children}</div></Card>);
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>; }
function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (<div className="flex items-center justify-between rounded-md border bg-secondary/30 px-3 py-2"><Label className="text-sm">{label}</Label><Switch checked={!!value} onCheckedChange={onChange} /></div>);
}
function toLocal(iso: string | null) { if (!iso) return ""; const d = new Date(iso); const off = d.getTimezoneOffset(); return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16); }
function fromLocal(v: string) { return v ? new Date(v).toISOString() : null; }

function SowsBlock({ workshopId, sows, canEdit, onChange }: { workshopId: string; sows: any[]; canEdit: boolean; onChange: () => void }) {
  const [adding, setAdding] = useState(false); const [name, setName] = useState("");
  const add = async () => { if (!name.trim()) return; try { await createSow({ workshop_id: workshopId, sow_name: name.trim() }); toast.success("SOW added"); setName(""); setAdding(false); onChange(); } catch (e: any) { toast.error(e.message); } };
  const update = async (id: string, patch: any) => { try { await updateSow(id, patch); onChange(); } catch (e: any) { toast.error(e.message); } };
  const del = async (id: string) => { try { await apiDeleteSow(id); toast.success("Deleted"); onChange(); } catch (e: any) { toast.error(e.message); } };
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3"><h2 className="font-semibold">SOWs ({sows.length})</h2>{canEdit && <Button size="sm" variant="outline" onClick={() => setAdding((a) => !a)}><Plus className="h-3 w-3 mr-1" /> Add SOW</Button>}</div>
      {adding && <div className="flex gap-2 mb-3"><Input placeholder="SOW name" value={name} onChange={(e) => setName(e.target.value)} /><Button onClick={add}>Save</Button></div>}
      <div className="space-y-2">
        {sows.map((s: any) => (
          <div key={s.id} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center border rounded-md p-2 bg-card">
            <Link to="/sows/$id" params={{ id: s.id }} className="text-sm font-medium text-primary hover:underline">{s.sow_name}</Link>
            <Select value={s.status} onValueChange={(v) => update(s.id, { status: v, signed_date: v === "Signed" ? new Date().toISOString().slice(0,10) : s.signed_date })}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent>{SOW_STATUSES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>
            <Select value={s.current_action_owner} onValueChange={(v) => update(s.id, { current_action_owner: v })}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent>{ACTION_OWNERS.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>
            <div className="text-xs tabular-nums"><div>Value: {s.value != null ? `$${Number(s.value).toLocaleString()}` : "—"}</div><div className="text-emerald-700">AFO: {s.afo_revenue != null ? `$${Number(s.afo_revenue).toLocaleString()}` : "—"}</div></div>
            <div className="text-xs text-muted-foreground">Submitted: {fmtDate(s.submitted_date)} &middot; Signed: {fmtDate(s.signed_date)}</div>
            <div className="flex justify-end"><Button size="icon" variant="ghost" onClick={() => del(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div>
          </div>
        ))}
        {sows.length === 0 && <div className="text-sm text-muted-foreground">No SOWs yet.</div>}
      </div>
    </Card>
  );
}

function TasksBlock({ workshopId, tasks, onChange }: { workshopId: string; tasks: any[]; onChange: () => void }) {
  const [adding, setAdding] = useState(false); const [title, setTitle] = useState(""); const [role, setRole] = useState<string>("ATO Admin");
  const add = async () => { if (!title.trim()) return; try { await createTask({ related_workshop_id: workshopId, title: title.trim(), assigned_role: role }); toast.success("Task added"); setTitle(""); setAdding(false); onChange(); } catch (e: any) { toast.error(e.message); } };
  const update = async (id: string, patch: any) => { try { await updateTask(id, patch); onChange(); } catch (e: any) { toast.error(e.message); } };
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3"><h2 className="font-semibold">Tasks ({tasks.length})</h2><Button size="sm" variant="outline" onClick={() => setAdding((a) => !a)}><Plus className="h-3 w-3 mr-1" /> Add Task</Button></div>
      {adding && <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3"><Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} /><Select value={role} onValueChange={setRole}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select><Button onClick={add}>Save</Button></div>}
      <div className="space-y-2">
        {tasks.map((t: any) => (
          <div key={t.id} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center border rounded-md p-2 bg-card">
            <div className="text-sm font-medium md:col-span-2">{t.title}</div>
            <Badge variant="outline">{t.assigned_role}</Badge>
            <Select value={t.status} onValueChange={(v) => update(t.id, { status: v })}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent>{TASK_STATUSES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>
          </div>
        ))}
        {tasks.length === 0 && <div className="text-sm text-muted-foreground">No tasks.</div>}
      </div>
    </Card>
  );
}
