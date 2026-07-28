import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { RefreshCw, CheckCircle2, AlertTriangle, TrendingUp, Target, ChevronRight, Lightbulb, Calendar, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState, useMemo } from "react";
import { format, startOfWeek, endOfWeek, subWeeks, addWeeks, isWithinInterval, isPast, addDays } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const NEXT_WEEK_PROMPTS = [
  "What are the 3 most important outcomes you want to achieve next week?",
  "Which project needs the most attention next week?",
  "Is there anything you've been avoiding that needs to be addressed?",
  "Who do you need to follow up with or collaborate with?",
  "What can you delegate or eliminate to focus on high-impact work?",
  "What habits or routines will support your goals next week?",
  "Are there any upcoming deadlines you need to prepare for?",
  "What would make next week a success?",
];

export default function WeeklyReviewPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [reflections, setReflections] = useState<Record<string, string>>({});

  const weekStart = useMemo(() => startOfWeek(weekOffset === 0 ? new Date() : weekOffset < 0 ? subWeeks(new Date(), Math.abs(weekOffset)) : addWeeks(new Date(), weekOffset)), [weekOffset]);
  const weekEnd = useMemo(() => endOfWeek(weekStart), [weekStart]);

  const { data: tasks } = trpc.tasks.list.useQuery({ parentTaskId: null });
  const { data: projects } = trpc.projects.list.useQuery();

  const weekStats = useMemo(() => {
    if (!tasks) return { completed: [], overdue: [], upcoming: [], assignedToday: [] };
    const completed = tasks.filter((t) => t.status === "done" && t.updatedAt && isWithinInterval(new Date(t.updatedAt), { start: weekStart, end: weekEnd }));
    const overdue = tasks.filter((t) => t.dueDate && isPast(new Date(t.dueDate)) && t.status !== "done" && t.status !== "cancelled");
    const nextWeekStart = addDays(weekEnd, 1);
    const nextWeekEnd = addDays(weekEnd, 7);
    const upcoming = tasks.filter((t) => t.dueDate && isWithinInterval(new Date(t.dueDate), { start: nextWeekStart, end: nextWeekEnd }) && t.status !== "done");
    const assignedToday = tasks.filter((t) => t.assignToday && t.status !== "done");
    return { completed, overdue, upcoming, assignedToday };
  }, [tasks, weekStart, weekEnd]);

  const projectStats = useMemo(() => {
    if (!projects) return { active: [], atRisk: [], completed: [] };
    const active = projects.filter((p) => p.status === "in_progress");
    const atRisk = projects.filter((p) => p.health === "at_risk" || p.health === "delayed" || p.health === "critical");
    const completed = projects.filter((p) => p.status === "completed" && p.updatedAt && isWithinInterval(new Date(p.updatedAt), { start: weekStart, end: weekEnd }));
    return { active, atRisk, completed };
  }, [projects, weekStart, weekEnd]);

  const completionRate = tasks ? Math.round((weekStats.completed.length / Math.max(tasks.filter((t) => t.status !== "cancelled").length, 1)) * 100) : 0;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-primary" /> Weekly Review
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setWeekOffset(w => w - 1)}>← Prev</Button>
          <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setWeekOffset(0)}>This Week</Button>
          <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setWeekOffset(w => w + 1)}>Next →</Button>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Completed", value: weekStats.completed.length, color: "text-emerald-400", bg: "bg-emerald-400/10", icon: CheckCircle2 },
          { label: "Overdue", value: weekStats.overdue.length, color: weekStats.overdue.length > 0 ? "text-red-400" : "text-slate-400", bg: weekStats.overdue.length > 0 ? "bg-red-400/10" : "bg-slate-400/10", icon: AlertTriangle },
          { label: "Upcoming", value: weekStats.upcoming.length, color: "text-blue-400", bg: "bg-blue-400/10", icon: Calendar },
          { label: "Completion %", value: `${completionRate}%`, color: "text-primary", bg: "bg-primary/10", icon: TrendingUp },
        ].map((stat) => (
          <div key={stat.label} className="glass-card rounded-xl p-4">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2", stat.bg)}>
              <stat.icon className={cn("w-4 h-4", stat.color)} />
            </div>
            <div className={cn("text-2xl font-bold", stat.color)}>{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Completed Tasks */}
      <div className="glass-card rounded-xl p-5">
        <h2 className="font-semibold text-sm flex items-center gap-2 mb-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-emerald-400">Completed This Week</span>
          <Badge className="bg-emerald-400/10 text-emerald-400 border-emerald-400/30 text-xs">{weekStats.completed.length}</Badge>
        </h2>
        {weekStats.completed.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">No tasks completed this week yet</p>
        ) : (
          <div className="space-y-1.5">
            {weekStats.completed.map((task) => (
              <div key={task.id} className="flex items-center gap-2 p-2 rounded-lg bg-emerald-400/5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span className="text-sm text-foreground/80 line-through">{task.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Overdue */}
      {weekStats.overdue.length > 0 && (
        <div className="glass-card rounded-xl p-5 border border-red-400/20">
          <h2 className="font-semibold text-sm flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-red-400">Needs Attention</span>
            <Badge className="bg-red-400/10 text-red-400 border-red-400/30 text-xs">{weekStats.overdue.length}</Badge>
          </h2>
          <div className="space-y-1.5">
            {weekStats.overdue.map((task) => (
              <div key={task.id} className="flex items-center gap-2 p-2 rounded-lg bg-red-400/5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <span className="text-sm text-foreground flex-1">{task.name}</span>
                {task.dueDate && <span className="text-xs text-red-400/70 flex-shrink-0">{format(new Date(task.dueDate), "MMM d")}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Projects at Risk */}
      {projectStats.atRisk.length > 0 && (
        <div className="glass-card rounded-xl p-5 border border-yellow-400/20">
          <h2 className="font-semibold text-sm flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-yellow-400" />
            <span className="text-yellow-400">Projects at Risk</span>
          </h2>
          <div className="space-y-3">
            {projectStats.atRisk.map((p) => (
              <div key={p.id} className="p-3 rounded-lg bg-yellow-400/5 border border-yellow-400/15">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-foreground">{p.name}</span>
                  <Badge className={cn("text-[10px]", p.health === "critical" ? "bg-red-400/10 text-red-400 border-red-400/30" : "bg-yellow-400/10 text-yellow-400 border-yellow-400/30")}>
                    {p.health?.replace(/_/g, " ")}
                  </Badge>
                </div>
                <Progress value={(p.progress ?? 0) * 100} className="h-1.5" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Next Week */}
      <div className="glass-card rounded-xl p-5">
        <h2 className="font-semibold text-sm flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-blue-400" />
          <span className="text-blue-400">Coming Up Next Week</span>
          <Badge className="bg-blue-400/10 text-blue-400 border-blue-400/30 text-xs">{weekStats.upcoming.length}</Badge>
        </h2>
        {weekStats.upcoming.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">Nothing scheduled for next week yet</p>
        ) : (
          <div className="space-y-1.5">
            {weekStats.upcoming.map((task) => (
              <div key={task.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/20 transition-colors">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                <span className="text-sm text-foreground flex-1">{task.name}</span>
                {task.dueDate && <span className="text-xs text-muted-foreground">{format(new Date(task.dueDate), "EEE, MMM d")}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Next Week Planning Prompts */}
      <div className="glass-card rounded-xl p-5">
        <h2 className="font-semibold text-sm flex items-center gap-2 mb-5">
          <Lightbulb className="w-4 h-4 text-yellow-400" />
          <span>Next Week Planning</span>
          <span className="text-xs text-muted-foreground font-normal">— Reflect and set intentions</span>
        </h2>
        <div className="space-y-5">
          {NEXT_WEEK_PROMPTS.map((prompt, i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</div>
                <p className="text-sm text-foreground/80 font-medium">{prompt}</p>
              </div>
              <Textarea
                placeholder="Your thoughts..."
                value={reflections[`prompt_${i}`] ?? ""}
                onChange={(e) => setReflections({ ...reflections, [`prompt_${i}`]: e.target.value })}
                className="bg-input border-border resize-none text-sm ml-7"
                rows={2}
              />
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <Button size="sm" className="gap-2" onClick={() => toast.success("Review saved! Great work planning ahead.")}>
            <Star className="w-3.5 h-3.5" />
            Save Review
          </Button>
        </div>
      </div>
    </div>
  );
}
