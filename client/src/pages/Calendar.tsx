import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Calendar as CalIcon, ChevronLeft, ChevronRight, GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useMemo, useEffect } from "react";
import TaskEditModal, { type TaskForModal } from "@/components/TaskEditModal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday,
  addWeeks, subWeeks, startOfDay, endOfDay,
} from "date-fns";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";

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

const DayDroppable = ({ iso, children, className }: { iso: string; children: React.ReactNode; className?: string }) => {
  const { setNodeRef, isOver } = useDroppable({ id: iso });
  return (
    <div
      ref={setNodeRef}
      className={cn(className, isOver && "bg-primary/10 ring-2 ring-inset ring-primary/50")}
    >
      {children}
    </div>
  );
};

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewMode>("month");

  // ─── Task edit modal state ────────────────────────────────────────────────────
  const [editingTask, setEditingTask] = useState<TaskForModal | null>(null);

  // ─── Day tasks popover (for +N more) ─────────────────────────────────────────
  const [dayPopoverDate, setDayPopoverDate] = useState<Date | null>(null);

  // ─── Drag state (dnd-kit) ────────────────────────────────────────────────────
  const [draggingTask, setDraggingTask] = useState<any>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

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

  // ─── dnd-kit handlers ─────────────────────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setDraggingTask(active.data.current?.task || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggingTask(null);

    if (!over) return;

    const taskId = Number(active.id);
    const iso = String(over.id);

    // Parse the ISO date and set to noon to avoid timezone issues
    const [y, m, d] = iso.split("-").map(Number);
    const newDate = new Date(`${String(y).padStart(4,"0")}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}T05:00:00.000Z`); // Bangkok noon

    updateTask.mutate({ id: taskId, data: { dueDate: newDate } });
  };

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
  const TaskChipBase = ({ 
    task, 
    compact = false, 
    isOverlay = false,
    attributes,
    listeners,
    setNodeRef,
    isDragging
  }: { 
    task: any; 
    compact?: boolean, 
    isOverlay?: boolean,
    attributes?: any,
    listeners?: any,
    setNodeRef?: any,
    isDragging?: boolean
  }) => {
    const col = getPriColor(task.priority);
    return (
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        onClick={(e) => {
          // Don't open modal if user is dragging
          if (isDragging) return;
          e.stopPropagation();
          setEditingTask(task as TaskForModal);
        }}
        className={cn(
          "group flex items-center gap-1.5 rounded-lg border text-xs cursor-pointer active:cursor-grabbing select-none transition-all duration-100 relative",
          "hover:shadow-sm hover:scale-[1.01]",
          compact ? "px-1.5 py-0.5" : "px-2 py-1.5",
          col.card, col.border,
          task.status === "done" && "opacity-40 line-through",
          isDragging && !isOverlay && "opacity-30 scale-95 ring-2 ring-primary/50",
          isOverlay && "shadow-xl opacity-100 scale-105 rotate-2 cursor-grabbing bg-background z-50"
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

  const TaskChip = ({ task, compact = false }: { task: any; compact?: boolean }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
      id: task.id.toString(),
      data: { task },
    });
    
    return <TaskChipBase task={task} compact={compact} attributes={attributes} listeners={listeners} setNodeRef={setNodeRef} isDragging={isDragging} />;
  };

  const dayIsoStr = (day: Date) => format(day, "yyyy-MM-dd");

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="p-4 md:p-6 max-w-7xl mx-auto h-full flex flex-col relative z-0">
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
            {draggingTask && (
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
                return (
                  <DayDroppable
                    key={i}
                    iso={iso}
                    className={cn(
                      "min-h-[100px] p-2 border-b border-r border-border/30 transition-colors duration-100",
                      !inMonth && "opacity-40",
                      draggingTask ? "hover:bg-primary/5" : "hover:bg-muted/20",
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
                    {draggingTask && (
                      <div className="mt-1 text-[10px] text-primary/70 font-medium text-center">Drop here</div>
                    )}
                  </DayDroppable>
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
                return (
                  <DayDroppable
                    key={iso}
                    iso={iso}
                    className={cn(
                      "p-2 border-r border-border/30 last:border-r-0 space-y-1 min-h-[360px] transition-colors duration-100",
                      isToday(day) && "bg-primary/5",
                      draggingTask ? "hover:bg-primary/5" : "",
                    )}
                  >
                    {dayTasks.length === 0 && (
                      <div className="h-full flex items-start justify-center pt-8 text-muted-foreground/30 text-xs select-none pointer-events-none">
                        {draggingTask ? "Drop here" : ""}
                      </div>
                    )}
                    {dayTasks.map((task) => (
                      <TaskChip key={task.id} task={task} />
                    ))}
                  </DayDroppable>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Day View ── */}
        {view === "day" && (() => {
          const iso = dayIsoStr(currentDate);
          return (
            <DayDroppable
              iso={iso}
              className={cn(
                "flex-1 glass-card rounded-xl p-5 transition-colors duration-100",
              )}
            >
              <h2 className="font-semibold text-foreground mb-4">{format(currentDate, "EEEE, MMMM d")}</h2>
              {getTasksForDay(currentDate).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  {draggingTask ? "Drop task here to reschedule" : "No tasks scheduled"}
                </div>
              ) : (
                <div className="space-y-2">
                  {getTasksForDay(currentDate).map((task) => (
                    <TaskChip key={task.id} task={task} />
                  ))}
                </div>
              )}
            </DayDroppable>
          );
        })()}

        {/* ── Task Edit Modal ── */}
        <TaskEditModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSuccess={() => utils.tasks.inRange.invalidate()}
        />

        <DragOverlay>
          {draggingTask ? <TaskChipBase task={draggingTask} compact={view === "month"} isOverlay /> : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
