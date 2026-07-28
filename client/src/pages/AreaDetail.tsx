import { trpc } from "@/lib/trpc";
import { useParams, Link } from "wouter";
import { ArrowLeft, FolderOpen, Target, Plus, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInDays } from "date-fns";

const STATUS_CFG: Record<string, { label: string; solid: string; tint: string }> = {
  not_started: { label: "Not Started", solid: "oklch(0.65 0.04 255)", tint: "oklch(0.65 0.04 255 / 0.08)" },
  planning:    { label: "Planning",    solid: "oklch(0.60 0.22 300)", tint: "oklch(0.60 0.22 300 / 0.1)" },
  in_progress: { label: "In Progress", solid: "oklch(0.52 0.26 270)", tint: "oklch(0.52 0.26 270 / 0.1)" },
  waiting:     { label: "Waiting",     solid: "oklch(0.72 0.18 70)",  tint: "oklch(0.72 0.18 70  / 0.1)" },
  blocked:     { label: "Blocked",     solid: "oklch(0.62 0.22 25)",  tint: "oklch(0.62 0.22 25  / 0.1)" },
  on_hold:     { label: "On Hold",     solid: "oklch(0.65 0.18 50)",  tint: "oklch(0.65 0.18 50  / 0.1)" },
  completed:   { label: "Completed",   solid: "oklch(0.58 0.20 145)", tint: "oklch(0.58 0.20 145 / 0.1)" },
  archived:    { label: "Archived",    solid: "oklch(0.55 0.02 255)", tint: "oklch(0.55 0.02 255 / 0.08)" },
};

const PRIORITY_CFG: Record<string, { label: string; solid: string; tint: string }> = {
  p0: { label: "Critical", solid: "oklch(0.62 0.22 25)",  tint: "oklch(0.62 0.22 25  / 0.08)" },
  p1: { label: "High",     solid: "oklch(0.72 0.18 70)",  tint: "oklch(0.72 0.18 70  / 0.1)" },
  p2: { label: "Medium",   solid: "oklch(0.52 0.26 270)", tint: "oklch(0.52 0.26 270 / 0.08)" },
  p3: { label: "Low",      solid: "oklch(0.65 0.04 255)", tint: "oklch(0.65 0.04 255 / 0.06)" },
};

const BAR_COLORS = [
  "oklch(0.52 0.26 270)", "oklch(0.60 0.22 200)", "oklch(0.58 0.20 145)",
  "oklch(0.72 0.18 70)", "oklch(0.62 0.22 25)", "oklch(0.60 0.22 340)",
];

export default function AreaDetailPage() {
  const params = useParams<{ id: string }>();
  const areaId = parseInt(params.id ?? "0");
  const { data: area, isLoading } = trpc.areas.byId.useQuery({ id: areaId });
  const { data: projects } = trpc.projects.list.useQuery({ areaId });
  const { data: tasks } = trpc.tasks.list.useQuery({ areaId });

  if (isLoading) return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto page-enter">
      <Skeleton className="h-14 w-80 rounded-2xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      <Skeleton className="h-48 rounded-2xl" />
    </div>
  );
  if (!area) return <div className="p-6 text-muted-foreground">Area not found</div>;

  const color = area.color ?? "#6366f1";
  const openTasks = tasks?.filter((t) => t.status !== "done" && t.status !== "cancelled") ?? [];
  const completedTasks = tasks?.filter((t) => t.status === "done") ?? [];

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto space-y-4 md:space-y-6 page-enter">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Link href="/areas">
          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-xl hover:bg-muted/50">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-lg flex-shrink-0 shadow-sm"
          style={{ background: `${color}15`, border: `1.5px solid ${color}30` }}>
          <span style={{ color }}>{area.icon ?? "◆"}</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">{area.name}</h1>
          {area.description && <p className="text-muted-foreground text-sm mt-0.5">{area.description}</p>}
        </div>
        {/* Color accent bar */}
        <div className="ml-auto h-1 w-16 rounded-full" style={{ background: `linear-gradient(90deg, ${color}, ${color}60)` }} />
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        {[
          { label: "Projects", value: projects?.length ?? 0, color: "oklch(0.52 0.26 270)", tint: "oklch(0.52 0.26 270 / 0.08)" },
          { label: "Open Tasks", value: openTasks.length, color: "oklch(0.72 0.18 70)", tint: "oklch(0.72 0.18 70 / 0.08)" },
          { label: "Completed", value: completedTasks.length, color: "oklch(0.58 0.20 145)", tint: "oklch(0.58 0.20 145 / 0.08)" },
        ].map(({ label, value, color: c, tint }) => (
          <div key={label} className="boss-card p-5 text-center">
            <div className="text-2xl font-bold mb-1" style={{ color: c }}>{value}</div>
            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">{label}</div>
            <div className="mt-3 h-1 rounded-full mx-auto w-8" style={{ background: tint.replace("0.08", "0.4") }} />
          </div>
        ))}
      </div>

      {/* ── Projects ── */}
      <div className="boss-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-sm flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.52 0.26 270 / 0.1)" }}>
              <FolderOpen className="w-3.5 h-3.5" style={{ color: "oklch(0.42 0.22 270)" }} />
            </div>
            Projects
          </h2>
          <Link href="/projects">
            <Button size="sm" variant="ghost" className="gap-1 text-xs h-7 rounded-xl">
              <Plus className="w-3 h-3" /> New Project
            </Button>
          </Link>
        </div>
        {!projects?.length ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground text-sm">No projects in this area yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map((p, idx) => {
              const sCfg = STATUS_CFG[p.status] ?? STATUS_CFG.not_started;
              const barColor = BAR_COLORS[idx % BAR_COLORS.length];
              const daysLeft = p.deadline ? differenceInDays(new Date(p.deadline), new Date()) : null;
              return (
                <Link key={p.id} href={`/projects/${p.id}`}>
                  <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/30 transition-colors cursor-pointer group">
                    <div className="w-1 rounded-full self-stretch flex-shrink-0" style={{ background: barColor, opacity: 0.7, minHeight: "2rem" }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">{p.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
                          style={{ background: sCfg.tint, color: sCfg.solid }}>
                          {sCfg.label}
                        </span>
                        {daysLeft !== null && (
                          <span className="text-[11px] font-medium flex items-center gap-1"
                            style={{ color: daysLeft < 0 ? "oklch(0.62 0.22 25)" : daysLeft <= 7 ? "oklch(0.72 0.18 70)" : "oklch(0.55 0.016 255)" }}>
                            <CalendarDays className="w-3 h-3" />
                            {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-bold text-foreground">{Math.round((p.progress ?? 0) * 100)}%</span>
                      <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(p.progress ?? 0) * 100}%`, background: barColor }} />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Open Tasks ── */}
      <div className="boss-card p-5">
        <h2 className="font-bold text-sm flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.72 0.18 70 / 0.1)" }}>
            <Target className="w-3.5 h-3.5" style={{ color: "oklch(0.55 0.18 70)" }} />
          </div>
          Open Tasks
          <span className="ml-auto text-xs font-normal text-muted-foreground">{openTasks.length} tasks</span>
        </h2>
        {openTasks.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground text-sm">No open tasks in this area</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {openTasks.slice(0, 12).map((task) => {
              const pCfg = PRIORITY_CFG[task.priority ?? "p2"] ?? PRIORITY_CFG.p2;
              return (
                <div key={task.id} className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-muted/20 transition-colors">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: pCfg.solid }} />
                  <span className="text-sm text-foreground flex-1 truncate font-medium">{task.name}</span>
                  {task.priority && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{ background: pCfg.tint, color: pCfg.solid }}>
                      {pCfg.label}
                    </span>
                  )}
                  {task.dueDate && (
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {format(new Date(task.dueDate), "MMM d")}
                    </span>
                  )}
                </div>
              );
            })}
            {openTasks.length > 12 && (
              <p className="text-xs text-muted-foreground text-center pt-2">+{openTasks.length - 12} more tasks</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
