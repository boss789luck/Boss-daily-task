import { trpc } from "@/lib/trpc";
import { invalidateTaskDomain } from "@/lib/queryHelpers";
import { useParams, Link } from "wouter";
import { ArrowLeft, Target, Plus, CheckCircle2, Circle, MoreHorizontal, Trash2, Pencil, CalendarDays, TrendingUp, Activity, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import TaskEditModal from "@/components/TaskEditModal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

const PRIORITY_CFG: Record<string, { label: string; solid: string; tint: string }> = {
  p0: { label: "Critical", solid: "oklch(0.62 0.22 25)",  tint: "oklch(0.62 0.22 25  / 0.08)" },
  p1: { label: "High",     solid: "oklch(0.72 0.18 70)",  tint: "oklch(0.72 0.18 70  / 0.1)" },
  p2: { label: "Medium",   solid: "oklch(0.52 0.26 270)", tint: "oklch(0.52 0.26 270 / 0.08)" },
  p3: { label: "Low",      solid: "oklch(0.65 0.04 255)", tint: "oklch(0.65 0.04 255 / 0.06)" },
};

const STATUS_CFG: Record<string, { label: string; solid: string; tint: string }> = {
  inbox:       { label: "Inbox",       solid: "oklch(0.60 0.22 300)", tint: "oklch(0.60 0.22 300 / 0.08)" },
  not_started: { label: "Not Started", solid: "oklch(0.65 0.04 255)", tint: "oklch(0.65 0.04 255 / 0.06)" },
  next_action: { label: "Next Action", solid: "oklch(0.60 0.22 200)", tint: "oklch(0.60 0.22 200 / 0.08)" },
  in_progress: { label: "In Progress", solid: "oklch(0.52 0.26 270)", tint: "oklch(0.52 0.26 270 / 0.08)" },
  waiting:     { label: "Waiting",     solid: "oklch(0.72 0.18 70)",  tint: "oklch(0.72 0.18 70  / 0.1)" },
  blocked:     { label: "Blocked",     solid: "oklch(0.62 0.22 25)",  tint: "oklch(0.62 0.22 25  / 0.08)" },
  review:      { label: "Review",      solid: "oklch(0.55 0.24 250)", tint: "oklch(0.55 0.24 250 / 0.08)" },
  done:        { label: "Done",        solid: "oklch(0.58 0.20 145)", tint: "oklch(0.58 0.20 145 / 0.08)" },
  cancelled:   { label: "Cancelled",   solid: "oklch(0.55 0.02 255)", tint: "oklch(0.55 0.02 255 / 0.06)" },
};

const HEALTH_CFG: Record<string, { label: string; solid: string; tint: string }> = {
  on_track:  { label: "On Track",  solid: "oklch(0.58 0.20 145)", tint: "oklch(0.58 0.20 145 / 0.1)" },
  at_risk:   { label: "At Risk",   solid: "oklch(0.72 0.18 70)",  tint: "oklch(0.72 0.18 70  / 0.1)" },
  delayed:   { label: "Delayed",   solid: "oklch(0.65 0.18 50)",  tint: "oklch(0.65 0.18 50  / 0.1)" },
  critical:  { label: "Critical",  solid: "oklch(0.62 0.22 25)",  tint: "oklch(0.62 0.22 25  / 0.1)" },
};

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id ?? "0");
  const utils = trpc.useUtils();

  const { data: project, isLoading } = trpc.projects.byId.useQuery({ id: projectId });
  const { data: tasks } = trpc.tasks.list.useQuery({ projectId, parentTaskId: null });
  const { data: areas } = trpc.areas.list.useQuery();

  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState<Date | undefined>(undefined);
  const [newTaskTime, setNewTaskTime] = useState<string>("");
  const [addingTask, setAddingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<import("@/components/TaskEditModal").TaskForModal | null>(null);

  const createTask = trpc.tasks.create.useMutation({
    onSuccess: () => { invalidateTaskDomain(utils); setNewTaskName(""); setNewTaskDueDate(undefined); setNewTaskTime(""); setAddingTask(false); toast.success("Task created"); },
    onError: (e) => toast.error(e.message),
  });
  const toggleDone = trpc.tasks.toggleDone.useMutation({
    onSuccess: () => invalidateTaskDomain(utils),
  });
  const restoreTask = trpc.tasks.restore.useMutation({
    onSuccess: () => { invalidateTaskDomain(utils); toast.success("Task restored ✓"); },
    onError: (e) => toast.error("Failed to restore: " + e.message),
  });
  const deleteTask = trpc.tasks.delete.useMutation({
    onSuccess: (data) => {
      invalidateTaskDomain(utils);
      toast("Task deleted", {
        description: "You can undo this action within 5 seconds.",
        action: {
          label: "Undo",
          onClick: () => restoreTask.mutate({ id: data.taskId }),
        },
        duration: 5000,
      });
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-4">
      <Skeleton className="h-14 w-96 rounded-2xl" />
      <Skeleton className="h-32 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
  if (!project) return <div className="p-6 text-muted-foreground">Project not found</div>;

  const area = areas?.find((a) => a.id === project.areaId);
  const progress = (project.progress ?? 0) * 100;
  const daysLeft = project.deadline ? differenceInDays(new Date(project.deadline), new Date()) : null;
  const doneTasks = tasks?.filter((t) => t.status === "done").length ?? 0;
  const totalTasks = tasks?.length ?? 0;
  const healthCfg = HEALTH_CFG[project.health ?? "on_track"] ?? HEALTH_CFG.on_track;
  const statusCfg = STATUS_CFG[project.status ?? "not_started"] ?? STATUS_CFG.not_started;

  // Normalize a calendar-picker Date to Bangkok noon UTC (T05:00:00Z)
  // The shadcn Calendar returns local-midnight Date; we convert to YYYY-MM-DDT05:00:00Z
  const toBangkokNoon = (d: Date): Date => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return new Date(`${y}-${m}-${day}T05:00:00.000Z`);
  };

  const handleAddTask = () => {
    if (!newTaskName.trim()) return;
    createTask.mutate({
      name: newTaskName.trim(),
      projectId,
      areaId: project.areaId ?? undefined,
      status: "not_started",
      dueDate: newTaskDueDate ? toBangkokNoon(newTaskDueDate) : null, // Bangkok noon
      startTime: newTaskTime || null,
    });
  };

  const resetAddForm = () => {
    setAddingTask(false);
    setNewTaskName("");
    setNewTaskDueDate(undefined);
    setNewTaskTime("");
  };

  return (
    <>
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-4 md:space-y-6 page-enter">
      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <Link href="/projects">
          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-xl hover:bg-muted/50 mt-0.5">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap mb-1">
            <h1 className="text-xl font-bold text-foreground tracking-tight">{project.name}</h1>
            {area && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold"
                style={{ background: `${area.color}12`, color: area.color ?? undefined, border: `1px solid ${area.color}25` }}>
                <span>{area.icon ?? "◆"}</span> {area.name}
              </span>
            )}
          </div>
          {project.description && <p className="text-muted-foreground text-sm leading-relaxed">{project.description}</p>}
        </div>
      </div>

      {/* ── Progress Card ── */}
      <div className="boss-card p-5">
        <div className="flex items-start justify-between mb-4">
          {/* Left: progress number + task count */}
          <div className="flex items-center gap-4">
            <div>
              <div className="text-3xl font-bold text-foreground tracking-tight">{Math.round(progress)}%</div>
              <div className="text-xs text-muted-foreground font-medium mt-0.5">
                {doneTasks} / {totalTasks} tasks done
              </div>
            </div>
            {/* Mini stat pills */}
            <div className="flex flex-col gap-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold"
                style={{ background: statusCfg.tint, color: statusCfg.solid }}>
                <Activity className="w-3 h-3" /> {statusCfg.label}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold"
                style={{ background: healthCfg.tint, color: healthCfg.solid }}>
                <TrendingUp className="w-3 h-3" /> {healthCfg.label}
              </span>
            </div>
          </div>

          {/* Right: deadline */}
          {daysLeft !== null && (
            <div className="text-right flex-shrink-0">
              <div className="flex items-center gap-1.5 justify-end text-xs font-semibold"
                style={{ color: daysLeft < 0 ? "oklch(0.62 0.22 25)" : daysLeft <= 7 ? "oklch(0.72 0.18 70)" : "oklch(0.52 0.016 255)" }}>
                <CalendarDays className="w-3.5 h-3.5" />
                {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
              </div>
              {project.deadline && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  Due {format(new Date(project.deadline), "MMM d, yyyy")}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${progress}%`,
              background: progress >= 80
                ? "linear-gradient(90deg, oklch(0.58 0.20 145), oklch(0.62 0.18 145))"
                : progress >= 40
                ? "linear-gradient(90deg, oklch(0.52 0.26 270), oklch(0.60 0.22 300))"
                : "linear-gradient(90deg, oklch(0.72 0.18 70), oklch(0.65 0.18 50))"
            }} />
        </div>
      </div>

      {/* ── Tasks ── */}
      <div className="boss-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-sm flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.52 0.26 270 / 0.1)" }}>
              <Target className="w-3.5 h-3.5" style={{ color: "oklch(0.42 0.22 270)" }} />
            </div>
            Tasks
            <span className="text-xs font-normal text-muted-foreground ml-1">{totalTasks} total</span>
          </h2>
          <Button size="sm" variant="ghost" className="gap-1 text-xs h-7 rounded-xl" onClick={() => setAddingTask(true)}>
            <Plus className="w-3 h-3" /> Add Task
          </Button>
        </div>

        {/* Quick add */}
        {addingTask && (
          <div className="flex flex-col gap-2 mb-3 p-3 rounded-xl bg-muted/20 border border-border/40">
            <Input
              placeholder="Task name…"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddTask();
                if (e.key === "Escape") resetAddForm();
              }}
              className="rounded-xl border-border bg-background h-8 text-sm font-medium"
              autoFocus
            />
            <div className="flex items-center gap-2">
              {/* Due Date Picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-1.5 px-3 h-8 rounded-xl border text-xs font-medium transition-colors",
                      newTaskDueDate
                        ? "border-primary/40 bg-primary/8 text-primary"
                        : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    )}
                  >
                    <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />
                    {newTaskDueDate ? format(newTaskDueDate, "MMM d, yyyy") : "Due date"}
                    {newTaskDueDate && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); setNewTaskDueDate(undefined); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setNewTaskDueDate(undefined); } }}
                        className="ml-0.5 hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={newTaskDueDate}
                    onSelect={(d) => setNewTaskDueDate(d ?? undefined)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {/* Time picker (optional) */}
              {newTaskDueDate && (
                <div className="flex items-center gap-1 px-2 h-8 rounded-xl border border-border bg-muted/30">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <input
                    type="time"
                    value={newTaskTime}
                    onChange={(e) => setNewTaskTime(e.target.value)}
                    className="bg-transparent text-xs font-medium text-foreground outline-none w-[80px]"
                    placeholder="Time"
                  />
                  {newTaskTime && (
                    <button type="button" onClick={() => setNewTaskTime("")} className="text-muted-foreground hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
              <div className="flex-1" />
              <Button size="sm" className="h-8 px-3 text-xs rounded-xl bg-primary text-white font-semibold"
                onClick={handleAddTask} disabled={createTask.isPending || !newTaskName.trim()}>
                {createTask.isPending ? "Adding…" : "Add"}
              </Button>
              <Button size="sm" variant="ghost" className="h-8 px-3 text-xs rounded-xl"
                onClick={resetAddForm}>Cancel</Button>
            </div>
          </div>
        )}

        {totalTasks === 0 && !addingTask ? (
          <div className="text-center py-10">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ background: "oklch(0.52 0.26 270 / 0.08)" }}>
              <Target className="w-5 h-5" style={{ color: "oklch(0.52 0.26 270 / 0.5)" }} />
            </div>
            <p className="text-muted-foreground text-sm mb-3">No tasks yet</p>
            <Button size="sm" variant="ghost" className="gap-1 text-xs rounded-xl" onClick={() => setAddingTask(true)}>
              <Plus className="w-3 h-3" /> Add first task
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            {tasks?.map((task) => {
              const pCfg = PRIORITY_CFG[task.priority ?? "p2"] ?? PRIORITY_CFG.p2;
              const sCfg = STATUS_CFG[task.status ?? "not_started"] ?? STATUS_CFG.not_started;
              const isDone = task.status === "done";
              return (
                <div key={task.id}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-muted/25 transition-colors group">
                  <button
                    onClick={() => toggleDone.mutate({ id: task.id })}
                    className="flex-shrink-0 transition-all hover:scale-110">
                    {isDone
                      ? <CheckCircle2 className="w-4 h-4" style={{ color: "oklch(0.58 0.20 145)" }} />
                      : <Circle className="w-4 h-4 text-muted-foreground/40 hover:text-primary" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={cn("text-sm font-medium truncate transition-colors",
                      isDone ? "line-through text-muted-foreground/50" : "text-foreground")}>
                      {task.name}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: pCfg.tint, color: pCfg.solid }}>
                        {pCfg.label}
                      </span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{ background: sCfg.tint, color: sCfg.solid }}>
                        {sCfg.label}
                      </span>
                      {task.dueDate && (
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(task.dueDate), "MMM d")}
                        </span>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"
                        className="w-6 h-6 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <MoreHorizontal className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem
                        onClick={() => setEditingTask(task as import("@/components/TaskEditModal").TaskForModal)}
                        className="gap-2 text-xs">
                        <Pencil className="w-3 h-3" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => deleteTask.mutate({ id: task.id })}
                        className="gap-2 text-xs text-destructive focus:text-destructive">
                        <Trash2 className="w-3 h-3" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>

    {editingTask !== null && (
      <TaskEditModal
        task={editingTask}
        onClose={() => setEditingTask(null)}
        onSuccess={() => { invalidateTaskDomain(utils); setEditingTask(null); }}
      />
    )}
    </>
  );
}
