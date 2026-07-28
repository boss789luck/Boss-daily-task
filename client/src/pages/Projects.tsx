import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Plus, FolderOpen, MoreHorizontal, Pencil, Trash2, CalendarDays, X, ChevronRight, GripVertical } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInDays } from "date-fns";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ── Design tokens ──────────────────────────────────────────────────────────────
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

const HEALTH_CFG: Record<string, { label: string; solid: string; tint: string }> = {
  on_track: { label: "On Track", solid: "oklch(0.58 0.20 145)", tint: "oklch(0.58 0.20 145 / 0.1)" },
  at_risk:  { label: "At Risk",  solid: "oklch(0.72 0.18 70)",  tint: "oklch(0.72 0.18 70  / 0.1)" },
  delayed:  { label: "Delayed",  solid: "oklch(0.65 0.18 50)",  tint: "oklch(0.65 0.18 50  / 0.1)" },
  critical: { label: "Critical", solid: "oklch(0.62 0.22 25)",  tint: "oklch(0.62 0.22 25  / 0.1)" },
};

const PRIORITY_CFG: Record<string, { label: string; solid: string }> = {
  p0: { label: "Critical", solid: "oklch(0.62 0.22 25)" },
  p1: { label: "High",     solid: "oklch(0.72 0.18 70)" },
  p2: { label: "Medium",   solid: "oklch(0.52 0.26 270)" },
  p3: { label: "Low",      solid: "oklch(0.65 0.04 255)" },
};

const STATUS_OPTIONS = Object.entries(STATUS_CFG).map(([value, c]) => ({ value, label: c.label }));
const HEALTH_OPTIONS = Object.entries(HEALTH_CFG).map(([value, c]) => ({ value, label: c.label }));
const PRIORITY_OPTIONS = Object.entries(PRIORITY_CFG).map(([value, c]) => ({ value, label: c.label }));

// Progress bar colors per index
const BAR_COLORS = [
  "oklch(0.52 0.26 270)", "oklch(0.60 0.22 200)", "oklch(0.58 0.20 145)",
  "oklch(0.72 0.18 70)", "oklch(0.62 0.22 25)", "oklch(0.60 0.22 340)",
];

interface ProjectFormData {
  name: string; description: string; areaId: string;
  status: string; priority: string; health: string;
  startDate: string; deadline: string;
}
const defaultForm: ProjectFormData = {
  name: "", description: "", areaId: "none",
  status: "not_started", priority: "p2", health: "on_track",
  startDate: "", deadline: "",
};

function DatePicker({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button"
          className={cn("w-full flex items-center gap-2 px-3 h-9 rounded-xl border border-border bg-muted/30 text-xs transition-colors hover:border-primary/50 hover:bg-muted/50 font-medium",
            !value && "text-muted-foreground")}>
          <CalendarDays className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <span className="flex-1 text-left">{value ? format(new Date(value + "T00:00:00"), "MMM d, yyyy") : placeholder}</span>
          {value && (
            <span role="button" tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onChange(""); } }}
              className="text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <CalendarPicker mode="single" selected={value ? new Date(value + "T00:00:00") : undefined}
          onSelect={(d) => onChange(d ? format(d, "yyyy-MM-dd") : "")} initialFocus />
      </PopoverContent>
    </Popover>
  );
}

// ── Sortable Project Row ───────────────────────────────────────────────────────
type ProjectItem = {
  id: number;
  name: string;
  description: string | null;
  status: string;
  health: string | null;
  priority: string | null;
  progress: number | null;
  deadline: Date | null;
  startDate: Date | null;
  areaId: number | null;
  sortOrder: number | null;
};

function SortableProjectRow({
  project,
  idx,
  areas,
  tasks,
  onEdit,
  onDelete,
}: {
  project: ProjectItem;
  idx: number;
  areas: { id: number; name: string; color: string | null }[] | undefined;
  tasks: { projectId: number | null; parentTaskId: number | null; status: string }[] | undefined;
  onEdit: (p: ProjectItem) => void;
  onDelete: (id: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const tc = {
    total: tasks?.filter((t) => t.projectId === project.id && !t.parentTaskId).length ?? 0,
    done: tasks?.filter((t) => t.projectId === project.id && !t.parentTaskId && t.status === "done").length ?? 0,
  };
  const progress = (project.progress ?? 0) * 100;
  const area = areas?.find((a) => a.id === project.areaId);
  const daysLeft = project.deadline ? differenceInDays(new Date(project.deadline), new Date()) : null;
  const sCfg = STATUS_CFG[project.status] ?? STATUS_CFG.not_started;
  const hCfg = HEALTH_CFG[project.health ?? "on_track"] ?? HEALTH_CFG.on_track;
  const barColor = BAR_COLORS[idx % BAR_COLORS.length];

  // Days remaining color
  const daysColor = daysLeft === null
    ? "oklch(0.55 0.016 255)"
    : daysLeft < 0
      ? "oklch(0.62 0.22 25)"
      : daysLeft <= 7
        ? "oklch(0.72 0.18 70)"
        : "oklch(0.55 0.016 255)";

  const daysLabel = daysLeft === null
    ? null
    : daysLeft < 0
      ? `เกิน ${Math.abs(daysLeft)} วัน`
      : daysLeft === 0
        ? "วันนี้!"
        : `เหลือ ${daysLeft} วัน`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("boss-card p-5 group", isDragging && "shadow-lg ring-2 ring-primary/30")}
    >
      <div className="flex items-start gap-3">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="flex-shrink-0 mt-1 p-0.5 rounded cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors touch-none"
          tabIndex={-1}
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {/* Color accent bar */}
        <div className="w-1 rounded-full self-stretch flex-shrink-0 mt-1" style={{ background: barColor, opacity: 0.8, minHeight: "2.5rem" }} />

        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Link href={`/projects/${project.id}`}>
              <span className="font-bold text-foreground hover:text-primary transition-colors cursor-pointer text-sm">
                {project.name}
              </span>
            </Link>
            {/* Status badge */}
            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-semibold"
              style={{ background: sCfg.tint, color: sCfg.solid }}>
              {sCfg.label}
            </span>
            {/* Health badge */}
            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-semibold"
              style={{ background: hCfg.tint, color: hCfg.solid }}>
              {hCfg.label}
            </span>
            {/* Area badge */}
            {area && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-semibold border"
                style={{ borderColor: `${area.color}40`, color: area.color ?? "oklch(0.55 0.016 255)", background: `${area.color}10` }}>
                {area.name}
              </span>
            )}
          </div>

          {project.description && (
            <p className="text-xs text-muted-foreground mb-3 line-clamp-1">{project.description}</p>
          )}

          {/* Progress row */}
          <div className="flex items-center gap-3">
            <div className="flex-1 max-w-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-muted-foreground font-medium">{tc.done}/{tc.total} tasks</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-foreground">{Math.round(progress)}%</span>
                  {/* Days remaining — inline after % */}
                  {daysLabel && (
                    <span
                      className="text-[11px] font-semibold flex items-center gap-1"
                      style={{ color: daysColor }}
                    >
                      <CalendarDays className="w-3 h-3" />
                      {daysLabel}
                    </span>
                  )}
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: barColor }} />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Link href={`/projects/${project.id}`}>
            <Button variant="ghost" size="icon" className="w-7 h-7 rounded-lg">
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="w-7 h-7 rounded-lg">
                <MoreHorizontal className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => onEdit(project)} className="gap-2 text-xs">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => { if (confirm("Delete this project?")) onDelete(project.id); }}
                className="gap-2 text-xs text-destructive focus:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProjectsPage() {
  const utils = trpc.useUtils();
  const { data: projectsData, isLoading } = trpc.projects.list.useQuery();
  const { data: areas } = trpc.areas.list.useQuery();
  const { data: tasks } = trpc.tasks.list.useQuery();
  const [showCreate, setShowCreate] = useState(false);
  const [editProject, setEditProject] = useState<ProjectItem | null>(null);
  const [form, setForm] = useState<ProjectFormData>(defaultForm);
  const [filterStatus, setFilterStatus] = useState("all");
  // Local ordered list for optimistic drag reorder
  const [localOrder, setLocalOrder] = useState<number[] | null>(null);

  const createMutation = trpc.projects.create.useMutation({
    onSuccess: () => { utils.projects.list.invalidate(); setShowCreate(false); setForm(defaultForm); toast.success("Project created"); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.projects.update.useMutation({
    onSuccess: () => { utils.projects.list.invalidate(); setEditProject(null); toast.success("Project updated"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.projects.delete.useMutation({
    onSuccess: () => { utils.projects.list.invalidate(); toast.success("Project deleted"); },
    onError: (e) => toast.error(e.message),
  });
  const reorderMutation = trpc.projects.reorder.useMutation({
    onSuccess: () => { utils.projects.list.invalidate(); setLocalOrder(null); },
    onError: () => { setLocalOrder(null); toast.error("Failed to save order"); utils.projects.list.invalidate(); },
  });

  const handleSubmit = () => {
    if (!form.name.trim()) return toast.error("Name is required");
    const data = {
      name: form.name.trim(), description: form.description || undefined,
      areaId: form.areaId !== "none" ? parseInt(form.areaId) : null,
      status: form.status as any, priority: form.priority as any, health: form.health as any,
      startDate: form.startDate ? new Date(form.startDate + "T05:00:00.000Z") : null,
      deadline: form.deadline ? new Date(form.deadline + "T05:00:00.000Z") : null,
    };
    if (editProject) updateMutation.mutate({ id: editProject.id, data });
    else createMutation.mutate(data);
  };

  const openEdit = (p: ProjectItem) => {
    setEditProject(p);
    setForm({
      name: p.name, description: p.description ?? "", areaId: p.areaId ? String(p.areaId) : "none",
      status: p.status, priority: p.priority ?? "p2", health: p.health ?? "on_track",
      startDate: p.startDate ? format(new Date(p.startDate), "yyyy-MM-dd") : "",
      deadline: p.deadline ? format(new Date(p.deadline), "yyyy-MM-dd") : "",
    });
  };

  // Build ordered projects list (local order takes priority over server order)
  const allProjects = (projectsData ?? []) as ProjectItem[];
  const orderedProjects = localOrder
    ? localOrder.map((id) => allProjects.find((p) => p.id === id)).filter(Boolean) as ProjectItem[]
    : allProjects;

  const filtered = orderedProjects.filter((p) => filterStatus === "all" || p.status === filterStatus);

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // When filter is active, reorder within filtered list only
    const sourceList = filterStatus === "all" ? orderedProjects : filtered;
    const oldIndex = sourceList.findIndex((p) => p.id === active.id);
    const newIndex = sourceList.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sourceList, oldIndex, newIndex);

    // Build full order: replace filtered items in their positions within orderedProjects
    let newFullOrder: number[];
    if (filterStatus === "all") {
      newFullOrder = reordered.map((p) => p.id);
    } else {
      // Merge: keep non-filtered items in place, replace filtered items with reordered
      const filteredIds = new Set(filtered.map((p) => p.id));
      const reorderedIds = reordered.map((p) => p.id);
      let reorderedIdx = 0;
      newFullOrder = orderedProjects.map((p) => {
        if (filteredIds.has(p.id)) return reorderedIds[reorderedIdx++];
        return p.id;
      });
    }

    setLocalOrder(newFullOrder);
    reorderMutation.mutate({ orderedIds: newFullOrder });
  }, [orderedProjects, filtered, filterStatus, reorderMutation]);

  // Items for SortableContext — use filtered list when filter active
  const sortableItems = filtered.map((p) => p.id);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto page-enter">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "oklch(0.52 0.26 270 / 0.1)" }}>
              <FolderOpen className="w-4 h-4" style={{ color: "oklch(0.42 0.22 270)" }} />
            </div>
            Projects
          </h1>
          <p className="text-muted-foreground text-sm mt-1 font-medium">{allProjects.length} total projects</p>
        </div>
        <Button size="sm" className="gap-2 rounded-xl bg-primary text-white shadow-md shadow-primary/25 hover:bg-primary/90 font-semibold"
          onClick={() => { setForm(defaultForm); setShowCreate(true); }}>
          <Plus className="w-3.5 h-3.5" /> New Project
        </Button>
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex gap-1.5 mb-6 flex-wrap">
        {[{ value: "all", label: "All" }, ...STATUS_OPTIONS].map((opt) => {
          const cfg = STATUS_CFG[opt.value];
          const isActive = filterStatus === opt.value;
          return (
            <button key={opt.value} onClick={() => setFilterStatus(opt.value)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={isActive
                ? { background: cfg ? cfg.tint : "oklch(0.52 0.26 270 / 0.1)", color: cfg ? cfg.solid : "oklch(0.42 0.22 270)", border: `1px solid ${cfg ? cfg.solid : "oklch(0.52 0.26 270)"}40` }
                : { background: "transparent", color: "oklch(0.55 0.016 255)", border: "1px solid transparent" }
              }>
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* ── Project List ── */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "oklch(0.52 0.26 270 / 0.07)" }}>
            <FolderOpen className="w-7 h-7" style={{ color: "oklch(0.52 0.26 270 / 0.4)" }} />
          </div>
          <p className="text-muted-foreground font-medium">No projects found</p>
          <Button className="mt-4 gap-2 rounded-xl bg-primary text-white shadow-md shadow-primary/25" size="sm"
            onClick={() => setShowCreate(true)}>
            <Plus className="w-3.5 h-3.5" /> Create project
          </Button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {filtered.map((project, idx) => (
                <SortableProjectRow
                  key={project.id}
                  project={project}
                  idx={idx}
                  areas={areas as any}
                  tasks={tasks as any}
                  onEdit={openEdit}
                  onDelete={(id) => deleteMutation.mutate({ id })}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* ── Create/Edit Dialog ── */}
      <Dialog open={showCreate || !!editProject} onOpenChange={(o) => { if (!o) { setShowCreate(false); setEditProject(null); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">{editProject ? "Edit Project" : "New Project"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</Label>
              <Input placeholder="Project name…" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="rounded-xl border-border bg-muted/30 font-medium" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</Label>
              <Textarea placeholder="What is this project about?" value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="rounded-xl border-border bg-muted/30 resize-none" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Area</Label>
                <Select value={form.areaId} onValueChange={(v) => setForm({ ...form, areaId: v })}>
                  <SelectTrigger className="rounded-xl border-border bg-muted/30 h-9 text-xs"><SelectValue placeholder="No area" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">No area</SelectItem>{areas?.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="rounded-xl border-border bg-muted/30 h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger className="rounded-xl border-border bg-muted/30 h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITY_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Health</Label>
                <Select value={form.health} onValueChange={(v) => setForm({ ...form, health: v })}>
                  <SelectTrigger className="rounded-xl border-border bg-muted/30 h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{HEALTH_OPTIONS.map((h) => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Start Date</Label>
                <DatePicker value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} placeholder="Pick a date" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deadline</Label>
                <DatePicker value={form.deadline} onChange={(v) => setForm({ ...form, deadline: v })} placeholder="Pick a date" />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" size="sm" className="rounded-xl"
              onClick={() => { setShowCreate(false); setEditProject(null); }}>Cancel</Button>
            <Button size="sm" className="rounded-xl bg-primary text-white shadow-md shadow-primary/25 font-semibold"
              onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editProject ? "Save changes" : "Create project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
