/**
 * TaskEditModal — reusable modal for viewing, editing, and deleting a task.
 * Used by Calendar, Dashboard, and any page that needs quick task editing.
 */
import { trpc } from "@/lib/trpc";
import { invalidateTaskDomain } from "@/lib/queryHelpers";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CalendarDays, Trash2, X } from "lucide-react";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { toast } from "sonner";

// ── Design tokens (same as Tasks.tsx) ─────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; solid: string; tint: string }> = {
  inbox:       { label: "Inbox",       solid: "oklch(0.60 0.22 300)", tint: "oklch(0.60 0.22 300 / 0.1)" },
  not_started: { label: "Not Started", solid: "oklch(0.65 0.04 255)", tint: "oklch(0.65 0.04 255 / 0.08)" },
  next_action: { label: "Next Action", solid: "oklch(0.60 0.22 200)", tint: "oklch(0.60 0.22 200 / 0.1)" },
  in_progress: { label: "In Progress", solid: "oklch(0.52 0.26 270)", tint: "oklch(0.52 0.26 270 / 0.1)" },
  waiting:     { label: "Waiting",     solid: "oklch(0.72 0.18 70)",  tint: "oklch(0.72 0.18 70  / 0.1)" },
  blocked:     { label: "Blocked",     solid: "oklch(0.62 0.22 25)",  tint: "oklch(0.62 0.22 25  / 0.1)" },
  review:      { label: "Review",      solid: "oklch(0.55 0.24 250)", tint: "oklch(0.55 0.24 250 / 0.1)" },
  done:        { label: "Done",        solid: "oklch(0.58 0.20 145)", tint: "oklch(0.58 0.20 145 / 0.1)" },
  cancelled:   { label: "Cancelled",   solid: "oklch(0.55 0.02 255)", tint: "oklch(0.55 0.02 255 / 0.08)" },
};

const PRIORITY_CONFIG: Record<string, { label: string; solid: string; tint: string }> = {
  p0: { label: "Critical", solid: "oklch(0.62 0.22 25)",  tint: "oklch(0.62 0.22 25  / 0.08)" },
  p1: { label: "High",     solid: "oklch(0.72 0.18 70)",  tint: "oklch(0.72 0.18 70  / 0.1)" },
  p2: { label: "Medium",   solid: "oklch(0.52 0.26 270)", tint: "oklch(0.52 0.26 270 / 0.08)" },
  p3: { label: "Low",      solid: "oklch(0.65 0.04 255)", tint: "oklch(0.65 0.04 255 / 0.06)" },
};

const TASK_STATUSES = Object.entries(STATUS_CONFIG).map(([value, c]) => ({ value, label: c.label }));
const PRIORITIES = Object.entries(PRIORITY_CONFIG).map(([value, c]) => ({ value, label: c.label }));

interface TaskFormData {
  name: string; description: string; projectId: string; areaId: string;
  status: string; dueDate: string; startDate: string;
  urgency: number; impact: number; effort: number; strategicAlignment: number;
  assignToday: boolean; assignee: string; tags: string;
  manualPriorityOverride: string;
}

function DatePicker({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full flex items-center gap-2 px-3 h-9 rounded-xl border border-border bg-muted/30 text-xs transition-colors hover:border-primary/50 hover:bg-muted/50 font-medium",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarDays className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <span className="flex-1 text-left">{value ? format(new Date(value + "T00:00:00"), "MMM d, yyyy") : placeholder}</span>
          {value && (
            <span
              role="button" tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onChange(""); } }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value ? new Date(value + "T00:00:00") : undefined}
          onSelect={(d) => onChange(d ? format(d, "yyyy-MM-dd") : "")}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

// ── Task type (minimal — only what Calendar passes) ───────────────────────────
export interface TaskForModal {
  id: number;
  name: string;
  description?: string | null;
  projectId?: number | null;
  areaId?: number | null;
  status: string;
  priority?: string | null;
  dueDate?: Date | string | null;
  startDate?: Date | string | null;
  urgency?: number | null;
  impact?: number | null;
  effort?: number | null;
  strategicAlignment?: number | null;
  assignToday?: boolean | null;
  assignee?: string | null;
  tags?: string | null;
  manualPriorityOverride?: string | null;
}

interface Props {
  task: TaskForModal | null;
  onClose: () => void;
  /** Called after a successful save or delete so parent can refresh */
  onSuccess?: () => void;
}

export default function TaskEditModal({ task, onClose, onSuccess }: Props) {
  const utils = trpc.useUtils();
  const { data: projects } = trpc.projects.list.useQuery();
  const { data: areas } = trpc.areas.list.useQuery();

  const [form, setForm] = useState<TaskFormData>({
    name: "", description: "", projectId: "none", areaId: "none",
    status: "not_started", dueDate: "", startDate: "",
    urgency: 3, impact: 3, effort: 3, strategicAlignment: 3,
    assignToday: false, assignee: "", tags: "",
    manualPriorityOverride: "none",
  });

  // Populate form when task changes
  useEffect(() => {
    if (!task) return;
    setForm({
      name: task.name,
      description: task.description ?? "",
      projectId: task.projectId ? String(task.projectId) : "none",
      areaId: task.areaId ? String(task.areaId) : "none",
      status: task.status,
      dueDate: task.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd") : "",
      startDate: task.startDate ? format(new Date(task.startDate), "yyyy-MM-dd") : "",
      urgency: task.urgency ?? 3,
      impact: task.impact ?? 3,
      effort: task.effort ?? 3,
      strategicAlignment: task.strategicAlignment ?? 3,
      assignToday: task.assignToday ?? false,
      assignee: task.assignee ?? "",
      tags: task.tags ?? "",
      manualPriorityOverride: task.manualPriorityOverride ?? "none",
    });
  }, [task]);

  const scorePreview = trpc.tasks.scorePreview.useQuery(
    { urgency: form.urgency, impact: form.impact, effort: form.effort, strategicAlignment: form.strategicAlignment, dueDate: form.dueDate ? new Date(form.dueDate + "T05:00:00.000Z") : undefined },
    { enabled: !!task }
  );

  const updateMutation = trpc.tasks.update.useMutation({
    onSuccess: () => {
      invalidateTaskDomain(utils);
      toast.success("Task updated ✓");
      onSuccess?.();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const restoreMutation = trpc.tasks.restore.useMutation({
    onSuccess: () => { invalidateTaskDomain(utils); toast.success("Task restored ✓"); },
    onError: (e) => toast.error("Failed to restore: " + e.message),
  });
  const deleteMutation = trpc.tasks.delete.useMutation({
    onSuccess: (data) => {
      invalidateTaskDomain(utils);
      onSuccess?.();
      onClose();
      toast("Task deleted", {
        description: "You can undo this action within 5 seconds.",
        action: {
          label: "Undo",
          onClick: () => restoreMutation.mutate({ id: data.taskId }),
        },
        duration: 5000,
      });
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    if (!task) return;
    if (!form.name.trim()) return toast.error("Name is required");
    updateMutation.mutate({
      id: task.id,
      data: {
        name: form.name.trim(),
        description: form.description || null,
        projectId: form.projectId !== "none" ? parseInt(form.projectId) : null,
        areaId: form.areaId !== "none" ? parseInt(form.areaId) : null,
        status: form.status as any,
        dueDate: form.dueDate ? new Date(form.dueDate + "T05:00:00.000Z") : null, // Bangkok noon
        startDate: form.startDate ? new Date(form.startDate + "T05:00:00.000Z") : null, // Bangkok noon
        urgency: form.urgency,
        impact: form.impact,
        effort: form.effort,
        strategicAlignment: form.strategicAlignment,
        assignToday: form.assignToday,
        assignee: form.assignee || null,
        tags: form.tags || null,
        manualPriorityOverride: form.manualPriorityOverride !== "none" ? form.manualPriorityOverride as any : null,
      },
    });
  };

  const priorityCfg = task?.priority ? PRIORITY_CONFIG[task.priority] : null;
  const statusCfg = STATUS_CONFIG[form.status];

  return (
    <Dialog open={!!task} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-bold leading-snug">Edit Task</DialogTitle>
              {priorityCfg && (
                <span
                  className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: priorityCfg.tint, color: priorityCfg.solid }}
                >
                  {priorityCfg.label}
                </span>
              )}
            </div>
            {/* Delete button — top right (Undo toast replaces confirm dialog) */}
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
              onClick={() => task && deleteMutation.mutate({ id: task.id })}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Task Name</Label>
            <Input
              placeholder="What needs to be done?"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-xl border-border bg-muted/30 font-medium"
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</Label>
            <Textarea
              placeholder="Add details…"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="rounded-xl border-border bg-muted/30 resize-none"
              rows={2}
            />
          </div>

          {/* Project + Status + Dates + Assignee */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Project</Label>
              <Select value={form.projectId} onValueChange={(v) => setForm({ ...form, projectId: v })}>
                <SelectTrigger className="rounded-xl border-border bg-muted/30 h-9 text-xs"><SelectValue placeholder="No project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {projects?.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="rounded-xl border-border bg-muted/30 h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Due Date</Label>
              <DatePicker value={form.dueDate} onChange={(v) => setForm({ ...form, dueDate: v })} placeholder="Pick a date" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Start Date</Label>
              <DatePicker value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} placeholder="Pick a date" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Assignee</Label>
              <Input
                placeholder="Who is responsible?"
                value={form.assignee}
                onChange={(e) => setForm({ ...form, assignee: e.target.value })}
                className="rounded-xl border-border bg-muted/30 h-9 text-xs"
              />
            </div>
          </div>

          {/* Priority Engine */}
          <div
            className="rounded-2xl p-5 space-y-4"
            style={{ background: "oklch(0.52 0.26 270 / 0.04)", border: "1px solid oklch(0.52 0.26 270 / 0.12)" }}
          >
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground uppercase tracking-wide">Priority Engine</Label>
              {scorePreview.data && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Auto Score:</span>
                  <span className="text-sm font-bold" style={{ color: "oklch(0.42 0.22 270)" }}>{scorePreview.data.score}</span>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-lg"
                    style={{ background: PRIORITY_CONFIG[scorePreview.data.priority]?.tint, color: PRIORITY_CONFIG[scorePreview.data.priority]?.solid }}
                  >
                    {PRIORITY_CONFIG[scorePreview.data.priority]?.label}
                  </span>
                </div>
              )}
            </div>
            {[
              { key: "urgency", label: "Urgency", hint: "How time-sensitive is this?" },
              { key: "impact", label: "Impact", hint: "How much does this matter?" },
              { key: "effort", label: "Effort", hint: "How much work is required?" },
              { key: "strategicAlignment", label: "Strategic Alignment", hint: "How aligned with goals?" },
            ].map(({ key, label, hint }) => (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
                  <span className="text-xs font-bold text-foreground">{form[key as keyof TaskFormData] as number}/5</span>
                </div>
                <Slider
                  min={1} max={5} step={1}
                  value={[form[key as keyof TaskFormData] as number]}
                  onValueChange={([v]) => setForm({ ...form, [key]: v })}
                  className="w-full"
                />
                <p className="text-[10px] text-muted-foreground/60">{hint}</p>
              </div>
            ))}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Manual Override</Label>
              <Select value={form.manualPriorityOverride} onValueChange={(v) => setForm({ ...form, manualPriorityOverride: v })}>
                <SelectTrigger className="rounded-xl border-border bg-background h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Use auto score</SelectItem>
                  {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Assign Today */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
            <Switch checked={form.assignToday} onCheckedChange={(v) => setForm({ ...form, assignToday: v })} />
            <div>
              <Label className="text-xs font-semibold text-foreground cursor-pointer">Assign to Today</Label>
              <p className="text-[10px] text-muted-foreground">Show this task in today's focus list</p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" size="sm" className="rounded-xl" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="rounded-xl bg-primary text-white shadow-md shadow-primary/25 font-semibold"
            onClick={handleSave}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
