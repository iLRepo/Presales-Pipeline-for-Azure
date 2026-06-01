export const STAGES = [
  "Identified",
  "Proposed",
  "Planning",
  "Scheduled",
  "Delivered",
  "Follow-up",
  "Conversion",
  "SOW Submitted",
  "SOW Signed",
] as const;
export type Stage = typeof STAGES[number];

export const WORKSHOP_TYPES = ["101", "201", "301"] as const;
export type WorkshopType = typeof WORKSHOP_TYPES[number];
export const WORKSHOP_TYPE_LABEL = "Envisioning Part";

export const ELIGIBILITY = ["Unknown", "Eligible", "Not Eligible"] as const;
export type Eligibility = typeof ELIGIBILITY[number];

export const SOW_STATUSES = ["Draft", "Submitted", "In Iteration", "Signed"] as const;
export type SowStatus = typeof SOW_STATUSES[number];

export const ACTION_OWNERS = ["ATO", "Client", "Account Manager", "Alliance", "Other"] as const;

export const TASK_STATUSES = ["Open", "In Progress", "Done"] as const;
export const ROLES = ["ATO Admin", "Account Manager", "Alliance Team"] as const;

export function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

export function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
export function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function eligibilityBadgeClass(e: string) {
  if (e === "Eligible") return "bg-success/15 text-success border-success/30";
  if (e === "Not Eligible") return "bg-destructive/10 text-destructive border-destructive/30";
  return "bg-muted text-muted-foreground border-border";
}

export function stageColor(s: string) {
  const map: Record<string, string> = {
    "Identified": "border-l-slate-400",
    "Proposed": "border-l-blue-500",
    "Planning": "border-l-indigo-500",
    "Scheduled": "border-l-violet-500",
    "Delivered": "border-l-teal-500",
    "Follow-up": "border-l-amber-500",
    "Conversion": "border-l-orange-500",
    "SOW Submitted": "border-l-rose-500",
    "SOW Signed": "border-l-green-600",
  };
  return map[s] ?? "border-l-slate-400";
}
