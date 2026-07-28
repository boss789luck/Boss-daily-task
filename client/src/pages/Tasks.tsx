import { trpc } from "@/lib/trpc";
import { invalidateTaskDomain } from "@/lib/queryHelpers";
import { cn } from "@/lib/utils";
import { Plus, Target, CheckCircle2, Circle, MoreHorizontal, Pencil, Trash2, CalendarDays, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useState, useMemo } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isToday, isPast, isTomorrow } from "date-fns";

// ── Design tokens ──────────────────────────────────────────────────────────────
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

const defaultForm: TaskFormData = {
  name: "", description: "", projectId: "none", areaId: "none",
  status: "not_started", dueDate: "", startDate: "",
  urgency: 3, impact: 3, effort: 3, strategicAlignment: 3,
  assignToday: false, assignee: "", tags: "",
  manualPriorityOverride: "none",
};

// ── Helpers ────────────────────────────────────────────────────────────────────
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
            <span role="button" tabIndex={0}
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
        <Calendar mode="single" selected={value ? new Date(value + "T00:00:00") : undefined}
          onSelect={(d) => onChange(d ? format(d, "yyyy-MM-dd") : "")} initialFocus />
      </PopoverContent>
    </Popover>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function TasksPage() {
  const utils = trpc.useUtils();
  const { data: tasks, isLoading } = trpc.tasks.list.useQuery({ parentTaskId: null });
  const { data: projects } = trpc.projects.list.useQuery();
  const { data: areas } = trpc.areas.list.useQuery();

  const [showCreate, setShowCreate] = useState(false);
  const [editTask, setEditTask] = useState<NonNullable<typeof tasks>[0] | null>(null);
  const [form, setForm] = useState<TaskFormData>(defaultForm);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [showDone, setShowDone] = useState(false);
  const { density, toggleDensity } = useTheme();

  const scorePreview = trpc.tasks.scorePreview.useQuery(
    { urgency: form.urgency, impact: form.impact, effort: form.effort, strategicAlignment: form.strategicAlignment, dueDate: form.dueDate ? new Date(form.dueDate + "T05:00:00.000Z") : undefined },
    { enabled: showCreate || !!editTask }
  );

  const createMutation = trpc.tasks.create.useMutation({
    onSuccess: () => { invalidateTaskDomain(utils); setShowCreate(false); setForm(defaultForm); toast.success("Task created"); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.tasks.update.useMutation({
    onSuccess: () => { invalidateTaskDomain(utils); setEditTask(null); toast.success("Task updated"); },
    onError: (e) => toast.error(e.message),
  });
  const restoreMutation = trpc.tasks.restore.useMutation({
    onSuccess: () => { invalidateTaskDomain(utils); toast.success("Task restored ✓"); },
    onError: (e) => toast.error("Failed to restore: " + e.message),
  });
  const deleteMutation = trpc.tasks.delete.useMutation({
    onSuccess: (data) => {
      invalidateTaskDomain(utils);
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
  const toggleDone = trpc.tasks.toggleDone.useMutation({
    onSuccess: () => invalidateTaskDomain(utils),
  });

  const handleSubmit = () => {
    if (!form.name.trim()) return toast.error("Name is required");
    const data = {
      name: form.name.trim(), description: form.description || null,
      projectId: form.projectId !== "none" ? parseInt(form.projectId) : null,
      areaId: form.areaId !== "none" ? parseInt(form.areaId) : null,
      status: form.status as any,
      dueDate: form.dueDate ? new Date(form.dueDate + "T05:00:00.000Z") : null, // Bangkok noon
      startDate: form.startDate ? new Date(form.startDate + "T05:00:00.000Z") : null, // Bangkok noon
      urgency: form.urgency, impact: form.impact, effort: form.effort, strategicAlignment: form.strategicAlignment,
      assignToday: form.assignToday, assignee: form.assignee || null, tags: form.tags || null,
      manualPriorityOverride: form.manualPriorityOverride !== "none" ? form.manualPriorityOverride as any : null,
    };
    if (editTask) updateMutation.mutate({ id: editTask.id, data });
    else createMutation.mutate(data);
  };

  const openEdit = (task: NonNullable<typeof tasks>[0]) => {
    setEditTask(task);
    setForm({
      name: task.name, description: task.description ?? "",
      projectId: task.projectId ? String(task.projectId) : "none",
      areaId: task.areaId ? String(task.areaId) : "none",
      status: task.status, dueDate: task.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd") : "",
      startDate: task.startDate ? format(new Date(task.startDate), "yyyy-MM-dd") : "",
      urgency: task.urgency ?? 3, impact: task.impact ?? 3, effort: task.effort ?? 3, strategicAlignment: task.strategicAlignment ?? 3,
      assignToday: task.assignToday ?? false, assignee: task.assignee ?? "", tags: task.tags ?? "",
      manualPriorityOverride: task.manualPriorityOverride ?? "none",
    });
  };

  const filtered = useMemo(() => {
    let list = tasks ?? [];
    if (!showDone) list = list.filter((t) => t.status !== "done" && t.status !== "cancelled");
    if (filterStatus !== "all") list = list.filter((t) => t.status === filterStatus);
    if (filterPriority !== "all") list = list.filter((t) => t.priority === filterPriority);
    return list;
  }, [tasks, filterStatus, filterPriority, showDone]);

  const getDueDateInfo = (dueDate: Date | null) => {
    if (!dueDate) return null;
    const d = new Date(dueDate);
    if (isToday(d)) return { label: "Today", color: "oklch(0.72 0.18 70)" };
    if (isTomorrow(d)) return { label: "Tomorrow", color: "oklch(0.60 0.22 200)" };
    if (isPast(d)) return { label: `${Math.ceil((Date.now() - d.getTime()) / 86400000)}d overdue`, color: "oklch(0.62 0.22 25)" };
    return { label: format(d, "MMM d"), color: "oklch(0.55 0.016 255)" };
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto page-enter">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "oklch(0.52 0.26 270 / 0.1)" }}>
              <Target className="w-4 h-4" style={{ color: "oklch(0.42 0.22 270)" }} />
            </div>
            Tasks
          </h1>
          <p className="text-muted-foreground text-sm mt-1 ml-10.5 font-medium">{filtered.length} tasks</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Density toggle */}
          <button onClick={toggleDensity}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all font-medium">
            {density === "compact" ? (
              <><svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="14" y2="8"/><line x1="2" y1="12" x2="14" y2="12"/></svg>Comfortable</>
            ) : (
              <><svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="3" x2="14" y2="3"/><line x1="2" y1="6" x2="14" y2="6"/><line x1="2" y1="9" x2="14" y2="9"/><line x1="2" y1="12" x2="14" y2="12"/><line x1="2" y1="15" x2="14" y2="15"/></svg>Compact</>
            )}
          </button>
          <Button size="sm" className="gap-2 rounded-xl bg-primary text-white shadow-md shadow-primary/25 hover:bg-primary/90 font-semibold"
            onClick={() => { setForm(defaultForm); setShowCreate(true); }}>
            <Plus className="w-3.5 h-3.5" /> New Task
          </Button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {[{ value: "all", label: "All" }, ...TASK_STATUSES.slice(0, 6)].map((s) => {
            const cfg = STATUS_CONFIG[s.value];
            const isActive = filterStatus === s.value;
            return (
              <button key={s.value} onClick={() => setFilterStatus(s.value)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={isActive
                  ? { background: cfg ? cfg.tint : "oklch(0.52 0.26 270 / 0.1)", color: cfg ? cfg.solid : "oklch(0.42 0.22 270)", border: `1px solid ${cfg ? cfg.solid : "oklch(0.52 0.26 270)"}40` }
                  : { background: "transparent", color: "oklch(0.55 0.016 255)", border: "1px solid transparent" }
                }>
                {s.label}
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {PRIORITIES.map((p) => {
            const cfg = PRIORITY_CONFIG[p.value];
            const isActive = filterPriority === p.value;
            return (
              <button key={p.value} onClick={() => setFilterPriority(filterPriority === p.value ? "all" : p.value)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all"
                style={isActive
                  ? { background: cfg.tint, color: cfg.solid, border: `1px solid ${cfg.solid}40` }
                  : { background: "transparent", color: "oklch(0.55 0.016 255)", border: "1px solid transparent" }
                }>
                {p.label}
              </button>
            );
          })}
          <button onClick={() => setShowDone(!showDone)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ml-1"
            style={showDone
              ? { background: "oklch(0.58 0.20 145 / 0.1)", color: "oklch(0.40 0.18 145)", border: "1px solid oklch(0.58 0.20 145 / 0.3)" }
              : { background: "transparent", color: "oklch(0.55 0.016 255)", border: "1px solid oklch(0.91 0.006 255)" }
            }>
            Show Done
          </button>
        </div>
      </div>

      {/* ── Task List ── */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "oklch(0.52 0.26 270 / 0.07)" }}>
            <Target className="w-7 h-7" style={{ color: "oklch(0.52 0.26 270 / 0.4)" }} />
          </div>
          <p className="text-muted-foreground font-medium">No tasks found</p>
          <Button className="mt-4 gap-2 rounded-xl bg-primary text-white shadow-md shadow-primary/25" size="sm"
            onClick={() => setShowCreate(true)}>
            <Plus className="w-3.5 h-3.5" /> Create task
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((task) => {
            const pCfg = PRIORITY_CONFIG[task.priority ?? "p2"] ?? PRIORITY_CONFIG.p2;
            const sCfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.not_started;
            const dueDateInfo = getDueDateInfo(task.dueDate);
            const project = projects?.find((pr) => pr.id === task.projectId);
            const score = Math.round(task.autoPriorityScore ?? 0);
            const isDone = task.status === "done";

            return (
              <div key={task.id}
                className={cn("boss-card group transition-all duration-150", isDone && "opacity-50")}
              >
                <div className="task-row flex items-center">
                  {/* Checkbox */}
                  <button onClick={() => toggleDone.mutate({ id: task.id })}
                    className="flex-shrink-0 transition-transform hover:scale-110 mr-3">
                    {isDone
                      ? <CheckCircle2 className="w-5 h-5" style={{ color: "oklch(0.58 0.20 145)" }} />
                      : <Circle className="w-5 h-5 text-muted-foreground/30 hover:text-primary transition-colors" />
                    }
                  </button>

                  {/* Priority bar */}
                  <div className="w-1 rounded-full flex-shrink-0 mr-3 self-stretch my-1" style={{ background: pCfg.solid, opacity: 0.7 }} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className={cn("font-semibold truncate", isDone ? "line-through text-muted-foreground" : "text-foreground")}
                      style={{ fontSize: "var(--density-text-size)" }}>
                      {task.name}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {/* Status badge */}
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-semibold"
                        style={{ background: sCfg.tint, color: sCfg.solid }}>
                        {sCfg.label}
                      </span>
                      {/* Priority badge */}
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold"
                        style={{ background: pCfg.tint, color: pCfg.solid }}>
                        {pCfg.label}
                      </span>
                      {score > 0 && (
                        <span className="text-[11px] text-muted-foreground font-medium">Score {score}</span>
                      )}
                      {project && (
                        <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">{project.name}</span>
                      )}
                      {task.assignToday && (
                        <span className="text-[11px] font-bold" style={{ color: "oklch(0.60 0.22 200)" }}>★ Today</span>
                      )}
                      {task.calendarSyncStatus === "synced" && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
                          style={{ background: "oklch(0.58 0.20 145 / 0.1)", color: "oklch(0.45 0.18 145)" }}
                          title={task.lastSyncedAt ? `Synced ${new Date(task.lastSyncedAt).toLocaleString()}` : "Synced to Google Calendar"}
                        >
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M8 6l4-4 4 4"/><path d="M12 2v10.3"/><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/>
                          </svg>
                          GCal
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Due date */}
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    {dueDateInfo && (
                      <span className="text-xs font-semibold" style={{ color: dueDateInfo.color }}>
                        {dueDateInfo.label}
                      </span>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => openEdit(task)} className="gap-2 text-xs"><Pencil className="w-3.5 h-3.5" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleDone.mutate({ id: task.id })} className="gap-2 text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {isDone ? "Mark incomplete" : "Mark done"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => deleteMutation.mutate({ id: task.id })}
                          className="gap-2 text-xs text-destructive focus:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create/Edit Dialog ── */}
      <Dialog open={showCreate || !!editTask} onOpenChange={(o) => { if (!o) { setShowCreate(false); setEditTask(null); } }}>
        <DialogContent className="w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">{editTask ? "Edit Task" : "New Task"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Task Name</Label>
              <Input placeholder="What needs to be done?" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="rounded-xl border-border bg-muted/30 font-medium" autoFocus />
            </div>
            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</Label>
              <Textarea placeholder="Add details…" value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="rounded-xl border-border bg-muted/30 resize-none" rows={2} />
            </div>
            {/* Project + Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 lg:gap-5">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Project</Label>
                <Select value={form.projectId} onValueChange={(v) => setForm({ ...form, projectId: v })}>
                  <SelectTrigger className="rounded-xl border-border bg-muted/30 h-9 text-xs"><SelectValue placeholder="No project" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">No project</SelectItem>{projects?.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="rounded-xl border-border bg-muted/30 h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{TASK_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {/* Due Date */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Due Date</Label>
                <DatePicker value={form.dueDate} onChange={(v) => setForm({ ...form, dueDate: v })} placeholder="Pick a date" />
              </div>
              {/* Start Date */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Start Date</Label>
                <DatePicker value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} placeholder="Pick a date" />
              </div>
              {/* Assignee */}
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Assignee</Label>
                <Input placeholder="Who is responsible?" value={form.assignee}
                  onChange={(e) => setForm({ ...form, assignee: e.target.value })}
                  className="rounded-xl border-border bg-muted/30 h-9 text-xs" />
              </div>
            </div>

            {/* Priority Engine */}
            <div className="rounded-2xl p-5 space-y-4" style={{ background: "oklch(0.52 0.26 270 / 0.04)", border: "1px solid oklch(0.52 0.26 270 / 0.12)" }}>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground uppercase tracking-wide">Priority Engine</Label>
                {scorePreview.data && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Auto Score:</span>
                    <span className="text-sm font-bold" style={{ color: "oklch(0.42 0.22 270)" }}>{scorePreview.data.score}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
                      style={{ background: PRIORITY_CONFIG[scorePreview.data.priority]?.tint, color: PRIORITY_CONFIG[scorePreview.data.priority]?.solid }}>
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
                  <Slider min={1} max={5} step={1} value={[form[key as keyof TaskFormData] as number]}
                    onValueChange={([v]) => setForm({ ...form, [key]: v })} className="w-full" />
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
            <Button variant="outline" size="sm" className="rounded-xl"
              onClick={() => { setShowCreate(false); setEditTask(null); }}>Cancel</Button>
            <Button size="sm" className="rounded-xl bg-primary text-white shadow-md shadow-primary/25 font-semibold"
              onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editTask ? "Save changes" : "Create task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
