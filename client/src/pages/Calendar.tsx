import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Calendar as CalIcon, ChevronLeft, ChevronRight, GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import TaskEditModal, { type TaskForModal } from "@/components/TaskEditModal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday,
  addWeeks, subWeeks, startOfDay, endOfDay,
} from "date-fns";
import { toast } from "sonner";

const PRIORITY_COLORS: Record<string, { dot: string; card: string; border: string }> = {
  critical: { dot: "bg-red-500",    card: "bg-red-50 dark:bg-red-950/30",    border: "border-red-200 dark:border-red-800" },
  high:     { dot: "bg-orange-500", card: "bg-orange-50 dark:bg-orange-950/30", border: "border-orange-200 dark:border-orange-800" },
  medium:   { dot: "bg-yellow-500", card: "bg-yellow-50 dark:bg-yellow-950/30", border: "border-yellow-200 dark:border-yellow-800" },
  low:      { dot: "bg-slate-400",  card: "bg-slate-50 dark:bg-slate-800/30",  border: "border-slate-200 dark:border-slate-700" },
  p0: { dot: "bg-red-500",    card: "bg-red-50 dark:bg-red-950/30",    border: "border-red-200 dark:border-red-800" },
  p1: { dot: "bg-orange-500", card: "bg-orange-50 dark:bg-orange-950/30", border: "border-orange-200 dark:border-orange-800" },
  p2: { dot: "bg-yellow-500", card: "bg-yellow-50 dark:bg-yellow-950/30", border: "border-yellow-200 dark:border-yellow-800" },
  p3: { dot: "bg-slate-400",  card: "bg-slate-50 dark:bg-slate-800/30",  border: "border-slate-200 dark:border-slate-700" },
};
const DEFAULT_COLOR = { dot: "bg-slate-400", card: "bg-slate-50 dark:bg-slate-800/30", border: "border-slate-200 dark:border-slate-700" };
function getPriColor(priority?: string | null) { return PRIORITY_COLORS[priority ?? ""] ?? DEFAULT_COLOR; }

type ViewMode = "month" | "week" | "day";

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewMode>("month");

  // ─── Task edit modal state ────────────────────────────────────────────────────
  const [editingTask, setEditingTask] = useState<TaskForModal | null>(null);

  // ─── Day tasks popover (for +N more) ─────────────────────────────────────────
  const [dayPopoverDate, setDayPopoverDate] = useState<Date | null>(null);

  // ─── Drag state (stored in refs to avoid re-renders during drag) ──────────────
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverIso, setDragOverIso] = useState<string | null>(null);
  const dragIdRef = useRef<number | null>(null);

  const rangeStart = useMemo(() => {
    if (view === "month") return startOfWeek(startOfMonth(currentDate));
    if (view === "week") return startOfWeek(currentDate);
    return startOfDay(currentDate);
  }, [currentDate, view]);

  const rangeEnd = useMemo(() => {
    if (view === "month") return endOfWeek(endOfMonth(currentDate));
    if (view === "week") return endOfWeek(currentDate);
    return endOfDay(currentDate);
  }, [currentDate, view]);

  const { data: tasks } = trpc.tasks.inRange.useQuery({ start: rangeStart, end: rangeEnd });
  const utils = trpc.useUtils();

  const pullSync = trpc.googleCalendar.pullSync.useMutation({
    onSuccess: (data) => {
      if (data.updated > 0 || data.deleted > 0) {
        utils.tasks.inRange.invalidate();
        utils.tasks.list.invalidate();
        const parts: string[] = [];
        if (data.updated > 0) parts.push(`${data.updated} updated`);
        if (data.deleted > 0) parts.push(`${data.deleted} task${data.deleted > 1 ? "s" : ""} deleted (removed in GCal)`);
        toast.success(`↓ ${parts.join(", ")} from Google Calendar`);
      }
    },
  });

  // Auto-pull from Google Calendar when Calendar page opens
  useEffect(() => {
    pullSync.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateTask = trpc.tasks.update.useMutation({
    onSuccess: () => {
      utils.tasks.inRange.invalidate();
      toast.success("Task rescheduled ✓");
    },
    onError: () => toast.error("Failed to reschedule task"),
  });

  const navigate = (dir: 1 | -1) => {
    if (view === "month") setCurrentDate(dir === 1 ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    else if (view === "week") setCurrentDate(dir === 1 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, dir));
  };

  const getTasksForDay = (day: Date) =>
    tasks?.filter((t) => t.dueDate && isSameDay(new Date(t.dueDate), day)) ?? [];

  // ─── Drag handlers ────────────────────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.DragEvent, taskId: number) => {
    dragIdRef.current = taskId;
    setDraggingId(taskId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(taskId));
    // Small ghost image so browser doesn't show a big clone
    const ghost = document.createElement("div");
    ghost.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:120px;height:28px;background:#6366f1;border-radius:6px;opacity:0.9;color:#fff;font-size:12px;display:flex;align-items:center;padding:0 8px;";
    ghost.textContent = "Moving task…";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 60, 14);
    setTimeout(() => document.body.removeChild(ghost), 0);
  }, []);

  const handleDragEnd = useCallback(() => {
    dragIdRef.current = null;
    setDraggingId(null);
    setDragOverIso(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    const iso = e.currentTarget.dataset.dayiso;
    if (iso) setDragOverIso(iso);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    // Only clear highlight when leaving the cell itself (not a child element)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverIso(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIso(null);

    const taskId = dragIdRef.current;
    const iso = e.currentTarget.dataset.dayiso;
    if (!taskId || !iso) return;

    // Parse the ISO date and set to noon to avoid timezone issues
    const [y, m, d] = iso.split("-").map(Number);
    const newDate = new Date(`${String(y).padStart(4,"0")}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}T05:00:00.000Z`); // Bangkok noon

    updateTask.mutate({ id: taskId, data: { dueDate: newDate } });
    dragIdRef.current = null;
    setDraggingId(null);
  }, [updateTask]);

  // Month view days
  const monthDays = useMemo(() => {
    const days: Date[] = [];
    let d = rangeStart;
    while (d <= rangeEnd) { days.push(d); d = addDays(d, 1); }
    return days;
  }, [rangeStart, rangeEnd]);

  // Week view days
  const weekDays = useMemo(() => {
    const days: Date[] = [];
    let d = startOfWeek(currentDate);
    for (let i = 0; i < 7; i++) { days.push(d); d = addDays(d, 1); }
    return days;
  }, [currentDate]);

  // ─── Task chip ────────────────────────────────────────────────────────────────
  const TaskChip = ({ task, compact = false }: { task: any; compact?: boolean }) => {
    const col = getPriColor(task.priority);
    const isDragging = draggingId === task.id;
    return (
      <div
        draggable
        onDragStart={(e) => handleDragStart(e, task.id)}
        onDragEnd={handleDragEnd}
        onClick={(e) => {
          // Don't open modal if user is dragging
          if (isDragging) return;
          e.stopPropagation();
          setEditingTask(task as TaskForModal);
        }}
        className={cn(
          "group flex items-center gap-1.5 rounded-lg border text-xs cursor-pointer active:cursor-grabbing select-none transition-all duration-100",
          "hover:shadow-sm hover:scale-[1.01]",
          compact ? "px-1.5 py-0.5" : "px-2 py-1.5",
          col.card, col.border,
          task.status === "done" && "opacity-40 line-through",
          isDragging && "opacity-20 scale-95 ring-2 ring-primary/50",
        )}
        style={{ touchAction: "none" }}
        title="Click to edit · Drag to reschedule"
      >
        {!compact && (
          <GripVertical className="w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground/70 flex-shrink-0 transition-colors" />
        )}
        <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", col.dot)} />
        <span className="truncate font-medium text-foreground/80">{task.name}</span>
        {!compact && task.dueDate && (
          <span className="ml-auto text-muted-foreground/60 flex-shrink-0">{format(new Date(task.dueDate), "h:mm a")}</span>
        )}
      </div>
    );
  };

  // ─── Drop cell wrapper — uses data-dayiso attribute for reliable drop target ──
  const dayIsoStr = (day: Date) => format(day, "yyyy-MM-dd");

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <CalIcon className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">
            {view === "month" && format(currentDate, "MMMM yyyy")}
            {view === "week" && `Week of ${format(startOfWeek(currentDate), "MMM d")} – ${format(endOfWeek(currentDate), "MMM d, yyyy")}`}
            {view === "day" && format(currentDate, "EEEE, MMMM d, yyyy")}
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {draggingId && (
            <span className="text-xs text-primary animate-pulse font-medium">
              Drop on a day to reschedule
            </span>
          )}
          {/* View switcher — instant, no animation */}
          <div className="flex gap-0 bg-muted/40 rounded-lg p-0.5 border border-border/40">
            {(["month", "week", "day"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors duration-100",
                  view === v
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-xs h-8 px-3" onClick={() => setCurrentDate(new Date())}>
            Today
          </Button>
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => navigate(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ── Month View ── */}
      {view === "month" && (
        <div className="flex-1 glass-card rounded-xl overflow-hidden flex flex-col">
          <div className="grid grid-cols-7 border-b border-border">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 flex-1">
            {monthDays.map((day, i) => {
              const dayTasks = getTasksForDay(day);
              const inMonth = isSameMonth(day, currentDate);
              const today = isToday(day);
              const iso = dayIsoStr(day);
              const isOver = dragOverIso === iso;
              return (
                <div
                  key={i}
                  data-dayiso={iso}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={cn(
                    "min-h-[100px] p-2 border-b border-r border-border/30 transition-colors duration-100",
                    !inMonth && "opacity-40",
                    isOver
                      ? "bg-primary/10 ring-2 ring-inset ring-primary/50"
                      : draggingId
                      ? "hover:bg-primary/5 cursor-copy"
                      : "hover:bg-muted/20",
                  )}
                >
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mb-1",
                    today ? "bg-primary text-primary-foreground" : "text-foreground",
                  )}>
                    {format(day, "d")}
                  </div>
                  <div className="space-y-0.5">
                    {dayTasks.slice(0, 3).map((task) => (
                      <TaskChip key={task.id} task={task} compact />
                    ))}
                    {dayTasks.length > 3 && (
                      <Popover
                        open={dayPopoverDate !== null && isSameDay(dayPopoverDate, day)}
                        onOpenChange={(open) => {
                          if (!open) setDayPopoverDate(null);
                        }}
                      >
                        <PopoverTrigger asChild>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDayPopoverDate(day);
                            }}
                            className="text-[10px] text-primary font-semibold px-1.5 py-0.5 rounded hover:bg-primary/10 transition-colors w-full text-left"
                          >
                            +{dayTasks.length - 3} more
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-64 p-3"
                          align="start"
                          side="bottom"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-foreground">
                              {format(day, "EEE, MMM d")} — {dayTasks.length} tasks
                            </span>
                            <button
                              onClick={() => setDayPopoverDate(null)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="space-y-1 max-h-60 overflow-y-auto">
                            {dayTasks.map((task) => (
                              <TaskChip key={task.id} task={task} compact />
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                  {isOver && draggingId && (
                    <div className="mt-1 text-[10px] text-primary/70 font-medium text-center">Drop here</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Week View ── */}
      {view === "week" && (
        <div className="flex-1 glass-card rounded-xl overflow-hidden flex flex-col">
          <div className="grid grid-cols-7 border-b border-border flex-shrink-0">
            {weekDays.map((day) => (
              <div
                key={day.toISOString()}
                className={cn(
                  "py-3 text-center border-r border-border/30 last:border-r-0",
                  isToday(day) && "bg-primary/5",
                )}
              >
                <div className="text-xs text-muted-foreground">{format(day, "EEE")}</div>
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold mx-auto mt-1",
                  isToday(day) ? "bg-primary text-primary-foreground" : "text-foreground",
                )}>
                  {format(day, "d")}
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 flex-1 overflow-y-auto">
            {weekDays.map((day) => {
              const dayTasks = getTasksForDay(day);
              const iso = dayIsoStr(day);
              const isOver = dragOverIso === iso;
              return (
                <div
                  key={iso}
                  data-dayiso={iso}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={cn(
                    "p-2 border-r border-border/30 last:border-r-0 space-y-1 min-h-[360px] transition-colors duration-100",
                    isToday(day) && "bg-primary/5",
                    isOver
                      ? "bg-primary/10 ring-2 ring-inset ring-primary/50"
                      : draggingId
                      ? "hover:bg-primary/5 cursor-copy"
                      : "",
                  )}
                >
                  {dayTasks.length === 0 && !isOver && (
                    <div className="h-full flex items-start justify-center pt-8 text-muted-foreground/30 text-xs select-none pointer-events-none">
                      {draggingId ? "Drop here" : ""}
                    </div>
                  )}
                  {isOver && draggingId && dayTasks.length === 0 && (
                    <div className="flex items-center justify-center h-20 text-primary/60 text-xs font-medium border-2 border-dashed border-primary/30 rounded-lg">
                      Drop here
                    </div>
                  )}
                  {dayTasks.map((task) => (
                    <TaskChip key={task.id} task={task} />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Day View ── */}
      {view === "day" && (() => {
        const iso = dayIsoStr(currentDate);
        const isOver = dragOverIso === iso;
        return (
          <div
            data-dayiso={iso}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "flex-1 glass-card rounded-xl p-5 transition-colors duration-100",
              isOver && "bg-primary/10 ring-2 ring-inset ring-primary/50",
            )}
          >
            <h2 className="font-semibold text-foreground mb-4">{format(currentDate, "EEEE, MMMM d")}</h2>
            {getTasksForDay(currentDate).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                {draggingId ? "Drop task here to reschedule" : "No tasks scheduled"}
              </div>
            ) : (
              <div className="space-y-2">
                {getTasksForDay(currentDate).map((task) => (
                  <TaskChip key={task.id} task={task} />
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Task Edit Modal ── */}
      <TaskEditModal
        task={editingTask}
        onClose={() => setEditingTask(null)}
        onSuccess={() => utils.tasks.inRange.invalidate()}
      />
    </div>
  );
}
