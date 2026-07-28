import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { BarChart3, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, differenceInDays, addDays, isSameDay, isToday } from "date-fns";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const STATUS_COLORS: Record<string, string> = {
  not_started: "bg-slate-500/60", planning: "bg-purple-500/60", in_progress: "bg-blue-500/70",
  waiting: "bg-yellow-500/60", blocked: "bg-red-500/70", on_hold: "bg-orange-500/60",
  completed: "bg-emerald-500/70", archived: "bg-slate-600/40",
};

const HEALTH_COLORS: Record<string, string> = {
  on_track: "border-emerald-400/50", at_risk: "border-yellow-400/50",
  delayed: "border-orange-400/50", critical: "border-red-400/50",
};

export default function TimelinePage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { data: projects } = trpc.projects.list.useQuery();
  const { data: areas } = trpc.areas.list.useQuery();

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = differenceInDays(monthEnd, monthStart) + 1;

  const days = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < daysInMonth; i++) arr.push(addDays(monthStart, i));
    return arr;
  }, [monthStart, daysInMonth]);

  const projectsWithDates = useMemo(() => {
    return (projects ?? []).filter((p) => p.startDate || p.deadline).map((p) => {
      const start = p.startDate ? new Date(p.startDate) : monthStart;
      const end = p.deadline ? new Date(p.deadline) : monthEnd;
      const area = areas?.find((a) => a.id === p.areaId);
      return { ...p, startDate: start, deadline: end, area };
    });
  }, [projects, areas, monthStart, monthEnd]);

  const getBarStyle = (project: typeof projectsWithDates[0]) => {
    const clampedStart = project.startDate < monthStart ? monthStart : project.startDate;
    const clampedEnd = project.deadline > monthEnd ? monthEnd : project.deadline;
    if (clampedStart > monthEnd || clampedEnd < monthStart) return null;
    const startOffset = differenceInDays(clampedStart, monthStart);
    const duration = differenceInDays(clampedEnd, clampedStart) + 1;
    const width = Math.max((duration / daysInMonth) * 100, 2);
    const left = (startOffset / daysInMonth) * 100;
    return { left: `${left}%`, width: `${width}%` };
  };

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Timeline</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium text-foreground min-w-[120px] text-center">
            {format(currentMonth, "MMMM yyyy")}
          </span>
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setCurrentMonth(new Date())}>Today</Button>
        </div>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        {/* Day headers */}
        <div className="flex border-b border-border sticky top-0 bg-card z-10">
          <div className="w-48 flex-shrink-0 px-4 py-2 text-xs font-semibold text-muted-foreground border-r border-border">Project</div>
          <div className="flex-1 relative">
            <div className="flex">
              {days.map((day) => (
                <div key={day.toISOString()} className={cn("flex-1 py-2 text-center text-[10px] font-medium border-r border-border/30 last:border-r-0", isToday(day) ? "text-primary bg-primary/5" : "text-muted-foreground")}>
                  <div>{format(day, "d")}</div>
                  {day.getDate() === 1 || day.getDay() === 0 ? <div className="text-[9px] opacity-60">{format(day, "EEE")}</div> : null}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Today line */}
        <div className="relative">
          {projectsWithDates.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              No projects with dates to display. Add start dates and deadlines to your projects.
            </div>
          ) : (
            projectsWithDates.map((project) => {
              const barStyle = getBarStyle(project);
              const statusColor = STATUS_COLORS[project.status] ?? "bg-slate-500/60";
              const healthBorder = HEALTH_COLORS[project.health ?? "on_track"] ?? "border-emerald-400/50";
              const progress = (project.progress ?? 0) * 100;

              return (
                <div key={project.id} className="flex border-b border-border/30 hover:bg-muted/10 transition-colors group">
                  {/* Project name */}
                  <div className="w-48 flex-shrink-0 px-4 py-3 border-r border-border/30">
                    <div className="text-xs font-medium text-foreground truncate">{project.name}</div>
                    {project.area && (
                      <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <span style={{ color: project.area.color ?? "#6366f1" }}>{project.area.icon ?? "◆"}</span>
                        {project.area.name}
                      </div>
                    )}
                  </div>

                  {/* Gantt bar */}
                  <div className="flex-1 relative py-3 min-h-[48px]">
                    {/* Today marker */}
                    {(() => {
                      const todayOffset = differenceInDays(new Date(), monthStart);
                      if (todayOffset >= 0 && todayOffset < daysInMonth) {
                        return (
                          <div
                            className="absolute top-0 bottom-0 w-px bg-primary/40 z-10 pointer-events-none"
                            style={{ left: `${((todayOffset + 0.5) / daysInMonth) * 100}%` }}
                          />
                        );
                      }
                      return null;
                    })()}

                    {barStyle && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={cn("absolute top-1/2 -translate-y-1/2 h-7 rounded-lg border cursor-pointer hover:brightness-110 transition-all overflow-hidden", statusColor, healthBorder)}
                            style={barStyle}
                          >
                            {/* Progress fill */}
                            <div
                              className="absolute inset-y-0 left-0 bg-white/10 rounded-l-lg"
                              style={{ width: `${progress}%` }}
                            />
                            <div className="relative px-2 h-full flex items-center">
                              <span className="text-[10px] font-medium text-white/90 truncate">{project.name}</span>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="space-y-1">
                            <div className="font-semibold text-sm">{project.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {format(project.startDate, "MMM d")} → {format(project.deadline, "MMM d, yyyy")}
                            </div>
                            <div className="text-xs">Progress: {Math.round(progress)}%</div>
                            <div className="text-xs capitalize">{project.status.replace(/_/g, " ")}</div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 flex-wrap">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={cn("w-3 h-3 rounded", color)} />
            <span className="text-[10px] text-muted-foreground capitalize">{status.replace(/_/g, " ")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
