import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getWorkshops, updateWorkshop } from "@/lib/api";
import { STAGES, ELIGIBILITY, daysSince, fmtDate, eligibilityBadgeClass } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, ArrowUp, ArrowDown, ChevronsUpDown, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { NewWorkshopDialog } from "@/components/dialogs/NewWorkshopDialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/workshops/")({ component: WorkshopsList });

const SAVED = { all: "All", stuck: "Stuck (sorted by days in stage)", delivered_no_followup: "Delivered but follow-up not sent", conversion_no_sow: "In Conversion without SOWs", sow_submitted_none_signed: "SOW Submitted but none Signed" } as const;
type SavedKey = keyof typeof SAVED;
type SortKey = "workshop" | "account" | "stage" | "days_in_stage" | "planned" | "delivered" | "eligibility" | "funding_rec" | "funding_proj" | "am" | "region";

const STAGE_ORDER: Record<string, number> = Object.fromEntries(STAGES.map((s, i) => [s, i]));

function getSortValue(w: any, key: SortKey): string | number {
  switch (key) {
    case "workshop": case "account": return (w.accounts?.account_name ?? "").toLowerCase();
    case "stage": return STAGE_ORDER[w.stage] ?? -1;
    case "days_in_stage": return daysSince(w.stage_last_updated_at);
    case "planned": return w.planned_date_time ? new Date(w.planned_date_time).getTime() : -Infinity;
    case "delivered": return w.delivered_date_time ? new Date(w.delivered_date_time).getTime() : -Infinity;
    case "eligibility": return (w.eligibility_status ?? "").toLowerCase();
    case "funding_rec": return w.funding_recognized_amount != null ? Number(w.funding_recognized_amount) : -Infinity;
    case "funding_proj": return w.funding_anticipated_amount != null ? Number(w.funding_anticipated_amount) : -Infinity;
    case "am": return (w.accounts?.account_manager_name ?? "").toLowerCase();
    case "region": return (w.accounts?.region ?? "").toLowerCase();
  }
}

function WorkshopsList() {
  const [view, setView] = useState<SavedKey>("all");
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<string>("all");
  const [elig, setElig] = useState<string>("all");
  const [openNew, setOpenNew] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);
  const qc = useQueryClient();

  const { data } = useQuery({ queryKey: ["workshops-list"], queryFn: () => getWorkshops() });

  const rows = useMemo(() => {
    let r = (data ?? []).slice();
    if (view === "stuck") r = r.sort((a: any, b: any) => daysSince(b.stage_last_updated_at) - daysSince(a.stage_last_updated_at));
    if (view === "delivered_no_followup") r = r.filter((w: any) => w.stage === "Delivered" && !w.workshop_results_sent);
    if (view === "conversion_no_sow") r = r.filter((w: any) => w.stage === "Conversion" && (w.sows?.length ?? 0) === 0);
    if (view === "sow_submitted_none_signed") r = r.filter((w: any) => w.stage === "SOW Submitted" && !w.sows?.some((s: any) => s.status === "Signed"));
    if (stage !== "all") r = r.filter((w: any) => w.stage === stage);
    if (elig !== "all") r = r.filter((w: any) => w.eligibility_status === elig);
    if (search) { const s = search.toLowerCase(); r = r.filter((w: any) => (w.accounts?.account_name ?? "").toLowerCase().includes(s) || (w.accounts?.account_manager_name ?? "").toLowerCase().includes(s)); }
    if (sort) { const { key, dir } = sort; r = r.slice().sort((a: any, b: any) => { const av = getSortValue(a, key); const bv = getSortValue(b, key); if (av < bv) return dir === "asc" ? -1 : 1; if (av > bv) return dir === "asc" ? 1 : -1; return 0; }); }
    return r;
  }, [data, view, stage, elig, search, sort]);

  const toggleSort = (key: SortKey) => { setSort((cur) => { if (!cur || cur.key !== key) return { key, dir: "asc" }; if (cur.dir === "asc") return { key, dir: "desc" }; return null; }); };

  const SortHeader = ({ k, label, align }: { k: SortKey; label: string; align?: "right" }) => {
    const active = sort?.key === k;
    const Icon = active ? (sort!.dir === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;
    return (
      <TableHead className={align === "right" ? "text-right" : undefined}>
        <button type="button" onClick={() => toggleSort(k)} className={cn("inline-flex items-center gap-1 hover:text-foreground transition-colors", align === "right" && "ml-auto", active ? "text-foreground" : "text-muted-foreground")}>
          <span>{label}</span><Icon className="h-3.5 w-3.5" />
        </button>
      </TableHead>
    );
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-semibold tracking-tight">Workshops</h1><p className="text-sm text-muted-foreground">All workshops across all accounts.</p></div>
        <Button onClick={() => setOpenNew(true)}><Plus className="h-4 w-4 mr-1" /> New Workshop</Button>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        {(Object.keys(SAVED) as SavedKey[]).map((k) => <Button key={k} size="sm" variant={view === k ? "default" : "outline"} onClick={() => setView(k)}>{SAVED[k]}</Button>)}
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => {
          const exportRows = rows.map((w: any) => ({ Workshop: `${w.accounts?.account_name ?? ""} - Envisioning`, Account: w.accounts?.account_name ?? "", Stage: w.stage, "Days in stage": daysSince(w.stage_last_updated_at), Planned: w.planned_date_time ? new Date(w.planned_date_time).toISOString().slice(0, 10) : "", Delivered: w.delivered_date_time ? new Date(w.delivered_date_time).toISOString().slice(0, 10) : "", Eligibility: w.eligibility_status, "Funding Recognized": w.funding_recognized_amount != null ? Number(w.funding_recognized_amount) : null, "Funding Projection": w.funding_anticipated_amount != null ? Number(w.funding_anticipated_amount) : null, "Account Manager": w.accounts?.account_manager_name ?? "", Region: w.accounts?.region ?? "", "SOW Count": w.sows?.length ?? 0, "SOWs Signed": w.sows?.filter((s: any) => s.status === "Signed").length ?? 0 }));
          const ws = XLSX.utils.json_to_sheet(exportRows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Workshops"); XLSX.writeFile(wb, `workshops-${new Date().toISOString().slice(0, 10)}.xlsx`); toast.success(`Exported ${exportRows.length} workshops`);
        }}><Download className="h-4 w-4 mr-1" /> Export Excel</Button>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
        <Select value={stage} onValueChange={setStage}><SelectTrigger className="w-40"><SelectValue placeholder="Stage" /></SelectTrigger><SelectContent><SelectItem value="all">All stages</SelectItem>{STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
        <Select value={elig} onValueChange={setElig}><SelectTrigger className="w-44"><SelectValue placeholder="Eligibility" /></SelectTrigger><SelectContent><SelectItem value="all">All eligibility</SelectItem>{ELIGIBILITY.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
      </div>
      <div className="rounded-md border bg-card overflow-visible">
        <table className="w-max min-w-full caption-bottom text-sm">
          <TableHeader><TableRow>
            <SortHeader k="workshop" label="Workshop" /><SortHeader k="account" label="Account" /><SortHeader k="stage" label="Stage" /><SortHeader k="days_in_stage" label="Days in stage" />
            <SortHeader k="planned" label="Planned" /><SortHeader k="delivered" label="Delivered" /><SortHeader k="eligibility" label="Eligibility" />
            <SortHeader k="funding_rec" label="Funding Rec" align="right" /><SortHeader k="funding_proj" label="Funding Projection" align="right" /><SortHeader k="am" label="AM" /><SortHeader k="region" label="Region" />
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((w: any) => (
              <TableRow key={w.id}>
                <TableCell><Link to="/workshops/$id" params={{ id: w.id }} className="text-primary hover:underline">{w.accounts?.account_name} - Envisioning</Link></TableCell>
                <TableCell><Link to="/accounts/$id" params={{ id: w.account_id }} className="text-primary hover:underline">{w.accounts?.account_name}</Link></TableCell>
                <TableCell>
                  <Select value={w.stage} onValueChange={async (v) => {
                    if (v === "Delivered") { const delivered = w.delivered_date_time ? new Date(w.delivered_date_time) : null; const planned = w.planned_date_time ? new Date(w.planned_date_time) : null; const now = new Date(); if (delivered && delivered > now) { toast.error("Delivered date is in the future."); return; } if (!delivered && planned && planned > now) { toast.error("Workshop is scheduled in the future."); return; } }
                    await updateWorkshop(w.id, { stage: v }); qc.invalidateQueries({ queryKey: ["workshops-list"] });
                  }}><SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger><SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
                </TableCell>
                <TableCell>{daysSince(w.stage_last_updated_at)}d</TableCell>
                <TableCell>{fmtDate(w.planned_date_time)}</TableCell><TableCell>{fmtDate(w.delivered_date_time)}</TableCell>
                <TableCell><Badge variant="outline" className={eligibilityBadgeClass(w.eligibility_status)}>{w.eligibility_status}</Badge></TableCell>
                <TableCell className="text-right tabular-nums">{w.funding_recognized_amount != null ? `$${Number(w.funding_recognized_amount).toLocaleString()}` : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{w.funding_anticipated_amount != null ? `$${Number(w.funding_anticipated_amount).toLocaleString()}` : "—"}</TableCell>
                <TableCell>{w.accounts?.account_manager_name ?? "—"}</TableCell><TableCell>{w.accounts?.region ?? "—"}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">No workshops match.</TableCell></TableRow>}
          </TableBody>
        </table>
      </div>
      <NewWorkshopDialog open={openNew} onOpenChange={setOpenNew} onCreated={() => qc.invalidateQueries({ queryKey: ["workshops-list"] })} />
    </div>
  );
}
