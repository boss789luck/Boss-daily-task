import React from "react";
import { trpc } from "@/lib/trpc";
import { cn, getProjectColor } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  FolderOpen,
  Layers,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

// KPI accent palette
const kpiAccents = [
  { solid: "oklch(0.52 0.26 270)", tint: "oklch(0.52 0.26 270 / 0.08)", text: "oklch(0.42 0.22 270)" },  // violet
  { solid: "oklch(0.72 0.18 70)",  tint: "oklch(0.72 0.18 70  / 0.10)", text: "oklch(0.50 0.18 70)"  },  // amber
  { solid: "oklch(0.62 0.22 25)",  tint: "oklch(0.62 0.22 25  / 0.08)", text: "oklch(0.48 0.20 25)"  },  // coral
  { solid: "oklch(0.58 0.20 145)", tint: "oklch(0.58 0.20 145 / 0.08)", text: "oklch(0.40 0.18 145)" },  // green
];

const priorityDot: Record<string, string> = {
  p0: "oklch(0.62 0.22 25)",
  p1: "oklch(0.72 0.18 70)",
  p2: "oklch(0.52 0.26 270)",
  p3: "oklch(0.70 0.04 255)",
};

export default function Dashboard() {
  const utils = trpc.useUtils();
  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery();
  const { data: todayTasks, isLoading: todayLoading } = trpc.dashboard.todayTasks.useQuery();
  const { data: overdueTasks } = trpc.dashboard.overdueTasks.useQuery();
  const { data: projects } = trpc.projects.list.useQuery();
  const { data: areas } = trpc.areas.list.useQuery();
  const { data: currentBook, isLoading: bookLoading } = trpc.bookSummaries.current.useQuery();
  const toggleDone = trpc.tasks.toggleDone.useMutation({
    onMutate: async ({ id }) => {
      await utils.dashboard.todayTasks.cancel();
      await utils.dashboard.overdueTasks.cancel();
      const prevToday = utils.dashboard.todayTasks.getData();
      const prevOverdue = utils.dashboard.overdueTasks.getData();
      utils.dashboard.todayTasks.setData(undefined, (old) =>
        old?.map((t) => t.id === id ? { ...t, status: t.status === "done" ? "not_started" as const : "done" as const } : t)
      );
      utils.dashboard.overdueTasks.setData(undefined, (old) =>
        old?.map((t) => t.id === id ? { ...t, status: t.status === "done" ? "not_started" as const : "done" as const } : t)
      );
      return { prevToday, prevOverdue };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevToday) utils.dashboard.todayTasks.setData(undefined, ctx.prevToday);
      if (ctx?.prevOverdue) utils.dashboard.overdueTasks.setData(undefined, ctx.prevOverdue);
      toast.error("Failed to update task");
    },
    onSettled: () => {
      utils.dashboard.todayTasks.invalidate();
      utils.dashboard.overdueTasks.invalidate();
      utils.dashboard.stats.invalidate();
      utils.tasks.list.invalidate();
    },
  });

  const kpiCards = [
    { label: "Active Projects", value: stats?.activeProjects ?? 0, sub: `of ${stats?.totalProjects ?? 0} total`, icon: FolderOpen, href: "/projects", accentIdx: 0 },
    { label: "Tasks Due Today",  value: stats?.tasksDueToday ?? 0,  icon: Clock,         href: "/tasks",    accentIdx: 1, urgent: (stats?.tasksDueToday ?? 0) > 0 },
    { label: "Overdue Tasks",    value: stats?.overdueTasks ?? 0,   icon: AlertTriangle, href: "/tasks",    accentIdx: 2, urgent: (stats?.overdueTasks ?? 0) > 0 },
    { label: "Completion Rate",  value: `${stats?.completionRate ?? 0}%`, icon: TrendingUp, href: "/tasks", accentIdx: 3 },
  ];

  const activeProjects = projects?.filter((p) => p.status === "in_progress" || p.status === "planning").slice(0, 5) ?? [];

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8 max-w-7xl mx-auto page-enter">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Good {getGreeting()},{" "}
            <span className="text-gradient">Boss</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1 font-medium">
            {format(new Date(), "EEEE, MMMM d, yyyy")} · Here's your overview
          </p>
        </div>
        <Link href="/tasks">
          <Button size="sm" className="gap-2 rounded-xl bg-primary text-white shadow-md shadow-primary/25 hover:bg-primary/90 font-semibold">
            <Zap className="w-3.5 h-3.5" />
            Today's Focus
          </Button>
        </Link>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 stagger">
        {kpiCards.map((card) => {
          const a = kpiAccents[card.accentIdx];
          const isUrgent = card.urgent;
          return (
            <Link key={card.label} href={card.href}>
              <div
                className="boss-card p-5 cursor-pointer group relative overflow-hidden"
                style={isUrgent ? { borderColor: kpiAccents[card.accentIdx].solid + "50" } : {}}
              >
                {/* Accent top bar */}
                <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl" style={{ background: a.solid }} />

                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: a.tint }}>
                    <card.icon className="w-5 h-5" style={{ color: a.text }} />
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" />
                </div>

                {statsLoading ? (
                  <Skeleton className="h-9 w-20 mb-1" />
                ) : (
                  <div className="text-3xl font-bold tracking-tight" style={{ color: isUrgent ? a.solid : "var(--color-foreground)" }}>
                    {card.value}
                  </div>
                )}
                <div className="text-xs text-muted-foreground font-medium mt-1">{card.label}</div>
                {card.sub && <div className="text-xs text-muted-foreground/50 mt-0.5">{card.sub}</div>}
              </div>
            </Link>
          );
        })}
      </div>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Active Projects */}
        <div className="lg:col-span-2 boss-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.52 0.26 270 / 0.1)" }}>
                <FolderOpen className="w-3.5 h-3.5" style={{ color: "oklch(0.42 0.22 270)" }} />
              </div>
              <h2 className="font-bold text-sm text-foreground">Active Projects</h2>
            </div>
            <Link href="/projects">
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-muted-foreground hover:text-primary rounded-lg">
                View all <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>

          {activeProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: "oklch(0.52 0.26 270 / 0.07)" }}>
                <FolderOpen className="w-6 h-6" style={{ color: "oklch(0.52 0.26 270 / 0.5)" }} />
              </div>
              <p className="text-sm text-muted-foreground font-medium">No active projects yet</p>
              <Link href="/projects">
                <Button variant="ghost" size="sm" className="mt-3 text-xs text-primary hover:text-primary/80">
                  Create your first project →
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {activeProjects.map((project, idx) => {
                const progress = (project.progress ?? 0) * 100;
                const daysLeft = project.deadline
                  ? Math.ceil((new Date(project.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  : null;
                const colors = [
                  "oklch(0.52 0.26 270)", "oklch(0.60 0.22 200)", "oklch(0.58 0.20 145)",
                  "oklch(0.72 0.18 70)", "oklch(0.62 0.22 25)",
                ];
                const barColor = colors[idx % colors.length];
                return (
                  <Link key={project.id} href={`/projects/${project.id}`}>
                    <div className="group p-4 rounded-xl hover:bg-muted/40 transition-all cursor-pointer border border-transparent hover:border-border">
                      <div className="flex items-start justify-between mb-2.5">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                            {project.name}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs font-medium" style={{ color: getHealthColor(project.health) }}>
                              {formatHealth(project.health)}
                            </span>
                            {daysLeft !== null && (
                              <span className="text-xs text-muted-foreground">
                                {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-4">
                          <div className="text-sm font-bold text-foreground">{Math.round(progress)}%</div>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${progress}%`, background: barColor }}
                        />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Today's Tasks */}
        <div className="boss-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.60 0.22 200 / 0.1)" }}>
                <Target className="w-3.5 h-3.5" style={{ color: "oklch(0.42 0.20 200)" }} />
              </div>
              <h2 className="font-bold text-sm text-foreground">Today's Tasks</h2>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "oklch(0.60 0.22 200 / 0.1)", color: "oklch(0.42 0.20 200)" }}>
              {todayTasks?.length ?? 0}
            </span>
          </div>

          {todayLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
          ) : todayTasks?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: "oklch(0.58 0.20 145 / 0.1)" }}>
                <CheckCircle2 className="w-6 h-6" style={{ color: "oklch(0.40 0.18 145)" }} />
              </div>
              <p className="text-sm text-muted-foreground font-medium">All clear for today!</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {todayTasks?.map((task) => {
                const dotColor = priorityDot[task.priority as keyof typeof priorityDot] ?? priorityDot.p2;
                return (
                  <div key={task.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted/40 transition-colors group cursor-pointer">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleDone.mutate({ id: task.id }); }}
                      className={cn(
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-150 active:scale-90",
                        task.status === "done"
                          ? "border-transparent"
                          : "border-muted-foreground/40 hover:border-muted-foreground/70"
                      )}
                      style={task.status === "done" ? { background: dotColor, borderColor: dotColor } : { "--dot": dotColor } as React.CSSProperties}
                      title={task.status === "done" ? "Mark as not done" : "Mark as done"}
                    >
                      {task.status === "done"
                        ? <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                        : <span className="w-1.5 h-1.5 rounded-full" style={{ background: dotColor }} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn("text-xs font-semibold truncate", task.status === "done" ? "line-through text-muted-foreground" : "text-foreground")}>
                          {task.name}
                        </span>
                        {(task as any).projectName && task.projectId && (() => {
                          const clr = getProjectColor(task.projectId);
                          return (
                            <Link
                              href={`/projects/${task.projectId}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                                style={{ background: clr.bg, color: clr.text }}>
                                {(task as any).projectName}
                              </span>
                            </Link>
                          );
                        })()}
                      </div>
                      {task.dueDate && (
                        <div className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                          {format(new Date(task.dueDate), "h:mm a")}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Overdue Tasks ── */}
      {(overdueTasks?.length ?? 0) > 0 && (
        <div className="boss-card p-6" style={{ borderColor: "oklch(0.62 0.22 25 / 0.3)" }}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.62 0.22 25 / 0.1)" }}>
                <AlertTriangle className="w-3.5 h-3.5" style={{ color: "oklch(0.48 0.20 25)" }} />
              </div>
              <h2 className="font-bold text-sm" style={{ color: "oklch(0.48 0.20 25)" }}>Overdue Tasks</h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "oklch(0.62 0.22 25 / 0.1)", color: "oklch(0.48 0.20 25)" }}>
                {overdueTasks?.length}
              </span>
            </div>
            <Link href="/tasks">
              <Button variant="ghost" size="sm" className="text-xs h-7 rounded-lg" style={{ color: "oklch(0.48 0.20 25)" }}>
                View all →
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {overdueTasks?.slice(0, 6).map((task) => {
              const daysOverdue = Math.ceil((Date.now() - new Date(task.dueDate!).getTime()) / (1000 * 60 * 60 * 24));
              return (
                <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl border" style={{ background: "oklch(0.62 0.22 25 / 0.04)", borderColor: "oklch(0.62 0.22 25 / 0.15)" }}>
                  <button
                    onClick={() => toggleDone.mutate({ id: task.id })}
                    className={cn(
                      "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-150 active:scale-90",
                      task.status === "done"
                        ? "border-transparent"
                        : "hover:border-orange-400"
                    )}
                    style={task.status === "done"
                      ? { background: "oklch(0.62 0.22 25)", borderColor: "oklch(0.62 0.22 25)" }
                      : { borderColor: "oklch(0.62 0.22 25 / 0.5)" }}
                    title={task.status === "done" ? "Mark as not done" : "Mark as done"}
                  >
                    {task.status === "done"
                      ? <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                      : <span className="w-1.5 h-1.5 rounded-full" style={{ background: "oklch(0.62 0.22 25)" }} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={cn("text-xs font-semibold truncate", task.status === "done" ? "line-through text-muted-foreground" : "text-foreground")}>{task.name}</div>
                    <div className="text-[10px] font-medium mt-0.5" style={{ color: "oklch(0.62 0.22 25 / 0.7)" }}>{daysOverdue}d overdue</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Book of the Week ── */}
      <div className="boss-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.52 0.22 145 / 0.1)" }}>
              <BookOpen className="w-3.5 h-3.5" style={{ color: "oklch(0.40 0.18 145)" }} />
            </div>
            <h2 className="font-bold text-sm text-foreground">หนังสือประจำสัปดาห์</h2>
          </div>
          <Link href="/books">
            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-muted-foreground hover:text-primary rounded-lg">
              ดูทั้งหมด <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
        {bookLoading ? (
          <div className="flex gap-4">
            <Skeleton className="w-16 h-20 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
            </div>
          </div>
        ) : currentBook ? (
          <div className="flex gap-4 items-start">
            {/* Book cover */}
            <div
              className="w-16 h-20 rounded-xl flex-shrink-0 flex items-center justify-center text-2xl shadow-sm"
              style={{ background: (currentBook.coverColor ?? "#6366f1") + "22", border: `1.5px solid ${currentBook.coverColor ?? "#6366f1"}40` }}
            >
              {currentBook.coverEmoji ?? "📚"}
            </div>
            {/* Book info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "oklch(0.52 0.22 145 / 0.1)", color: "oklch(0.40 0.18 145)" }}
                >
                  {currentBook.genre === "business" ? "ธุรกิจ" :
                   currentBook.genre === "finance" ? "การเงิน" :
                   currentBook.genre === "marketing" ? "การตลาด" :
                   currentBook.genre === "psychology" ? "จิตวิทยา" :
                   currentBook.genre === "philosophy" ? "ปรัชญา" :
                   currentBook.genre === "religion" ? "ศาสนา" :
                   currentBook.genre === "management" ? "การบริหาร" : currentBook.genre}
                </span>
                {currentBook.isRead && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "oklch(0.52 0.26 270 / 0.1)", color: "oklch(0.42 0.22 270)" }}>
                    ✓ อ่านแล้ว
                  </span>
                )}
              </div>
              <div className="font-bold text-sm text-foreground leading-tight mb-0.5 line-clamp-2">{currentBook.title}</div>
              <div className="text-xs text-muted-foreground mb-2">{currentBook.author}</div>
              {/* Key lessons preview — 2 items */}
              {(() => {
                try {
                  const lessons: string[] = JSON.parse(currentBook.keyLessons);
                  return (
                    <div className="space-y-1 mb-3">
                      {lessons.slice(0, 2).map((lesson, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <span className="text-[10px] font-bold mt-0.5 flex-shrink-0" style={{ color: "oklch(0.40 0.18 145)" }}>✦</span>
                          <span className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{lesson}</span>
                        </div>
                      ))}
                    </div>
                  );
                } catch { return null; }
              })()}
              <Link href="/books">
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1.5 rounded-lg"
                  style={{ background: "oklch(0.40 0.18 145)", color: "white" }}
                >
                  <BookOpen className="w-3 h-3" />
                  {currentBook.isRead ? "อ่านอีกครั้ง" : "อ่านต่อ →"}
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: "oklch(0.52 0.22 145 / 0.07)" }}>
              <Sparkles className="w-5 h-5" style={{ color: "oklch(0.52 0.22 145 / 0.5)" }} />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">ยังไม่มีหนังสือสัปดาห์นี้</p>
            <p className="text-xs text-muted-foreground mb-4">AI จะสร้างให้อัตโนมัติทุกวันจันทร์</p>
            <Link href="/books">
              <Button size="sm" className="h-7 text-xs gap-1.5 rounded-lg" style={{ background: "oklch(0.40 0.18 145)", color: "white" }}>
                <Sparkles className="w-3 h-3" />
                สร้างหนังสือเลย
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* ── Areas Overview ── */}
      {(areas?.length ?? 0) > 0 && (
        <div className="boss-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.52 0.26 270 / 0.08)" }}>
                <Layers className="w-3.5 h-3.5" style={{ color: "oklch(0.42 0.22 270)" }} />
              </div>
              <h2 className="font-bold text-sm text-foreground">Areas</h2>
            </div>
            <Link href="/areas">
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-muted-foreground hover:text-primary rounded-lg">
                Manage <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {areas?.map((area) => (
              <Link key={area.id} href={`/areas/${area.id}`}>
                <div className="boss-card p-4 cursor-pointer group text-center hover:shadow-md transition-all">
                  <div
                    className="w-10 h-10 rounded-xl mx-auto mb-2.5 flex items-center justify-center text-base font-bold"
                    style={{ backgroundColor: `${area.color}18`, border: `1.5px solid ${area.color}35`, color: area.color ?? undefined }}
                  >
                    {area.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {area.name}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function getHealthColor(health: string | null) {
  const map: Record<string, string> = {
    on_track: "oklch(0.40 0.18 145)",
    at_risk:  "oklch(0.50 0.18 70)",
    delayed:  "oklch(0.55 0.20 50)",
    critical: "oklch(0.48 0.20 25)",
  };
  return map[health ?? "on_track"] ?? "oklch(0.52 0.016 255)";
}

function formatHealth(health: string | null) {
  const map: Record<string, string> = {
    on_track: "On Track",
    at_risk:  "At Risk",
    delayed:  "Delayed",
    critical: "Critical",
  };
  return map[health ?? "on_track"] ?? "Unknown";
}
