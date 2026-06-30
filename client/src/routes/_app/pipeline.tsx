import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getWorkshops, updateWorkshop, deleteWorkshop } from "@/lib/api";
import { STAGES, ELIGIBILITY, type Stage, daysSince, eligibilityBadgeClass, stageColor, fmtDateTime } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, AlertTriangle, FileText, Flag, DollarSign, Briefcase, AlertCircle, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { NewWorkshopDialog } from "@/components/dialogs/NewWorkshopDialog";

export const Route = createFileRoute("/_app/pipeline")({ component: PipelinePage });

type WorkshopRow = {
  id: string;
  account_id: string;
  stage: Stage;
  stage_last_updated_at: string;
  updated_at: string;
  planned_date_time: string | null;
  ato_owner: string;
  eligibility_status: string;
  funding_anticipated_amount: number | null;
  technical_blocker: boolean;
  personnel_blocker: boolean;
  poc_name: string | null;
  est_revenue_text: string | null;
  est_revenue_url: string | null;
  ms_funding_status: string | null;
  bucket: string | null;
  use_cases_status: string | null;
  proposal_status: string | null;
  current_status: string | null;
  workshop_details: string | null;
  dependency_risks: string | null;
  next_steps: string | null;
  opportunities: { name: string; value?: string; url?: string }[] | null;
  accounts: { account_name: string; account_manager_name: string | null; region: string | null } | null;
  sows: { id: string; value: number | null; afo_revenue: number | null }[];
  tasks: { id: string; status: string }[];
};

function PipelinePage() {
  const qc = useQueryClient();
  const [filterElig, setFilterElig] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [tab, setTab] = useState<"pre" | "post">("pre");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const PRE_STAGES: Stage[] = ["Identified", "Proposed", "Planning", "Scheduled", "Delivered"];
  const POST_STAGES: Stage[] = ["Follow-up", "Conversion", "SOW Submitted", "SOW Signed"];
  const activeStages = tab === "pre" ? PRE_STAGES : POST_STAGES;

  const { data, isLoading } = useQuery({
    queryKey: ["workshops-pipeline"],
    queryFn: () => getWorkshops("pipeline"),
  });

  const move = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: Stage }) => {
      await updateWorkshop(id, { stage });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workshops-pipeline"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Stage updated");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      await deleteWorkshop(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workshops-pipeline"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Workshop deleted");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const filtered = useMemo(() => {
    return (data ?? []).filter((w: WorkshopRow) => {
      if (filterElig !== "all" && w.eligibility_status !== filterElig) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!(w.accounts?.account_name ?? "").toLowerCase().includes(s) &&
            !(w.accounts?.account_manager_name ?? "").toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [data, filterElig, search]);

  const grouped = useMemo(() => {
    const g: Record<string, WorkshopRow[]> = {};
    STAGES.forEach((s) => (g[s] = []));
    filtered.forEach((w: WorkshopRow) => g[w.stage]?.push(w));
    return g;
  }, [filtered]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
          <p className="text-sm text-muted-foreground">Drag cards between stages or use the dropdown.</p>
        </div>
        <Button onClick={() => setOpenNew(true)}><Plus className="h-4 w-4 mr-1" /> New Workshop</Button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Input placeholder="Search account or AM…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
        <Select value={filterElig} onValueChange={setFilterElig}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Eligibility" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All eligibility</SelectItem>
            {ELIGIBILITY.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {!isLoading && (
        tab === "pre" ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Briefcase className="h-3.5 w-3.5" />Total Workshops
              </div>
              <div className="text-2xl font-semibold mt-1 tabular-nums">{filtered.length}</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <DollarSign className="h-3.5 w-3.5" />Funding Anticipated
              </div>
              <div className="text-2xl font-semibold mt-1 tabular-nums">
                ${filtered.reduce((sum: number, w: WorkshopRow) => sum + Number(w.funding_anticipated_amount ?? 0), 0).toLocaleString()}
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Briefcase className="h-3.5 w-3.5" />In Pipeline
              </div>
              <div className="text-2xl font-semibold mt-1 tabular-nums">
                {filtered.filter((w: WorkshopRow) => ["Identified", "Proposed", "Planning", "Scheduled"].includes(w.stage)).length}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Identified – Scheduled</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Briefcase className="h-3.5 w-3.5" />Completed
              </div>
              <div className="text-2xl font-semibold mt-1 tabular-nums">
                {filtered.filter((w: WorkshopRow) => ["Delivered", "Follow-up", "Conversion", "SOW Submitted", "SOW Signed"].includes(w.stage)).length}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Delivered – SOW Signed</div>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Briefcase className="h-3.5 w-3.5" />Total Workshops
              </div>
              <div className="text-2xl font-semibold mt-1 tabular-nums">{filtered.length}</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <DollarSign className="h-3.5 w-3.5" />Funding Anticipated
              </div>
              <div className="text-2xl font-semibold mt-1 tabular-nums">
                ${filtered.reduce((sum: number, w: WorkshopRow) => sum + Number(w.funding_anticipated_amount ?? 0), 0).toLocaleString()}
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <DollarSign className="h-3.5 w-3.5" />AFO Revenue
              </div>
              <div className="text-2xl font-semibold mt-1 tabular-nums">
                ${filtered.reduce((sum: number, w: WorkshopRow) => sum + w.sows.reduce((s: number, sow: any) => s + Number(sow.afo_revenue ?? 0), 0), 0).toLocaleString()}
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />SOWs
              </div>
              <div className="text-2xl font-semibold mt-1 tabular-nums">{filtered.reduce((sum: number, w: WorkshopRow) => sum + w.sows.length, 0)}</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertCircle className="h-3.5 w-3.5" />Blockers
              </div>
              <div className="text-2xl font-semibold mt-1 tabular-nums">
                {filtered.filter((w: WorkshopRow) => w.technical_blocker || w.personnel_blocker).length}
              </div>
            </Card>
          </div>
        )
      )}

      {isLoading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as "pre" | "post")}>
          <TabsList className="mb-4">
            <TabsTrigger value="pre">Pre Workshop</TabsTrigger>
            <TabsTrigger value="post">Post Workshop</TabsTrigger>
          </TabsList>
          <TabsContent value="pre" className="mt-0">
            <div className="flex w-max min-w-full gap-3 pb-4">
              {PRE_STAGES.map((stage) => (
                <div
                  key={stage}
                  className="flex-shrink-0 w-72 bg-secondary/40 rounded-lg p-3 min-h-[60vh]"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragId) {
                      const cur = filtered.find((w: WorkshopRow) => w.id === dragId);
                      if (cur && cur.stage !== stage) move.mutate({ id: dragId, stage });
                      setDragId(null);
                    }
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-semibold text-sm">{stage}</div>
                    <Badge variant="outline" className="bg-background">{grouped[stage].length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {grouped[stage].map((w: WorkshopRow) => {
                      const days = daysSince(w.stage_last_updated_at);
                      const stuck = days >= 7;
                      return (
                        <Card
                          key={w.id}
                          draggable
                          onDragStart={() => setDragId(w.id)}
                          className={`p-3 border-l-4 ${stageColor(stage)} cursor-grab hover:shadow-md transition-shadow`}
                        >
                          <Link to="/workshops/$id" params={{ id: w.id }} className="block">
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-medium text-sm leading-snug">{w.accounts?.account_name ?? "—"}</div>
                              <div className="flex items-center gap-1 shrink-0">
                                {w.technical_blocker && (
                                  <Flag className="h-3.5 w-3.5 text-destructive fill-destructive" aria-label="Technical blocker" />
                                )}
                                {w.personnel_blocker && (
                                  <Flag className="h-3.5 w-3.5 text-warning fill-warning" aria-label="Personnel blocker" />
                                )}
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">{w.accounts?.account_manager_name ?? "—"}</div>
                            <div className="text-xs text-muted-foreground mt-1">{fmtDateTime(w.planned_date_time)}</div>
                            <div className="flex items-center gap-1 mt-2 flex-wrap">
                              {w.sows.length > 0 && (() => {
                                const total = w.sows.reduce((sum: number, s: any) => sum + (Number(s.value) || 0), 0);
                                return (
                                  <Badge variant="outline" className="text-[10px] tabular-nums bg-emerald-500/10 text-emerald-700 border-emerald-500/30" title={`${w.sows.length} SOW · total value`}>
                                    <FileText className="h-2.5 w-2.5 mr-0.5" />{w.sows.length} · ${total.toLocaleString()}
                                  </Badge>
                                );
                              })()}
                              {(() => {
                                const afo = w.sows.reduce((sum: number, s: any) => sum + (Number(s.afo_revenue) || 0), 0);
                                if (afo <= 0) return null;
                                return (
                                  <Badge variant="outline" className="text-[10px] tabular-nums bg-blue-500/10 text-blue-700 border-blue-500/30" title="AFO applied">
                                    AFO: ${afo.toLocaleString()}
                                  </Badge>
                                );
                              })()}
                              {w.funding_anticipated_amount != null && Number(w.funding_anticipated_amount) > 0 && (
                                <Badge variant="outline" className="text-[10px] tabular-nums bg-purple-500/10 text-purple-700 border-purple-500/30" title="Funding applied">
                                  Funding: ${Number(w.funding_anticipated_amount).toLocaleString()}
                                </Badge>
                              )}
                              {stuck && (
                                <Badge variant="outline" className="text-[10px] bg-warning/15 text-warning-foreground border-warning/40">
                                  <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />{days}d
                                </Badge>
                              )}
                            </div>
                          </Link>
                          <div className="flex gap-1 mt-2">
                            <Select value={stage} onValueChange={(v) => move.mutate({ id: w.id, stage: v as Stage })}>
                              <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                              <SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                              title="Delete workshop"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (confirm(`Delete workshop for ${w.accounts?.account_name ?? "this account"}? This cannot be undone.`)) {
                                  del.mutate(w.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="post" className="mt-0">
            <PostWorkshopTable
              rows={filtered.filter((w: WorkshopRow) => POST_STAGES.includes(w.stage))}
              expanded={expanded}
              setExpanded={setExpanded}
            />
          </TabsContent>
        </Tabs>
      )}

      <NewWorkshopDialog open={openNew} onOpenChange={setOpenNew} onCreated={() => qc.invalidateQueries({ queryKey: ["workshops-pipeline"] })} />
    </div>
  );
}

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
    "border-l-violet-400",
    "border-l-amber-400",
    "border-l-emerald-400",
    "border-l-rose-400",
    "border-l-sky-400",
    "border-l-orange-400",
    "border-l-pink-400",
    "border-l-teal-400",
  ];
  return palette[idx % palette.length];
}

const POST_GRID = "grid grid-cols-[1.2fr_1fr_1fr_1.2fr_1fr_0.7fr_0.9fr_2fr_28px] gap-3";

function PostWorkshopTable({
  rows,
  expanded,
  setExpanded,
}: {
  rows: WorkshopRow[];
  expanded: Record<string, boolean>;
  setExpanded: (v: Record<string, boolean>) => void;
}) {
  const [colFilters, setColFilters] = useState<{
    account: string;
    poc: string;
    revenue: "all" | "with" | "without";
    msFunding: string;
    bucket: string;
    useCases: string;
    proposal: string;
    currentStatus: string;
  }>({
    account: "",
    poc: "",
    revenue: "all",
    msFunding: "all",
    bucket: "all",
    useCases: "all",
    proposal: "all",
    currentStatus: "",
  });

  const uniq = (vals: (string | null | undefined)[]) =>
    Array.from(new Set(vals.map((v) => (v ?? "").trim()).filter(Boolean))).sort();
  const msFundingOpts = useMemo(() => uniq(rows.map((r) => r.ms_funding_status)), [rows]);
  const bucketOpts = useMemo(() => uniq(rows.map((r) => r.bucket)), [rows]);
  const useCasesOpts = useMemo(() => uniq(rows.map((r) => r.use_cases_status)), [rows]);
  const proposalOpts = useMemo(() => uniq(rows.map((r) => r.proposal_status)), [rows]);

  const [recentOnly, setRecentOnly] = useState(false);

  const hasRevenue = (r: WorkshopRow) =>
    (r.est_revenue_text ?? "").trim().length > 0 || (r.funding_anticipated_amount ?? 0) > 0;

  const weekAgo = useMemo(() => Date.now() - 7 * 24 * 60 * 60 * 1000, []);
  const isRecent = (r: WorkshopRow) => {
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
    recentOnly;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold">Post-workshop pipeline</h2>
          <p className="text-xs text-muted-foreground">Detailed account tracking through follow-up, conversion, and SOW. <span className="inline-flex items-center gap-1 ml-1"><span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> = updated in last 7 days.</span></p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-background tabular-nums">{accountsCount} accounts</Badge>
          <Badge variant="outline" className="bg-background tabular-nums">{withRevenueCount} with revenue</Badge>
          <Button
            variant={recentOnly ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => setRecentOnly((v) => !v)}
            title="Show only workshops updated in the past 7 days"
          >
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${recentOnly ? "bg-background" : "bg-emerald-500"}`} />
            Updated this week ({recentCount})
          </Button>
          {anyFilterActive && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => { setColFilters({ account: "", poc: "", revenue: "all", msFunding: "all", bucket: "all", useCases: "all", proposal: "all", currentStatus: "" }); setRecentOnly(false); }}
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>

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
          <Input
            placeholder="Filter…"
            value={colFilters.account}
            onChange={(e) => setColFilters({ ...colFilters, account: e.target.value })}
            className="h-7 text-xs"
          />
          <Input
            placeholder="Filter…"
            value={colFilters.poc}
            onChange={(e) => setColFilters({ ...colFilters, poc: e.target.value })}
            className="h-7 text-xs"
          />
          <Select value={colFilters.revenue} onValueChange={(v) => setColFilters({ ...colFilters, revenue: v as "all" | "with" | "without" })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="with">With revenue</SelectItem>
              <SelectItem value="without">Without</SelectItem>
            </SelectContent>
          </Select>
          <Select value={colFilters.msFunding} onValueChange={(v) => setColFilters({ ...colFilters, msFunding: v })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {msFundingOpts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={colFilters.bucket} onValueChange={(v) => setColFilters({ ...colFilters, bucket: v })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {bucketOpts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={colFilters.useCases} onValueChange={(v) => setColFilters({ ...colFilters, useCases: v })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {useCasesOpts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={colFilters.proposal} onValueChange={(v) => setColFilters({ ...colFilters, proposal: v })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {proposalOpts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            placeholder="Filter…"
            value={colFilters.currentStatus}
            onChange={(e) => setColFilters({ ...colFilters, currentStatus: e.target.value })}
            className="h-7 text-xs"
          />
          <div />
        </div>

        {withRev.length > 0 && (
          <div className="px-4 py-1.5 bg-secondary/60 text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
            With estimated revenue
          </div>
        )}
        {withRev.map((w, i) => (
          <PostRow key={w.id} w={w} idx={i} expanded={!!expanded[w.id]} onToggle={() => setExpanded({ ...expanded, [w.id]: !expanded[w.id] })} />
        ))}

        {without.length > 0 && (
          <div className="px-4 py-1.5 bg-secondary/60 text-[10px] uppercase tracking-wide font-semibold text-muted-foreground border-t">
            Other
          </div>
        )}
        {without.map((w, i) => (
          <PostRow key={w.id} w={w} idx={i + withRev.length} expanded={!!expanded[w.id]} onToggle={() => setExpanded({ ...expanded, [w.id]: !expanded[w.id] })} />
        ))}

        {filteredRows.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">No post-workshop accounts match the current filters.</div>
        )}
      </Card>
    </div>
  );
}

function PostRow({ w, idx, expanded, onToggle }: { w: WorkshopRow; idx: number; expanded: boolean; onToggle: () => void }) {
  return (
    <div className={`border-t border-l-4 ${rowBorderColor(idx)} bg-background`}>
      <button
        onClick={onToggle}
        className="w-full text-left grid grid-cols-[1.2fr_1fr_1fr_1.2fr_1fr_0.7fr_0.9fr_2fr_28px] gap-3 px-4 py-3 items-start hover:bg-secondary/40 transition-colors"
      >
        <div className="font-medium text-sm flex items-start gap-1.5">
          {(() => {
            const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
            const t = w.updated_at ? new Date(w.updated_at).getTime() : 0;
            if (t < weekAgo) return null;
            const days = Math.max(0, Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000)));
            return (
              <span
                className="mt-1 inline-block h-2 w-2 rounded-full bg-emerald-500 shrink-0"
                title={`Updated ${days === 0 ? "today" : `${days}d ago`}`}
              />
            );
          })()}
          <Link to="/workshops/$id" params={{ id: w.id }} className="hover:underline" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            {w.accounts?.account_name ?? "—"}
          </Link>
        </div>
        <div className="text-sm text-muted-foreground">{w.poc_name ?? w.accounts?.account_manager_name ?? "—"}</div>
        <div className="text-sm tabular-nums">
          {w.est_revenue_url ? (
            <a href={w.est_revenue_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
              {w.est_revenue_text} <span className="text-[10px]">↗ SF</span>
            </a>
          ) : (
            w.est_revenue_text ?? (w.funding_anticipated_amount ? `$${Number(w.funding_anticipated_amount).toLocaleString()}` : "—")
          )}
        </div>
        <div className="text-sm text-muted-foreground">{w.ms_funding_status ?? "—"}</div>
        <div className="text-sm text-muted-foreground">{w.bucket ?? "—"}</div>
        <div>
          {w.use_cases_status ? (
            <Badge variant="outline" className={`text-[10px] ${statusBadgeClass(w.use_cases_status)}`}>{w.use_cases_status}</Badge>
          ) : <span className="text-muted-foreground text-sm">—</span>}
        </div>
        <div>
          {w.proposal_status ? (
            <Badge variant="outline" className={`text-[10px] ${statusBadgeClass(w.proposal_status)}`}>{w.proposal_status}</Badge>
          ) : <span className="text-muted-foreground text-sm">—</span>}
        </div>
        <div className="text-sm text-muted-foreground">{w.current_status ?? "—"}</div>
        <div className="text-muted-foreground pt-0.5">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 bg-secondary/20">
          <div>
            <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-1">Workshop Details</div>
            <div className="text-sm whitespace-pre-wrap">{w.workshop_details ?? <span className="text-muted-foreground">—</span>}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-1">Opportunity</div>
            <div className="flex flex-wrap gap-1.5">
              {(() => {
                const o = (w.opportunities ?? [])[0];
                if (!o) return <span className="text-muted-foreground text-sm">—</span>;
                const label = `${o.name}${o.value ? ` ${o.value}` : ""}`;
                return o.url ? (
                  <a href={o.url} target="_blank" rel="noopener noreferrer">
                    <Badge variant="outline" className="bg-background text-xs hover:bg-secondary cursor-pointer">
                      {label} <span className="ml-1 text-[10px] text-primary">↗ SF</span>
                    </Badge>
                  </a>
                ) : (
                  <Badge variant="outline" className="bg-background text-xs">{label}</Badge>
                );
              })()}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-1">Dependency / Risks</div>
            <div className="text-sm whitespace-pre-wrap text-destructive/90">{w.dependency_risks ?? <span className="text-muted-foreground">—</span>}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-1">Next Steps</div>
            <div className="text-sm whitespace-pre-wrap">{w.next_steps ?? <span className="text-muted-foreground">—</span>}</div>
          </div>
        </div>
      )}
    </div>
  );
}
