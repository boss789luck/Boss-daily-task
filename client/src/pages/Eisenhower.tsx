import { trpc } from "@/lib/trpc";
import { invalidateTaskDomain } from "@/lib/queryHelpers";
import { cn } from "@/lib/utils";
import { Grid3X3, CheckCircle2, Circle, Zap, Clock, Trash2, Users, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";

const QUADRANTS = [
  {
    id: "do_first",
    title: "Do First",
    subtitle: "Urgent & Important",
    icon: Zap,
    color: "text-red-400",
    bg: "bg-red-400/5",
    border: "border-red-400/20",
    headerBg: "bg-red-400/10",
    dot: "bg-red-400",
    description: "Critical tasks requiring immediate attention",
  },
  {
    id: "schedule",
    title: "Schedule",
    subtitle: "Not Urgent & Important",
    icon: Clock,
    color: "text-blue-400",
    bg: "bg-blue-400/5",
    border: "border-blue-400/20",
    headerBg: "bg-blue-400/10",
    dot: "bg-blue-400",
    description: "Strategic work to plan for later",
  },
  {
    id: "delegate",
    title: "Delegate",
    subtitle: "Urgent & Not Important",
    icon: Users,
    color: "text-yellow-400",
    bg: "bg-yellow-400/5",
    border: "border-yellow-400/20",
    headerBg: "bg-yellow-400/10",
    dot: "bg-yellow-400",
    description: "Tasks others can handle",
  },
  {
    id: "eliminate",
    title: "Eliminate",
    subtitle: "Not Urgent & Not Important",
    icon: Trash2,
    color: "text-slate-400",
    bg: "bg-slate-400/5",
    border: "border-slate-400/20",
    headerBg: "bg-slate-400/10",
    dot: "bg-slate-400",
    description: "Low-value distractions to remove",
  },
];

// ─── Inline date edit popover ─────────────────────────────────────────────────
function DateEditPopover({ taskId, currentDate, onSave }: {
  taskId: number;
  currentDate: Date | null | undefined;
  onSave: (taskId: number, date: Date | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Date | undefined>(
    currentDate ? new Date(currentDate) : undefined
  );

  const handleSelect = (date: Date | undefined) => {
    setSelected(date);
    if (date) {
      onSave(taskId, date);
      setOpen(false);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected(undefined);
    onSave(taskId, null);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/50 hover:text-primary hover:bg-primary/10 transition-all flex-shrink-0"
          title="Edit due date"
        >
          <Pencil className="w-3 h-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 shadow-lg"
        align="end"
        side="bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-2 border-b flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">Edit Due Date</span>
          {selected && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors px-1.5 py-0.5 rounded hover:bg-destructive/10"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          initialFocus
          className="p-2"
        />
      </PopoverContent>
    </Popover>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function EisenhowerPage() {
  const { data: tasks } = trpc.tasks.list.useQuery({ parentTaskId: null });
  const utils = trpc.useUtils();

  const toggleDone = trpc.tasks.toggleDone.useMutation({
    onSuccess: () => invalidateTaskDomain(utils),
  });

  const updateTask = trpc.tasks.update.useMutation({
    onSuccess: () => { invalidateTaskDomain(utils); },
    onError: () => toast.error("Failed to update task"),
  });

  const quadrantTasks = useMemo(() => {
    const openTasks = (tasks ?? []).filter((t) => t.status !== "done" && t.status !== "cancelled");
    return {
      do_first: openTasks.filter((t) => t.eisenhowerQuadrant === "do_first" || ((t.urgency ?? 3) >= 4 && (t.impact ?? 3) >= 4 && !t.eisenhowerQuadrant)),
      schedule: openTasks.filter((t) => t.eisenhowerQuadrant === "schedule" || ((t.urgency ?? 3) < 4 && (t.impact ?? 3) >= 4 && !t.eisenhowerQuadrant)),
      delegate: openTasks.filter((t) => t.eisenhowerQuadrant === "delegate" || ((t.urgency ?? 3) >= 4 && (t.impact ?? 3) < 4 && !t.eisenhowerQuadrant)),
      eliminate: openTasks.filter((t) => t.eisenhowerQuadrant === "eliminate" || ((t.urgency ?? 3) < 4 && (t.impact ?? 3) < 4 && !t.eisenhowerQuadrant && t.eisenhowerQuadrant !== null)),
    };
  }, [tasks]);

  const moveToQuadrant = (taskId: number, quadrant: string) => {
    updateTask.mutate({ id: taskId, data: { eisenhowerQuadrant: quadrant as any } });
  };

  const updateDueDate = (taskId: number, date: Date | null) => {
    // Optimistic update — cast to any to avoid string/Date mismatch in cache
    utils.tasks.list.setData({ parentTaskId: null }, (old) =>
      old?.map((t) => t.id === taskId ? { ...t, dueDate: date as any } : t)
    );
    updateTask.mutate(
      { id: taskId, data: { dueDate: date } },
      {
        onSuccess: () => toast.success(date ? `Due date set to ${format(date, "MMM d, yyyy")}` : "Due date cleared"),
        onError: () => {
          // Rollback on error
          invalidateTaskDomain(utils);
          toast.error("Failed to update due date");
        },
      }
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Grid3X3 className="w-5 h-5 text-primary" />
        <div>
          <h1 className="text-xl font-bold text-foreground">Priority Matrix</h1>
          <p className="text-muted-foreground text-sm">Eisenhower Matrix — Prioritize by urgency and importance</p>
        </div>
      </div>

      {/* Axis labels */}
      <div className="relative">
        <div className="flex items-center justify-center mb-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">← Not Urgent · · · · · Urgent →</div>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center justify-center w-6 flex-shrink-0">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest -rotate-90 whitespace-nowrap">← Not Important · Important →</div>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-4">
            {QUADRANTS.map((q) => {
              const qTasks = quadrantTasks[q.id as keyof typeof quadrantTasks] ?? [];
              return (
                <div key={q.id} className={cn("glass-card rounded-xl overflow-hidden border", q.border)}>
                  {/* Header */}
                  <div className={cn("px-4 py-3 border-b", q.headerBg, q.border.replace("border-", "border-b-"))}>
                    <div className="flex items-center gap-2">
                      <q.icon className={cn("w-4 h-4", q.color)} />
                      <div>
                        <div className={cn("text-sm font-bold", q.color)}>{q.title}</div>
                        <div className="text-[10px] text-muted-foreground">{q.subtitle}</div>
                      </div>
                      <div className={cn("ml-auto w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold", q.bg, q.color)}>
                        {qTasks.length}
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{q.description}</p>
                  </div>

                  {/* Tasks */}
                  <div className={cn("p-3 min-h-[200px] space-y-1.5", q.bg)}>
                    {qTasks.length === 0 ? (
                      <div className="flex items-center justify-center h-32 text-center">
                        <p className="text-xs text-muted-foreground/50">No tasks here</p>
                      </div>
                    ) : (
                      qTasks.map((task) => (
                        <div
                          key={task.id}
                          className={cn("flex items-start gap-2 p-2.5 rounded-lg bg-background/50 border border-border/30 hover:border-border/60 transition-all group cursor-pointer")}
                        >
                          {/* Done toggle */}
                          <button
                            onClick={() => toggleDone.mutate({ id: task.id })}
                            className="flex-shrink-0 mt-0.5"
                          >
                            <Circle className="w-3.5 h-3.5 text-muted-foreground/50 hover:text-primary transition-colors" />
                          </button>

                          {/* Task info */}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-foreground truncate">{task.name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {task.dueDate ? (
                                <span className="text-[10px] text-muted-foreground">
                                  {format(new Date(task.dueDate), "MMM d")}
                                </span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground/40 italic">No date</span>
                              )}
                              <span className="text-[10px] text-muted-foreground">U:{task.urgency} I:{task.impact}</span>
                            </div>
                          </div>

                          {/* Actions: pencil + move buttons (show on hover) */}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            {/* Pencil — edit due date */}
                            <DateEditPopover
                              taskId={task.id}
                              currentDate={task.dueDate ? new Date(task.dueDate) : null}
                              onSave={updateDueDate}
                            />
                            {/* Move to quadrant buttons */}
                            {QUADRANTS.filter((oq) => oq.id !== q.id).map((oq) => (
                              <button
                                key={oq.id}
                                onClick={() => moveToQuadrant(task.id, oq.id)}
                                className={cn("w-4 h-4 rounded text-[8px] font-bold flex items-center justify-center transition-colors", oq.bg, oq.color)}
                                title={`Move to ${oq.title}`}
                              >
                                {oq.title[0]}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 glass-card rounded-xl p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">How tasks are classified</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {QUADRANTS.map((q) => (
            <div key={q.id} className="flex items-start gap-2">
              <div className={cn("w-2 h-2 rounded-full mt-1 flex-shrink-0", q.dot)} />
              <div>
                <div className={cn("text-xs font-semibold", q.color)}>{q.title}</div>
                <div className="text-[10px] text-muted-foreground">{q.subtitle}</div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground/60 mt-3">
          Tasks are auto-classified based on Urgency (≥4 = Urgent) and Impact (≥4 = Important) scores from the Priority Engine. You can also manually move tasks between quadrants.
        </p>
      </div>
    </div>
  );
}
