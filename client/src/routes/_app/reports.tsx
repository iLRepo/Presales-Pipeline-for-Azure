import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getReports } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { STAGES } from "@/lib/constants";

export const Route = createFileRoute("/_app/reports")({ component: ReportsPage });

function quarterOf(iso: string) { const d = new Date(iso); return `${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}`; }

const ROLLUP_BUCKETS = [
  { label: "Identified", stages: ["Identified"] as string[] },
  { label: "Pitched", stages: ["Proposed", "Planning"] },
  { label: "Scheduled", stages: ["Scheduled"] },
  { label: "Delivered", stages: ["Delivered", "Follow-up", "Conversion"] },
  { label: "Opportunities", stages: ["SOW Submitted", "SOW Signed", "Conversion"], excludeTechnicalBlocker: true },
];
const DELIVERED_PLUS = ["Delivered", "Follow-up", "Conversion", "SOW Submitted", "SOW Signed"];

function ReportsPage() {
  const [tab, setTab] = useState<"detailed" | "rollup">("detailed");
  const { data } = useQuery({ queryKey: ["reports"], queryFn: getReports });
  const ws = (data ?? []) as any[];

  const fundingRecognized = ws.reduce((sum, w) => sum + Number(w.funding_recognized_amount ?? 0), 0);
  const fundingAnticipated = ws.reduce((sum, w) => sum + Number(w.funding_anticipated_amount ?? 0), 0);
  const quarters: Record<string, number> = {};
  ws.forEach((w) => { const ref = w.delivered_date_time || w.planned_date_time; if (!ref) return; const q = quarterOf(ref); quarters[q] = (quarters[q] ?? 0) + 1; });
  const byStage = STAGES.map((s) => ({ s, n: ws.filter((w) => w.stage === s).length }));
  const byBucket = ROLLUP_BUCKETS.map((b) => ({ label: b.label, n: ws.filter((w) => b.stages.includes(w.stage) && (!(b as any).excludeTechnicalBlocker || !w.technical_blocker)).length }));
  const estimatedRevenue = ws.filter((w) => ["SOW Submitted", "SOW Signed"].includes(w.stage) && !w.technical_blocker).reduce((sum, w) => sum + Number(w.funding_anticipated_amount ?? 0), 0);
  const deliveredPlus = ws.filter((w) => DELIVERED_PLUS.includes(w.stage));

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const qEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0, 23, 59, 59);
  const stageToBucket = (stage: string) => ROLLUP_BUCKETS.find((b) => b.stages.includes(stage))?.label;
  const movedByBucket: Record<string, number> = {};
  ws.forEach((w) => { if (!w.stage_last_updated_at || new Date(w.stage_last_updated_at) < weekAgo) return; const bucket = stageToBucket(w.stage); if (!bucket) return; movedByBucket[bucket] = (movedByBucket[bucket] ?? 0) + 1; });
  const blockersChanged = ws.filter((w) => (w.technical_blocker || w.personnel_blocker) && w.updated_at && new Date(w.updated_at) >= weekAgo).length;
  const techBlockersActive = ws.filter((w) => w.technical_blocker).length;
  const personnelBlockersActive = ws.filter((w) => w.personnel_blocker).length;
  const scheduledThisQuarter = ws.filter((w) => { if (!w.planned_date_time) return false; const d = new Date(w.planned_date_time); return d >= now && d <= qEnd; }).length;

  const regionCounts: Record<string, number> = {};
  deliveredPlus.forEach((w) => { const r = w.region || "Unknown"; regionCounts[r] = (regionCounts[r] ?? 0) + 1; });
  const byRegion = Object.entries(regionCounts).sort(([a], [b]) => a.localeCompare(b));
  const regionMax = Math.max(1, ...byRegion.map(([, n]) => n));

  const ExecutiveSummary = () => (
    <Card className="p-5">
      <h2 className="font-semibold mb-1">Executive Summary</h2>
      <p className="text-xs text-muted-foreground mb-3">Activity since {weekAgo.toLocaleDateString()} &middot; Quarter ends {qEnd.toLocaleDateString()}</p>
      <div className="space-y-2 text-sm">
        <div><div className="font-medium mb-1">Workshops that entered each rollup stage in the last week</div>
          {ROLLUP_BUCKETS.every((b) => !movedByBucket[b.label]) ? <div className="text-muted-foreground">No stage changes in the last 7 days.</div> : (
            <ul className="grid grid-cols-2 md:grid-cols-5 gap-2">{ROLLUP_BUCKETS.map((b) => <li key={b.label} className="rounded border p-2"><div className="text-xs text-muted-foreground">{b.label}</div><div className="text-lg font-semibold tabular-nums">{movedByBucket[b.label] ?? 0}</div></li>)}</ul>
          )}
        </div>
        <div className="border-t pt-2"><div className="font-medium mb-1">Blockers</div><div className="text-muted-foreground">{blockersChanged} workshop{blockersChanged === 1 ? "" : "s"} with blockers updated this week &middot; {techBlockersActive} technical &middot; {personnelBlockersActive} personnel currently active</div></div>
        <div className="border-t pt-2"><div className="font-medium mb-1">Scheduled through end of quarter</div><div className="text-muted-foreground">{scheduledThisQuarter} workshop{scheduledThisQuarter === 1 ? "" : "s"} planned between today and {qEnd.toLocaleDateString()}.</div></div>
      </div>
    </Card>
  );

  const RegionChart = () => (
    <Card className="p-5">
      <h2 className="font-semibold mb-1">By Region</h2>
      <p className="text-xs text-muted-foreground mb-3">Delivered and later stages only.</p>
      {byRegion.length === 0 ? <div className="text-sm text-muted-foreground">No delivered workshops yet.</div> : (
        <div className="space-y-1.5">{byRegion.map(([r, n]) => <div key={r} className="flex items-center gap-2 text-sm"><div className="w-32 text-muted-foreground truncate">{r}</div><div className="flex-1 bg-secondary rounded h-3 overflow-hidden"><div className="bg-primary h-full" style={{ width: `${(n / regionMax) * 100}%` }} /></div><div className="w-8 text-right tabular-nums">{n}</div></div>)}</div>
      )}
    </Card>
  );

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <div><h1 className="text-2xl font-semibold tracking-tight">Reports</h1><p className="text-sm text-muted-foreground">Snapshot counts. Detailed analytics coming with future Salesforce integration.</p></div>
      <div className="flex gap-2"><Button size="sm" variant={tab === "detailed" ? "default" : "outline"} onClick={() => setTab("detailed")}>Detailed</Button><Button size="sm" variant={tab === "rollup" ? "default" : "outline"} onClick={() => setTab("rollup")}>Rollup</Button></div>

      {tab === "detailed" ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card className="p-5"><div className="text-xs text-muted-foreground">Total Workshops</div><div className="text-3xl font-semibold mt-1">{ws.length}</div></Card>
            <Card className="p-5"><div className="text-xs text-muted-foreground">Delivered</div><div className="text-3xl font-semibold mt-1">{ws.filter((w) => DELIVERED_PLUS.includes(w.stage)).length}</div></Card>
            <Card className="p-5"><div className="text-xs text-muted-foreground">SOW Signed (stage)</div><div className="text-3xl font-semibold mt-1">{ws.filter((w) => w.stage === "SOW Signed").length}</div></Card>
          </div>
          <Card className="p-5"><h2 className="font-semibold mb-3">By Stage</h2><div className="space-y-1.5">{byStage.map(({ s, n }) => <div key={s} className="flex items-center gap-2 text-sm"><div className="w-32 text-muted-foreground">{s}</div><div className="flex-1 bg-secondary rounded h-3 overflow-hidden"><div className="bg-primary h-full" style={{ width: `${ws.length ? (n / ws.length) * 100 : 0}%` }} /></div><div className="w-8 text-right tabular-nums">{n}</div></div>)}</div></Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card className="p-5"><h2 className="font-semibold mb-3">Funding</h2><div className="flex justify-between text-sm py-1 border-b"><span>Recognized</span><span className="tabular-nums">${fundingRecognized.toLocaleString()}</span></div><div className="flex justify-between text-sm py-1"><span>Anticipated</span><span className="tabular-nums">${fundingAnticipated.toLocaleString()}</span></div></Card>
            <Card className="p-5"><h2 className="font-semibold mb-3">By Quarter</h2>{Object.keys(quarters).length === 0 ? <div className="text-sm text-muted-foreground">No date-bearing workshops yet.</div> : Object.entries(quarters).sort(([a], [b]) => a.localeCompare(b)).map(([q, n]) => <div key={q} className="flex justify-between text-sm py-1 border-b last:border-0"><span>{q}</span><span className="tabular-nums">{n}</span></div>)}</Card>
          </div>
          <RegionChart />
        </>
      ) : (
        <>
          <ExecutiveSummary />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card className="p-5"><div className="text-xs text-muted-foreground">Total Workshops</div><div className="text-3xl font-semibold mt-1">{ws.length}</div></Card>
            <Card className="p-5"><div className="text-xs text-muted-foreground">Delivered</div><div className="text-3xl font-semibold mt-1">{byBucket.find((b) => b.label === "Delivered")?.n ?? 0}</div></Card>
            <Card className="p-5"><div className="text-xs text-muted-foreground">Opportunities</div><div className="text-3xl font-semibold mt-1">{byBucket.find((b) => b.label === "Opportunities")?.n ?? 0}</div></Card>
          </div>
          <Card className="p-5"><h2 className="font-semibold mb-3">Rollup</h2><div className="grid grid-cols-2 md:grid-cols-5 gap-3">{byBucket.map(({ label, n }) => <div key={label} className="rounded border p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="text-2xl font-semibold mt-1 tabular-nums">{n}</div></div>)}</div><div className="mt-4 flex items-center justify-between border-t pt-3"><span className="text-sm text-muted-foreground">Estimated Revenue (Opportunities)</span><span className="text-xl font-semibold tabular-nums">${estimatedRevenue.toLocaleString()}</span></div></Card>
          <Card className="p-5"><h2 className="font-semibold mb-3">By Rollup Stage</h2><div className="space-y-1.5">{byBucket.map(({ label, n }) => <div key={label} className="flex items-center gap-2 text-sm"><div className="w-32 text-muted-foreground">{label}</div><div className="flex-1 bg-secondary rounded h-3 overflow-hidden"><div className="bg-primary h-full" style={{ width: `${ws.length ? (n / ws.length) * 100 : 0}%` }} /></div><div className="w-8 text-right tabular-nums">{n}</div></div>)}</div></Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card className="p-5"><h2 className="font-semibold mb-3">Funding</h2><div className="flex justify-between text-sm py-1 border-b"><span>Recognized</span><span className="tabular-nums">${fundingRecognized.toLocaleString()}</span></div><div className="flex justify-between text-sm py-1"><span>Anticipated</span><span className="tabular-nums">${fundingAnticipated.toLocaleString()}</span></div></Card>
            <Card className="p-5"><h2 className="font-semibold mb-3">By Quarter</h2>{Object.keys(quarters).length === 0 ? <div className="text-sm text-muted-foreground">No date-bearing workshops yet.</div> : Object.entries(quarters).sort(([a], [b]) => a.localeCompare(b)).map(([q, n]) => <div key={q} className="flex justify-between text-sm py-1 border-b last:border-0"><span>{q}</span><span className="tabular-nums">{n}</span></div>)}</Card>
          </div>
          <RegionChart />
        </>
      )}
      <Card className="p-4 bg-secondary/50 border-dashed text-sm text-muted-foreground">Future: Salesforce integration will replace placeholder revenue / pipeline metrics here.</Card>
    </div>
  );
}
