import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getAtoOpportunities, deleteAtoOpportunity } from "@/lib/api";
import { ATO_OPP_STAGES, daysSince, fmtDate } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, ChevronDown, ChevronUp, Briefcase, DollarSign, AlertCircle, Trash2, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { NewAtoOpportunityDialog } from "@/components/dialogs/NewAtoOpportunityDialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/ato-opportunities/")({ component: AtoOpportunitiesList });

type AtoOppRow = {
  id: string;
  account_id: string;
  opportunity_name: string | null;
  stage: string;
  stage_last_updated_at: string;
  updated_at: string;
  poc_name: string | null;
  est_revenue_text: string | null;
  est_revenue_url: string | null;
  ms_funding_status: string | null;
  bucket: string | null;
  use_cases_status: string | null;
  proposal_status: string | null;
  current_status: string | null;
  description: string | null;
  dependency_risks: string | null;
  next_steps: string | null;
  opportunities: { name: string; value?: string; url?: string }[] | null;
  funding_anticipated_amount: number | null;
  funding_recognized_amount: number | null;
  technical_blocker: boolean;
  personnel_blocker: boolean;
  accounts: { id: string; account_name: string; account_manager_name: string | null; region: string | null } | null;
};

function statusBadgeClass(v: string | null | undefined): string {
  const s = (v ?? "").toLowerCase();
  if (!s) return "bg-muted text-muted-foreground border-border";
  if (s === "yes") return "bg-violet-500/15 text-violet-700 border-violet-500/30";
  if (s === "no") return "bg-muted text-muted-foreground border-border";
  if (s === "multi-track") return "bg-rose-500/15 text-rose-700 border-rose-500/30";
  if (s === "rfp") return "bg-blue-500/15 text-blue-700 border-blue-500/30";
  if (s === "rfp responded") return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
  if (s === "in progress") return "bg-amber-500/20 text-amber-800 border-amber-500/30";
  if (s === "closed") return "bg-slate-500/15 text-slate-700 border-slate-500/30";
  return "bg-muted text-muted-foreground border-border";
}

function rowBorderColor(idx: number): string {
  const palette = [
    "border-l-violet-400", "border-l-amber-400", "border-l-emerald-400", "border-l-rose-400",
    "border-l-sky-400", "border-l-orange-400", "border-l-pink-400", "border-l-teal-400",
  ];
  return palette[idx % palette.length];
}

function stageBadgeClass(s: string): string {
  switch (s) {
    case "Identified": return "bg-slate-500/15 text-slate-700 border-slate-500/30";
    case "Qualified": return "bg-blue-500/15 text-blue-700 border-blue-500/30";
    case "Proposal": return "bg-indigo-500/15 text-indigo-700 border-indigo-500/30";
    case "SOW Submitted": return "bg-amber-500/15 text-amber-700 border-amber-500/30";
    case "SOW Signed": return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
    case "Closed Won": return "bg-green-500/15 text-green-700 border-green-500/30";
    case "Closed Lost": return "bg-destructive/10 text-destructive border-destructive/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

const POST_GRID = "grid grid-cols-[1.2fr_1fr_1fr_1.2fr_1fr_0.7fr_0.9fr_2fr_28px] gap-3";

function AtoOpportunitiesList() {
  const qc = useQueryClient();
  const [openNew, setOpenNew] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["ato-opportunities"],
    queryFn: getAtoOpportunities,
  });

  const [colFilters, setColFilters] = useState<{
    account: string;
    poc: string;
    revenue: "all" | "with" | "without";
    msFunding: string;
    bucket: string;
    useCases: string;
    proposal: string;
    currentStatus: string;
    stage: string;
  }>({
    account: "", poc: "", revenue: "all", msFunding: "all",
    bucket: "all", useCases: "all", proposal: "all", currentStatus: "", stage: "all",
  });

  const [recentOnly, setRecentOnly] = useState(false);

  const rows = (data ?? []) as AtoOppRow[];

  const uniq = (vals: (string | null | undefined)[]) =>
    Array.from(new Set(vals.map((v) => (v ?? "").trim()).filter(Boolean))).sort();
  const msFundingOpts = useMemo(() => uniq(rows.map((r) => r.ms_funding_status)), [rows]);
  const bucketOpts = useMemo(() => uniq(rows.map((r) => r.bucket)), [rows]);
  const useCasesOpts = useMemo(() => uniq(rows.map((r) => r.use_cases_status)), [rows]);
  const proposalOpts = useMemo(() => uniq(rows.map((r) => r.proposal_status)), [rows]);
  const stageOpts = useMemo(() => uniq(rows.map((r) => r.stage)), [rows]);

  const hasRevenue = (r: AtoOppRow) =>
    (r.est_revenue_text ?? "").trim().length > 0 || (r.funding_anticipated_amount ?? 0) > 0;

  const weekAgo = useMemo(() => Date.now() - 7 * 24 * 60 * 60 * 1000, []);
  const isRecent = (r: AtoOppRow) => {
    const t = r.updated_at ? new Date(r.updated_at).getTime() : 0;
    return t >= weekAgo;
  };

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (colFilters.account && !(r.accounts?.account_name ?? "").toLowerCase().includes(colFilters.account.toLowerCase())) return false;
      const poc = (r.poc_name ?? r.accounts?.account_manager_name ?? "").toLowerCase();
      if (colFilters.poc && !poc.includes(colFilters.poc.toLowerCase())) return false;
      if (colFilters.revenue === "with" && !hasRevenue(r)) return false;
      if (colFilters.revenue === "without" && hasRevenue(r)) return false;
      if (colFilters.msFunding !== "all" && (r.ms_funding_status ?? "") !== colFilters.msFunding) return false;
      if (colFilters.bucket !== "all" && (r.bucket ?? "") !== colFilters.bucket) return false;
      if (colFilters.useCases !== "all" && (r.use_cases_status ?? "") !== colFilters.useCases) return false;
      if (colFilters.proposal !== "all" && (r.proposal_status ?? "") !== colFilters.proposal) return false;
      if (colFilters.currentStatus && !(r.current_status ?? "").toLowerCase().includes(colFilters.currentStatus.toLowerCase())) return false;
      if (colFilters.stage !== "all" && r.stage !== colFilters.stage) return false;
      if (recentOnly && !isRecent(r)) return false;
      return true;
    });
  }, [rows, colFilters, recentOnly, weekAgo]);

  const accountsCount = new Set(filteredRows.map((r) => r.account_id)).size;
  const withRevenueCount = filteredRows.filter(hasRevenue).length;
  const recentCount = useMemo(() => rows.filter(isRecent).length, [rows, weekAgo]);

  const withRev = filteredRows.filter(hasRevenue);
  const without = filteredRows.filter((r) => !hasRevenue(r));

  const anyFilterActive =
    !!colFilters.account || !!colFilters.poc || colFilters.revenue !== "all" ||
    colFilters.msFunding !== "all" || colFilters.bucket !== "all" ||
    colFilters.useCases !== "all" || colFilters.proposal !== "all" || !!colFilters.currentStatus ||
    colFilters.stage !== "all" || recentOnly;

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete opportunity for ${name}? This cannot be undone.`)) return;
    try {
      await deleteAtoOpportunity(id);
      qc.invalidateQueries({ queryKey: ["ato-opportunities"] });
      toast.success("Opportunity deleted");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleExport = () => {
    const exportRows = filteredRows.map((r) => ({
      Account: r.accounts?.account_name ?? "",
      "Opportunity Name": r.opportunity_name ?? "",
      Stage: r.stage,
      POC: r.poc_name ?? r.accounts?.account_manager_name ?? "",
      "Est. Revenue": r.est_revenue_text ?? "",
      "MS Funding": r.ms_funding_status ?? "",
      Bucket: r.bucket ?? "",
      "Use Cases": r.use_cases_status ?? "",
      Proposal: r.proposal_status ?? "",
      "Current Status": r.current_status ?? "",
      "Funding Anticipated": r.funding_anticipated_amount != null ? Number(r.funding_anticipated_amount) : null,
      Region: r.accounts?.region ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ATO Opportunities");
    XLSX.writeFile(wb, `ato-opportunities-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`Exported ${exportRows.length} opportunities`);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">ATO Opportunities</h1>
          <p className="text-sm text-muted-foreground">Non-workshop ATO opportunity tracking.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}><Download className="h-4 w-4 mr-1" /> Export Excel</Button>
          <Button onClick={() => setOpenNew(true)}><Plus className="h-4 w-4 mr-1" /> New Opportunity</Button>
        </div>
      </div>

      {!isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Briefcase className="h-3.5 w-3.5" />Total Opportunities</div>
            <div className="text-2xl font-semibold mt-1 tabular-nums">{filteredRows.length}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><DollarSign className="h-3.5 w-3.5" />Funding Anticipated</div>
            <div className="text-2xl font-semibold mt-1 tabular-nums">
              ${filteredRows.reduce((sum, r) => sum + Number(r.funding_anticipated_amount ?? 0), 0).toLocaleString()}
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Briefcase className="h-3.5 w-3.5" />Accounts</div>
            <div className="text-2xl font-semibold mt-1 tabular-nums">{accountsCount}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><DollarSign className="h-3.5 w-3.5" />With Revenue</div>
            <div className="text-2xl font-semibold mt-1 tabular-nums">{withRevenueCount}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertCircle className="h-3.5 w-3.5" />Blockers</div>
            <div className="text-2xl font-semibold mt-1 tabular-nums">
              {filteredRows.filter((r) => r.technical_blocker || r.personnel_blocker).length}
            </div>
          </Card>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold">Opportunity Pipeline</h2>
          <p className="text-xs text-muted-foreground">Detailed tracking through qualification, proposal, and SOW. <span className="inline-flex items-center gap-1 ml-1"><span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> = updated in last 7 days.</span></p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-background tabular-nums">{accountsCount} accounts</Badge>
          <Badge variant="outline" className="bg-background tabular-nums">{withRevenueCount} with revenue</Badge>
          <Button
            variant={recentOnly ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => setRecentOnly((v) => !v)}
          >
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${recentOnly ? "bg-background" : "bg-emerald-500"}`} />
            Updated this week ({recentCount})
          </Button>
          <Select value={colFilters.stage} onValueChange={(v) => setColFilters({ ...colFilters, stage: v })}>
            <SelectTrigger className="h-7 text-xs w-36"><SelectValue placeholder="Stage" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {stageOpts.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          {anyFilterActive && (
            <Button variant="ghost" size="sm" className="h-7 text-xs"
              onClick={() => { setColFilters({ account: "", poc: "", revenue: "all", msFunding: "all", bucket: "all", useCases: "all", proposal: "all", currentStatus: "", stage: "all" }); setRecentOnly(false); }}>
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : (
        <Card className="overflow-hidden">
          <div className={`${POST_GRID} px-4 py-2.5 bg-foreground text-background text-[11px] uppercase tracking-wide font-medium`}>
            <div>Account</div>
            <div>POC</div>
            <div>Est. Revenue</div>
            <div>MS Funding</div>
            <div>Bucket</div>
            <div>Use Cases</div>
            <div>Proposal</div>
            <div>Current Status</div>
            <div></div>
          </div>

          <div className={`${POST_GRID} px-4 py-2 bg-secondary/40 border-b items-center`}>
            <Input placeholder="Filter..." value={colFilters.account} onChange={(e) => setColFilters({ ...colFilters, account: e.target.value })} className="h-7 text-xs" />
            <Input placeholder="Filter..." value={colFilters.poc} onChange={(e) => setColFilters({ ...colFilters, poc: e.target.value })} className="h-7 text-xs" />
            <Select value={colFilters.revenue} onValueChange={(v) => setColFilters({ ...colFilters, revenue: v as "all" | "with" | "without" })}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="with">With revenue</SelectItem><SelectItem value="without">Without</SelectItem></SelectContent>
            </Select>
            <Select value={colFilters.msFunding} onValueChange={(v) => setColFilters({ ...colFilters, msFunding: v })}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All</SelectItem>{msFundingOpts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={colFilters.bucket} onValueChange={(v) => setColFilters({ ...colFilters, bucket: v })}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All</SelectItem>{bucketOpts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={colFilters.useCases} onValueChange={(v) => setColFilters({ ...colFilters, useCases: v })}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All</SelectItem>{useCasesOpts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={colFilters.proposal} onValueChange={(v) => setColFilters({ ...colFilters, proposal: v })}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All</SelectItem>{proposalOpts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Filter..." value={colFilters.currentStatus} onChange={(e) => setColFilters({ ...colFilters, currentStatus: e.target.value })} className="h-7 text-xs" />
            <div />
          </div>

          {withRev.length > 0 && (
            <div className="px-4 py-1.5 bg-secondary/60 text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
              With estimated revenue
            </div>
          )}
          {withRev.map((r, i) => (
            <OppRow key={r.id} r={r} idx={i} expanded={!!expanded[r.id]}
              onToggle={() => setExpanded({ ...expanded, [r.id]: !expanded[r.id] })}
              onDelete={() => handleDelete(r.id, r.accounts?.account_name ?? "this opportunity")} />
          ))}

          {without.length > 0 && (
            <div className="px-4 py-1.5 bg-secondary/60 text-[10px] uppercase tracking-wide font-semibold text-muted-foreground border-t">
              Other
            </div>
          )}
          {without.map((r, i) => (
            <OppRow key={r.id} r={r} idx={i + withRev.length} expanded={!!expanded[r.id]}
              onToggle={() => setExpanded({ ...expanded, [r.id]: !expanded[r.id] })}
              onDelete={() => handleDelete(r.id, r.accounts?.account_name ?? "this opportunity")} />
          ))}

          {filteredRows.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">No ATO opportunities match the current filters.</div>
          )}
        </Card>
      )}

      <NewAtoOpportunityDialog open={openNew} onOpenChange={setOpenNew} onCreated={() => qc.invalidateQueries({ queryKey: ["ato-opportunities"] })} />
    </div>
  );
}

function OppRow({ r, idx, expanded, onToggle, onDelete }: { r: AtoOppRow; idx: number; expanded: boolean; onToggle: () => void; onDelete: () => void }) {
  return (
    <div className={`border-t border-l-4 ${rowBorderColor(idx)} bg-background`}>
      <button
        onClick={onToggle}
        className={`w-full text-left ${POST_GRID} px-4 py-3 items-start hover:bg-secondary/40 transition-colors`}
      >
        <div className="font-medium text-sm flex items-start gap-1.5">
          {(() => {
            const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
            const t = r.updated_at ? new Date(r.updated_at).getTime() : 0;
            if (t < weekAgo) return null;
            const days = Math.max(0, Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000)));
            return <span className="mt-1 inline-block h-2 w-2 rounded-full bg-emerald-500 shrink-0" title={`Updated ${days === 0 ? "today" : `${days}d ago`}`} />;
          })()}
          <div>
            <Link to="/ato-opportunities/$id" params={{ id: r.id }} className="hover:underline" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
              {r.accounts?.account_name ?? "—"}
            </Link>
            {r.opportunity_name && <div className="text-[10px] text-muted-foreground font-normal">{r.opportunity_name}</div>}
            <Badge variant="outline" className={`text-[10px] mt-0.5 ${stageBadgeClass(r.stage)}`}>{r.stage}</Badge>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">{r.poc_name ?? r.accounts?.account_manager_name ?? "—"}</div>
        <div className="text-sm tabular-nums">
          {r.est_revenue_url ? (
            <a href={r.est_revenue_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
              {r.est_revenue_text} <span className="text-[10px]">↗ SF</span>
            </a>
          ) : (
            r.est_revenue_text ?? (r.funding_anticipated_amount ? `$${Number(r.funding_anticipated_amount).toLocaleString()}` : "—")
          )}
        </div>
        <div className="text-sm text-muted-foreground">{r.ms_funding_status ?? "—"}</div>
        <div className="text-sm text-muted-foreground">{r.bucket ?? "—"}</div>
        <div>
          {r.use_cases_status ? (
            <Badge variant="outline" className={`text-[10px] ${statusBadgeClass(r.use_cases_status)}`}>{r.use_cases_status}</Badge>
          ) : <span className="text-muted-foreground text-sm">—</span>}
        </div>
        <div>
          {r.proposal_status ? (
            <Badge variant="outline" className={`text-[10px] ${statusBadgeClass(r.proposal_status)}`}>{r.proposal_status}</Badge>
          ) : <span className="text-muted-foreground text-sm">—</span>}
        </div>
        <div className="text-sm text-muted-foreground">{r.current_status ?? "—"}</div>
        <div className="text-muted-foreground pt-0.5">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 bg-secondary/20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <div>
              <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-1">Description</div>
              <div className="text-sm whitespace-pre-wrap">{r.description ?? <span className="text-muted-foreground">—</span>}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-1">Opportunities</div>
              <div className="flex flex-wrap gap-1.5">
                {(() => {
                  const opps = r.opportunities ?? [];
                  if (opps.length === 0) return <span className="text-muted-foreground text-sm">—</span>;
                  return opps.map((o, i) => {
                    const label = `${o.name}${o.value ? ` ${o.value}` : ""}`;
                    return o.url ? (
                      <a key={i} href={o.url} target="_blank" rel="noopener noreferrer" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <Badge variant="outline" className="bg-background text-xs hover:bg-secondary cursor-pointer">
                          {label} <span className="ml-1 text-[10px] text-primary">↗ SF</span>
                        </Badge>
                      </a>
                    ) : (
                      <Badge key={i} variant="outline" className="bg-background text-xs">{label}</Badge>
                    );
                  });
                })()}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-1">Dependency / Risks</div>
              <div className="text-sm whitespace-pre-wrap text-destructive/90">{r.dependency_risks ?? <span className="text-muted-foreground">—</span>}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-1">Next Steps</div>
              <div className="text-sm whitespace-pre-wrap">{r.next_steps ?? <span className="text-muted-foreground">—</span>}</div>
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive h-7 text-xs"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
