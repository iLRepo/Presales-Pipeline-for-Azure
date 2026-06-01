import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getTasks, createTask, updateTask, getWorkshops } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { ROLES, TASK_STATUSES, fmtDate } from "@/lib/constants";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/tasks")({ component: TasksPage });

function TasksPage() {
  const qc = useQueryClient();
  const [role, setRole] = useState<string>("all");
  const [status, setStatus] = useState<string>("Open");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [assignedRole, setAssignedRole] = useState<string>("ATO Admin");
  const [workshopId, setWorkshopId] = useState<string>("none");
  const [dueDate, setDueDate] = useState<string>("");
  const [workshops, setWorkshops] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    getWorkshops().then((data) => {
      setWorkshops((data ?? []).map((w: any) => ({ id: w.id, label: w.accounts?.account_name ?? w.id.slice(0, 8) })));
    });
  }, [open]);

  const doCreateTask = async () => {
    if (!title.trim()) { toast.error("Title required"); return; }
    try {
      await createTask({ title: title.trim(), assigned_role: assignedRole, related_workshop_id: workshopId === "none" ? null : workshopId, due_date: dueDate || null });
      toast.success("Task created"); setOpen(false); setTitle(""); setDueDate(""); setWorkshopId("none"); setAssignedRole("ATO Admin");
      qc.invalidateQueries({ queryKey: ["tasks"] });
    } catch (e: any) { toast.error(e.message); }
  };

  const { data } = useQuery({
    queryKey: ["tasks", role, status],
    queryFn: () => getTasks({ role: role !== "all" ? role : undefined, status: status !== "all" ? status : undefined }),
  });

  const update = async (id: string, patch: any) => {
    try { await updateTask(id, patch); qc.invalidateQueries({ queryKey: ["tasks"] }); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-semibold tracking-tight">Tasks</h1><p className="text-sm text-muted-foreground">Internal tasks across roles. Auto-created on key stage changes.</p></div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> New Task</Button>
      </div>
      <div className="flex gap-2">
        <Select value={role} onValueChange={setRole}><SelectTrigger className="w-48"><SelectValue placeholder="Role" /></SelectTrigger><SelectContent><SelectItem value="all">All roles</SelectItem>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
      </div>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Role</TableHead><TableHead>Workshop</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {(data ?? []).map((t: any) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.title}</TableCell>
                <TableCell><Badge variant="outline">{t.assigned_role}</Badge></TableCell>
                <TableCell>{t.workshops ? <Link to="/workshops/$id" params={{ id: t.workshops.id }} className="text-primary hover:underline">{t.workshops.accounts?.account_name}</Link> : "—"}</TableCell>
                <TableCell>{fmtDate(t.due_date)}</TableCell>
                <TableCell><Select value={t.status} onValueChange={(v) => update(t.id, { status: v })}><SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger><SelectContent>{TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></TableCell>
              </TableRow>
            ))}
            {(data ?? []).length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No tasks match.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Task</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div><Label>Assigned role</Label><Select value={assignedRole} onValueChange={setAssignedRole}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Related workshop</Label><Select value={workshopId} onValueChange={setWorkshopId}><SelectTrigger><SelectValue placeholder="None" /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{workshops.map((w) => <SelectItem key={w.id} value={w.id}>{w.label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Due date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={doCreateTask}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
