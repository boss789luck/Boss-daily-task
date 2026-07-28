import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Calendar,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Unlink,
  ExternalLink,
  Info,
  ChevronRight,
  Loader2,
  CalendarCheck,
  CalendarDays,
  Zap,
  Shield,
  ArrowRight,
} from "lucide-react";

export default function CalendarSettings() {
  const [location] = useLocation();
  const [manualTasksId, setManualTasksId] = useState("");
  const [manualProjectsId, setManualProjectsId] = useState("");
  const [useManualInput, setUseManualInput] = useState(false);

  const utils = trpc.useUtils();

  // Fetch current settings
  const { data: settings, isLoading: settingsLoading } = trpc.googleCalendar.getSettings.useQuery();

  // Fetch user's calendar list (only works when connected)
  const { data: calendars, isLoading: calendarsLoading } = trpc.googleCalendar.listCalendars.useQuery(
    undefined,
    { enabled: !!settings?.connected }
  );

  // Mutations
  const saveSettings = trpc.googleCalendar.saveSettings.useMutation({
    onSuccess: () => {
      toast.success("Settings saved");
      utils.googleCalendar.getSettings.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const disconnect = trpc.googleCalendar.disconnect.useMutation({
    onSuccess: () => {
      toast.success("Disconnected from Google Calendar");
      utils.googleCalendar.getSettings.invalidate();
      utils.googleCalendar.listCalendars.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const [cleanupLoading, setCleanupLoading] = useState(false);

  const handleCleanupSync = async () => {
    if (!confirm("This will DELETE all BOSS events from Google Calendar and re-sync only active (non-done) tasks. Continue?")) return;
    setCleanupLoading(true);
    try {
      const resp = await fetch("/api/google/cleanup-sync", { method: "POST" });
      const data = await resp.json();
      if (data.ok) {
        toast.success(`Cleanup done — deleted ${data.deleted} events, re-synced ${data.resynced} active tasks`);
        utils.googleCalendar.getSettings.invalidate();
      } else {
        toast.error(data.error ?? "Cleanup failed");
      }
    } catch (e) {
      toast.error("Cleanup request failed");
    } finally {
      setCleanupLoading(false);
    }
  };

  const pullSync = trpc.googleCalendar.pullSync.useMutation({
    onSuccess: (data) => {
      const parts: string[] = [];
      if (data.updated > 0) parts.push(`${data.updated} date change${data.updated > 1 ? "s" : ""}`);
      if (data.deleted > 0) parts.push(`${data.deleted} task${data.deleted > 1 ? "s" : ""} deleted (removed in GCal)`);
      if (parts.length > 0) {
        toast.success(`↓ Pulled from Google Calendar: ${parts.join(", ")}`);
        utils.tasks.list.invalidate();
        utils.tasks.inRange.invalidate();
        utils.dashboard.stats.invalidate();
        utils.dashboard.todayTasks.invalidate();
        utils.dashboard.overdueTasks.invalidate();
      } else {
        toast.info("Google Calendar is already in sync — no changes found");
      }
      utils.googleCalendar.getSettings.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const syncNow = trpc.googleCalendar.syncNow.useMutation({
    onSuccess: (data) => {
      toast.success(`Sync complete — ${data.tasksSynced} tasks, ${data.projectsSynced} projects synced`);
      if (data.errors.length > 0) {
        toast.warning(`${data.errors.length} errors: ${data.errors[0]}`);
      }
      utils.googleCalendar.getSettings.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  // Prefill form from settings
  const [form, setForm] = useState({
    tasksCalendarId: "primary",
    projectsCalendarId: "primary",
    syncEnabled: true,
    syncTasks: true,
    syncProjects: true,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        tasksCalendarId: settings.tasksCalendarId,
        projectsCalendarId: settings.projectsCalendarId,
        syncEnabled: settings.syncEnabled,
        syncTasks: settings.syncTasks,
        syncProjects: settings.syncProjects,
      });
    }
  }, [settings]);

  // Handle OAuth return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") {
      toast.success("Google Calendar connected successfully!");
      utils.googleCalendar.getSettings.invalidate();
      // Clean URL
      window.history.replaceState({}, "", "/settings/calendar");
    }
    if (params.get("error")) {
      toast.error(`Connection failed: ${params.get("error")}`);
      window.history.replaceState({}, "", "/settings/calendar");
    }
  }, []);

  const handleConnect = () => {
    window.location.href = `/api/google/auth?returnTo=/settings/calendar`;
  };

  const handleSave = () => {
    const tasksId = useManualInput ? manualTasksId || form.tasksCalendarId : form.tasksCalendarId;
    const projectsId = useManualInput ? manualProjectsId || form.projectsCalendarId : form.projectsCalendarId;
    saveSettings.mutate({
      ...form,
      tasksCalendarId: tasksId,
      projectsCalendarId: projectsId,
    });
  };

  const calendarOptions = calendars ?? [];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-background via-background to-muted/20 relative rounded-tl-3xl -ml-4 -mt-4 p-4 lg:p-8 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-background/0 to-background/0 pointer-events-none" />
      
      <div className="max-w-4xl mx-auto space-y-10 relative z-10 py-6">
        {/* Hero Section */}
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold tracking-wide uppercase">
            <Calendar className="w-3.5 h-3.5" />
            Integrations
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
            Google Calendar
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl leading-relaxed">
            Seamlessly sync your tasks and project deadlines to stay on top of your schedule with zero friction.
          </p>
        </div>

        {/* Connection Status Glass Card */}
        <div className={`relative overflow-hidden rounded-[2rem] transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl ${
          settings?.connected
            ? "bg-white/40 dark:bg-black/40 backdrop-blur-xl border border-green-200/50 dark:border-green-900/30 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]"
            : "bg-white/40 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-xl"
        }`}>
          {settings?.connected && (
            <div className="absolute top-0 right-0 w-64 h-64 bg-green-400/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          )}
          
          <div className="p-8 md:p-10 relative z-10">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
              <div className="flex items-center gap-6">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner ${
                  settings?.connected 
                    ? "bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/40 dark:to-green-900/20" 
                    : "bg-gradient-to-br from-muted to-muted/50"
                }`}>
                  <Calendar className={`w-8 h-8 ${settings?.connected ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-semibold tracking-tight">Status</h3>
                    {settingsLoading ? (
                      <Badge variant="secondary" className="px-2.5 py-0.5 rounded-full animate-pulse font-medium">
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Checking
                      </Badge>
                    ) : settings?.connected ? (
                      <Badge className="bg-green-100/80 hover:bg-green-100 text-green-700 dark:bg-green-900/40 dark:hover:bg-green-900/50 dark:text-green-400 border-none px-3 py-1 rounded-full shadow-sm font-semibold">
                        <CheckCircle2 className="w-4 h-4 mr-1.5" /> Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="px-3 py-1 rounded-full shadow-sm border-none bg-muted/80 text-muted-foreground font-semibold">
                        <XCircle className="w-4 h-4 mr-1.5" /> Disconnected
                      </Badge>
                    )}
                  </div>
                  {settings?.connected && settings.lastSyncedAt && (
                    <p className="text-sm text-muted-foreground mt-2 font-medium">
                      Last synced: {new Date(settings.lastSyncedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  )}
                  {!settings?.connected && (
                    <p className="text-sm text-muted-foreground mt-2 font-medium">
                      Link your account to enable two-way sync
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                {settings?.connected ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => pullSync.mutate()}
                      disabled={pullSync.isPending || !form.syncEnabled}
                      className="rounded-full h-10 px-5 gap-2 border-blue-200/60 bg-blue-50/30 text-blue-700 hover:bg-blue-100/50 hover:text-blue-800 dark:border-blue-900/30 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40 transition-colors shadow-sm font-medium"
                    >
                      {pullSync.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarCheck className="w-4 h-4" />}
                      <span className="hidden sm:inline">Pull updates</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => syncNow.mutate()}
                      disabled={syncNow.isPending || !form.syncEnabled}
                      className="rounded-full h-10 px-5 gap-2 bg-white/60 dark:bg-black/40 hover:bg-white dark:hover:bg-black transition-colors shadow-sm border-white/20 dark:border-white/10 font-medium"
                    >
                      {syncNow.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      Sync Now
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCleanupSync}
                      disabled={cleanupLoading}
                      className="rounded-full h-10 px-5 gap-2 border-orange-200/60 bg-orange-50/30 text-orange-700 hover:bg-orange-100/50 hover:text-orange-800 dark:border-orange-900/30 dark:bg-orange-900/20 dark:text-orange-300 dark:hover:bg-orange-900/40 transition-colors shadow-sm font-medium"
                    >
                      {cleanupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                      <span className="hidden sm:inline">Reset</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => disconnect.mutate()}
                      disabled={disconnect.isPending}
                      className="rounded-full h-10 w-10 text-red-600/80 hover:text-red-700 hover:bg-red-50 dark:text-red-400/80 dark:hover:text-red-300 dark:hover:bg-red-950/30 transition-colors"
                      title="Disconnect"
                    >
                      <Unlink className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  <Button onClick={handleConnect} className="w-full md:w-auto h-12 px-8 rounded-full bg-foreground text-background hover:bg-foreground/90 shadow-xl shadow-foreground/10 transition-all hover:-translate-y-0.5 gap-2 font-semibold text-base">
                    <Calendar className="w-5 h-5" />
                    Connect Calendar
                    <ArrowRight className="w-5 h-5 ml-1 opacity-70" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Setup Guide */}
        {!settings?.connected && !settingsLoading && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150 fill-mode-both">
            <div className="rounded-[2rem] border border-white/20 dark:border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-md p-8 md:p-10 shadow-lg">
              <div className="flex items-center gap-4 mb-10">
                <div className="p-3 rounded-2xl bg-primary/10 shadow-inner">
                  <Info className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-2xl font-bold tracking-tight">Setup Guide</h3>
              </div>
              
              <div className="grid gap-6 md:grid-cols-3">
                {[
                  {
                    step: "1",
                    title: "Connect Account",
                    desc: "Authorize secure access to your calendar.",
                    icon: <Shield className="w-6 h-6 text-violet-500" />,
                  },
                  {
                    step: "2",
                    title: "Configure",
                    desc: "Choose specific calendars for tasks and projects.",
                    icon: <CalendarDays className="w-6 h-6 text-blue-500" />,
                  },
                  {
                    step: "3",
                    title: "Auto-Sync",
                    desc: "Enjoy seamless, automatic background updates.",
                    icon: <Zap className="w-6 h-6 text-amber-500" />,
                  },
                ].map((item) => (
                  <div key={item.step} className="group flex flex-col gap-5 p-6 rounded-3xl bg-white/50 dark:bg-black/20 hover:bg-white/80 dark:hover:bg-black/40 transition-all duration-300 border border-transparent hover:border-black/5 dark:hover:border-white/5 hover:shadow-xl hover:-translate-y-1">
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-white dark:bg-black/50 shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-500 ease-out">
                        {item.icon}
                      </div>
                      <span className="text-4xl font-extrabold text-muted/30 dark:text-muted/10 group-hover:text-muted/50 transition-colors duration-500">
                        {item.step}
                      </span>
                    </div>
                    <div>
                      <p className="font-bold text-lg mb-2">{item.title}</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-10 pt-8 border-t border-black/5 dark:border-white/5">
                <div className="flex gap-4 items-start p-6 rounded-3xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/50 backdrop-blur-sm">
                  <Info className="w-6 h-6 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-3">
                    <p className="text-base font-bold text-amber-900 dark:text-amber-400 tracking-tight">
                      Developer Configuration
                    </p>
                    <p className="text-sm text-amber-800/90 dark:text-amber-500/90 leading-relaxed max-w-2xl">
                      Ensure your Google Cloud Console has the Calendar API enabled and <code className="bg-white/60 dark:bg-black/40 px-2 py-1 rounded-lg mx-1 font-mono text-xs font-semibold shadow-sm">/api/google/callback</code> configured as an authorized redirect URI. Add Client ID & Secret to environment variables.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Configuration (Connected State) */}
        {settings?.connected && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150 fill-mode-both">
            
            {/* Sync Preferences & Calendars Combined */}
            <div className="rounded-[2rem] border border-white/20 dark:border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-xl p-8 md:p-10 shadow-lg space-y-12">
              
              {/* Toggles */}
              <div className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-primary/10 shadow-inner">
                    <Zap className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold tracking-tight">Preferences</h3>
                </div>

                <div className="grid gap-5 md:grid-cols-3">
                  <div className="p-6 rounded-3xl bg-white/50 dark:bg-black/20 flex flex-col justify-between gap-6 border border-white/40 dark:border-white/5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-base">Master Sync</p>
                      <Switch checked={form.syncEnabled} onCheckedChange={(v) => setForm((f) => ({ ...f, syncEnabled: v }))} className="data-[state=checked]:bg-green-500" />
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">Master switch to enable or disable all background calendar integrations.</p>
                  </div>
                  <div className={`p-6 rounded-3xl bg-white/50 dark:bg-black/20 flex flex-col justify-between gap-6 border border-white/40 dark:border-white/5 shadow-sm transition-all duration-300 ${!form.syncEnabled && 'opacity-50 grayscale pointer-events-none'}`}>
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-base flex items-center gap-2.5"><CalendarCheck className="w-5 h-5 text-violet-500" /> Tasks</p>
                      <Switch checked={form.syncTasks} onCheckedChange={(v) => setForm((f) => ({ ...f, syncTasks: v }))} disabled={!form.syncEnabled} />
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">Sync actionable tasks with due dates as all-day events.</p>
                  </div>
                  <div className={`p-6 rounded-3xl bg-white/50 dark:bg-black/20 flex flex-col justify-between gap-6 border border-white/40 dark:border-white/5 shadow-sm transition-all duration-300 ${!form.syncEnabled && 'opacity-50 grayscale pointer-events-none'}`}>
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-base flex items-center gap-2.5"><CalendarDays className="w-5 h-5 text-blue-500" /> Projects</p>
                      <Switch checked={form.syncProjects} onCheckedChange={(v) => setForm((f) => ({ ...f, syncProjects: v }))} disabled={!form.syncEnabled} />
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">Sync long-term project timelines as multi-day blocks.</p>
                  </div>
                </div>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-black/10 dark:via-white/10 to-transparent" />

              {/* Calendars */}
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-primary/10 shadow-inner">
                      <Calendar className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-2xl font-bold tracking-tight">Routing</h3>
                  </div>
                  <button onClick={() => setUseManualInput(!useManualInput)} className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-4 py-2 rounded-full bg-white/50 dark:bg-black/20 hover:bg-white dark:hover:bg-black/40 shadow-sm border border-transparent hover:border-black/5 dark:hover:border-white/5">
                    {useManualInput ? "Use Dropdown Selection" : "Enter IDs Manually"}
                  </button>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4 p-6 rounded-3xl bg-white/30 dark:bg-black/10 border border-white/50 dark:border-white/5 shadow-inner">
                    <label className="text-base font-bold flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-violet-500 shadow-sm shadow-violet-500/50" />
                      Tasks Destination
                    </label>
                    {useManualInput ? (
                      <Input value={manualTasksId || form.tasksCalendarId} onChange={(e) => setManualTasksId(e.target.value)} className="font-mono text-sm bg-white/60 dark:bg-black/40 border-black/5 dark:border-white/5 h-12 rounded-2xl shadow-sm focus-visible:ring-violet-500/30" placeholder="primary" />
                    ) : calendarsLoading ? (
                      <div className="h-12 rounded-2xl bg-black/5 dark:bg-white/5 animate-pulse" />
                    ) : (
                      <Select value={form.tasksCalendarId} onValueChange={(v) => setForm((f) => ({ ...f, tasksCalendarId: v }))}>
                        <SelectTrigger className="h-12 rounded-2xl bg-white/60 dark:bg-black/40 border-black/5 dark:border-white/5 shadow-sm focus:ring-violet-500/30 font-medium">
                          <SelectValue placeholder="Select a calendar" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-black/5 dark:border-white/10 backdrop-blur-2xl bg-white/95 dark:bg-black/95 shadow-2xl">
                          <SelectItem value="primary" className="font-medium rounded-xl focus:bg-violet-50 dark:focus:bg-violet-950/30">Primary Calendar</SelectItem>
                          {calendarOptions.filter((c) => c.id !== "primary").map((cal) => (
                            <SelectItem key={cal.id} value={cal.id} className="rounded-xl focus:bg-violet-50 dark:focus:bg-violet-950/30">{cal.summary}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <p className="text-xs text-muted-foreground ml-1">Default behavior sets events in the primary calendar.</p>
                  </div>
                  
                  <div className="space-y-4 p-6 rounded-3xl bg-white/30 dark:bg-black/10 border border-white/50 dark:border-white/5 shadow-inner">
                    <label className="text-base font-bold flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />
                      Projects Destination
                    </label>
                    {useManualInput ? (
                      <Input value={manualProjectsId || form.projectsCalendarId} onChange={(e) => setManualProjectsId(e.target.value)} className="font-mono text-sm bg-white/60 dark:bg-black/40 border-black/5 dark:border-white/5 h-12 rounded-2xl shadow-sm focus-visible:ring-blue-500/30" placeholder="primary" />
                    ) : calendarsLoading ? (
                      <div className="h-12 rounded-2xl bg-black/5 dark:bg-white/5 animate-pulse" />
                    ) : (
                      <Select value={form.projectsCalendarId} onValueChange={(v) => setForm((f) => ({ ...f, projectsCalendarId: v }))}>
                        <SelectTrigger className="h-12 rounded-2xl bg-white/60 dark:bg-black/40 border-black/5 dark:border-white/5 shadow-sm focus:ring-blue-500/30 font-medium">
                          <SelectValue placeholder="Select a calendar" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-black/5 dark:border-white/10 backdrop-blur-2xl bg-white/95 dark:bg-black/95 shadow-2xl">
                          <SelectItem value="primary" className="font-medium rounded-xl focus:bg-blue-50 dark:focus:bg-blue-950/30">Primary Calendar</SelectItem>
                          {calendarOptions.filter((c) => c.id !== "primary").map((cal) => (
                            <SelectItem key={cal.id} value={cal.id} className="rounded-xl focus:bg-blue-50 dark:focus:bg-blue-950/30">{cal.summary}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <p className="text-xs text-muted-foreground ml-1">Use a separate calendar to organize larger timelines visually.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Panels */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="p-8 rounded-[2rem] bg-white/30 dark:bg-black/10 border border-white/40 dark:border-white/5 backdrop-blur-md shadow-sm">
                <p className="text-lg font-bold mb-5 tracking-tight">How it works</p>
                <ul className="space-y-4 text-sm text-muted-foreground">
                  <li className="flex gap-3 items-center"><CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" /><span className="font-medium">Tasks with deadlines become all-day events</span></li>
                  <li className="flex gap-3 items-center"><CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" /><span className="font-medium">Projects map to multi-day timeline blocks</span></li>
                  <li className="flex gap-3 items-center"><CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" /><span className="font-medium">Prefixed with [BOSS] and [PROJECT] tags</span></li>
                </ul>
              </div>

              <div className="p-8 rounded-[2rem] bg-white/30 dark:bg-black/10 border border-white/40 dark:border-white/5 backdrop-blur-md shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-5">
                    <p className="text-lg font-bold tracking-tight">Background Auto-Sync</p>
                    <span className="text-[10px] uppercase tracking-widest font-extrabold px-3 py-1 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400 shadow-sm">Advanced</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-5 font-medium leading-relaxed">
                    Deploy BOSS OS to enable automated 15-minute background syncs across all devices.
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-black/40 rounded-2xl p-4 border border-black/5 dark:border-white/5 shadow-inner">
                  <code className="text-[11px] font-mono break-all text-muted-foreground/80 font-medium">
                    manus-heartbeat create --name gcal-sync --cron "0 */15 * * * *" --path /api/scheduled/gcal-sync
                  </code>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4">
              <Button
                onClick={handleSave}
                disabled={saveSettings.isPending}
                className="h-14 px-10 rounded-full bg-foreground text-background hover:bg-foreground/90 shadow-xl shadow-foreground/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl gap-3 font-bold text-lg"
              >
                {saveSettings.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                Save Configuration
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
