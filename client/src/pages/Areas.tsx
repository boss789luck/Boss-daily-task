import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Plus, Layers, ChevronRight, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

// Vivid, luxury accent palette
const AREA_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#10b981", "#06b6d4",
];
const AREA_ICONS = ["◆", "◉", "▲", "★", "●", "■", "♦", "⬟", "⬡", "⬢"];

interface AreaFormData { name: string; description: string; color: string; icon: string; }
const defaultForm: AreaFormData = { name: "", description: "", color: "#6366f1", icon: "◆" };

export default function AreasPage() {
  const utils = trpc.useUtils();
  const { data: areas, isLoading } = trpc.areas.list.useQuery();
  const { data: projects } = trpc.projects.list.useQuery();
  const { data: tasks } = trpc.tasks.list.useQuery();
  const [showCreate, setShowCreate] = useState(false);
  const [editArea, setEditArea] = useState<NonNullable<typeof areas>[0] | null>(null);
  const [form, setForm] = useState<AreaFormData>(defaultForm);

  const createMutation = trpc.areas.create.useMutation({
    onSuccess: () => { utils.areas.list.invalidate(); setShowCreate(false); setForm(defaultForm); toast.success("Area created"); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.areas.update.useMutation({
    onSuccess: () => { utils.areas.list.invalidate(); setEditArea(null); toast.success("Area updated"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.areas.delete.useMutation({
    onSuccess: () => { utils.areas.list.invalidate(); toast.success("Area deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!form.name.trim()) return toast.error("Name is required");
    if (editArea) updateMutation.mutate({ id: editArea.id, data: form });
    else createMutation.mutate(form);
  };

  const openEdit = (area: NonNullable<typeof areas>[0]) => {
    setEditArea(area);
    setForm({ name: area.name, description: area.description ?? "", color: area.color ?? "#6366f1", icon: area.icon ?? "◆" });
  };

  const getAreaStats = (areaId: number) => {
    const areaProjects = projects?.filter((p) => p.areaId === areaId) ?? [];
    const areaTasks = tasks?.filter((t) => t.areaId === areaId) ?? [];
    const openTasks = areaTasks.filter((t) => t.status !== "done" && t.status !== "cancelled").length;
    const avgProgress = areaProjects.length > 0
      ? areaProjects.reduce((s, p) => s + (p.progress ?? 0), 0) / areaProjects.length : 0;
    return { totalProjects: areaProjects.length, openTasks, avgProgress };
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto page-enter">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "oklch(0.60 0.22 300 / 0.1)" }}>
              <Layers className="w-4 h-4" style={{ color: "oklch(0.50 0.22 300)" }} />
            </div>
            Areas
          </h1>
          <p className="text-muted-foreground text-sm mt-1 font-medium">Top-level domains of your work and life</p>
        </div>
        <Button size="sm" className="gap-2 rounded-xl bg-primary text-white shadow-md shadow-primary/25 hover:bg-primary/90 font-semibold"
          onClick={() => { setForm(defaultForm); setShowCreate(true); }}>
          <Plus className="w-3.5 h-3.5" /> New Area
        </Button>
      </div>

      {/* ── Grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4].map((i) => <Skeleton key={i} className="h-52 rounded-2xl" />)}
        </div>
      ) : areas?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "oklch(0.60 0.22 300 / 0.08)", border: "1px solid oklch(0.60 0.22 300 / 0.2)" }}>
            <Layers className="w-7 h-7" style={{ color: "oklch(0.60 0.22 300 / 0.5)" }} />
          </div>
          <h3 className="font-bold text-foreground mb-1">No areas yet</h3>
          <p className="text-muted-foreground text-sm max-w-xs mb-5">Areas are top-level categories — like Business, Personal, or Finance.</p>
          <Button className="gap-2 rounded-xl bg-primary text-white shadow-md shadow-primary/25 font-semibold"
            onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" /> Create first area
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {areas?.map((area) => {
            const stats = getAreaStats(area.id);
            const color = area.color ?? "#6366f1";
            return (
              <div key={area.id} className="boss-card overflow-hidden group">
                {/* Color bar */}
                <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${color}, ${color}80)` }} />

                <div className="p-5">
                  {/* Title row */}
                  <div className="flex items-start justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-lg flex-shrink-0 shadow-sm"
                        style={{ background: `${color}15`, border: `1.5px solid ${color}30` }}>
                        <span style={{ color }}>{area.icon ?? "◆"}</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground text-sm leading-tight">{area.name}</h3>
                        {area.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{area.description}</p>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="w-7 h-7 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => openEdit(area)} className="gap-2 text-xs">
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { if (confirm("Delete this area?")) deleteMutation.mutate({ id: area.id }); }}
                          className="gap-2 text-xs text-destructive focus:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {[
                      { label: "Projects", value: stats.totalProjects },
                      { label: "Tasks", value: stats.openTasks },
                      { label: "Progress", value: `${Math.round(stats.avgProgress * 100)}%` },
                    ].map(({ label, value }) => (
                      <div key={label} className="text-center py-2 rounded-xl" style={{ background: `${color}08` }}>
                        <div className="text-base font-bold" style={{ color }}>{value}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mt-0.5">{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-4">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${stats.avgProgress * 100}%`, background: `linear-gradient(90deg, ${color}, ${color}aa)` }} />
                  </div>

                  {/* View link */}
                  <Link href={`/areas/${area.id}`}>
                    <button className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
                      style={{ background: `${color}10`, color, border: `1px solid ${color}20` }}>
                      View details <ChevronRight className="w-3 h-3" />
                    </button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create/Edit Dialog ── */}
      <Dialog open={showCreate || !!editArea} onOpenChange={(o) => { if (!o) { setShowCreate(false); setEditArea(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">{editArea ? "Edit Area" : "New Area"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</Label>
              <Input placeholder="e.g. Business, Personal, Finance…" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="rounded-xl border-border bg-muted/30 font-medium" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</Label>
              <Textarea placeholder="What does this area cover?" value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="rounded-xl border-border bg-muted/30 resize-none" rows={2} />
            </div>

            {/* Color picker */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Color</Label>
              <div className="flex gap-2.5 flex-wrap">
                {AREA_COLORS.map((c) => (
                  <button key={c}
                    className={cn("w-7 h-7 rounded-full transition-all duration-150", form.color === c ? "scale-125 ring-2 ring-offset-2 ring-offset-background" : "hover:scale-110")}
                    style={{ backgroundColor: c, ...(form.color === c ? { ringColor: c } : {}) }}
                    onClick={() => setForm({ ...form, color: c })}
                  />
                ))}
              </div>
            </div>

            {/* Icon picker */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Icon</Label>
              <div className="flex gap-2 flex-wrap">
                {AREA_ICONS.map((icon) => (
                  <button key={icon}
                    className={cn("w-9 h-9 rounded-xl text-base transition-all duration-150",
                      form.icon === icon ? "scale-110 shadow-sm" : "hover:scale-105")}
                    style={{
                      background: form.icon === icon ? `${form.color}20` : "oklch(0.97 0.002 255)",
                      border: form.icon === icon ? `1.5px solid ${form.color}50` : "1.5px solid oklch(0.91 0.006 255)",
                      color: form.color,
                    }}
                    onClick={() => setForm({ ...form, icon })}>
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            {form.name && (
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: `${form.color}08`, border: `1px solid ${form.color}20` }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                  style={{ background: `${form.color}15`, border: `1.5px solid ${form.color}30` }}>
                  <span style={{ color: form.color }}>{form.icon}</span>
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground">{form.name}</div>
                  {form.description && <div className="text-xs text-muted-foreground">{form.description}</div>}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" size="sm" className="rounded-xl"
              onClick={() => { setShowCreate(false); setEditArea(null); }}>Cancel</Button>
            <Button size="sm" className="rounded-xl text-white shadow-md font-semibold"
              style={{ background: form.color, boxShadow: `0 4px 12px ${form.color}40` }}
              onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editArea ? "Save changes" : "Create area"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
