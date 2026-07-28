import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Plus, BookOpen, Search, Tag, Archive, MoreHorizontal, Pencil, Trash2, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

interface NoteFormData {
  title: string; content: string; tags: string;
  areaId: string; projectId: string; taskId: string;
  attachmentUrl: string; isArchived: boolean;
}
const defaultForm: NoteFormData = {
  title: "", content: "", tags: "", areaId: "none", projectId: "none", taskId: "none", attachmentUrl: "", isArchived: false,
};

export default function NotesPage() {
  const utils = trpc.useUtils();
  const { data: notes, isLoading } = trpc.notes.list.useQuery();
  const { data: areas } = trpc.areas.list.useQuery();
  const { data: projects } = trpc.projects.list.useQuery();
  const { data: tasks } = trpc.tasks.list.useQuery();

  const [showCreate, setShowCreate] = useState(false);
  const [editNote, setEditNote] = useState<NonNullable<typeof notes>[0] | null>(null);
  const [form, setForm] = useState<NoteFormData>(defaultForm);
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const createMutation = trpc.notes.create.useMutation({
    onSuccess: () => { utils.notes.list.invalidate(); setShowCreate(false); setForm(defaultForm); toast.success("Note created"); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.notes.update.useMutation({
    onSuccess: () => { utils.notes.list.invalidate(); setEditNote(null); toast.success("Note updated"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.notes.delete.useMutation({
    onSuccess: () => { utils.notes.list.invalidate(); toast.success("Note deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!form.title.trim()) return toast.error("Title is required");
    const data = {
      title: form.title.trim(), content: form.content || null,
      tags: form.tags || null,
      areaId: form.areaId !== "none" ? parseInt(form.areaId) : null,
      projectId: form.projectId !== "none" ? parseInt(form.projectId) : null,
      taskId: form.taskId !== "none" ? parseInt(form.taskId) : null,
      attachmentUrl: form.attachmentUrl || null,
      isArchived: form.isArchived,
    };
    if (editNote) updateMutation.mutate({ id: editNote.id, data });
    else createMutation.mutate(data);
  };

  const openEdit = (note: NonNullable<typeof notes>[0]) => {
    setEditNote(note);
    setForm({
      title: note.title, content: note.content ?? "", tags: note.tags ?? "",
      areaId: note.areaId ? String(note.areaId) : "none",
      projectId: note.projectId ? String(note.projectId) : "none",
      taskId: note.taskId ? String(note.taskId) : "none",
      attachmentUrl: note.attachmentUrl ?? "", isArchived: note.isArchived ?? false,
    });
  };

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    notes?.forEach((n) => n.tags?.split(",").forEach((t) => { const trimmed = t.trim(); if (trimmed) tags.add(trimmed); }));
    return Array.from(tags);
  }, [notes]);

  const filtered = useMemo(() => {
    let list = notes ?? [];
    if (!showArchived) list = list.filter((n) => !n.isArchived);
    if (search) list = list.filter((n) => n.title.toLowerCase().includes(search.toLowerCase()) || n.content?.toLowerCase().includes(search.toLowerCase()));
    if (filterTag) list = list.filter((n) => n.tags?.includes(filterTag));
    return list;
  }, [notes, search, filterTag, showArchived]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" /> Notes
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Knowledge base & linked notes</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => { setForm(defaultForm); setShowCreate(true); }}>
          <Plus className="w-3.5 h-3.5" /> New Note
        </Button>
      </div>

      {/* Search & filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Search notes..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-8 text-xs bg-input border-border" />
        </div>
        {allTags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {allTags.map((tag) => (
              <button key={tag} onClick={() => setFilterTag(filterTag === tag ? "" : tag)}
                className={cn("px-2 py-1 rounded text-[10px] font-medium border transition-all", filterTag === tag ? "bg-primary/15 text-primary border-primary/30" : "text-muted-foreground border-border/50 hover:bg-muted/40")}>
                #{tag}
              </button>
            ))}
          </div>
        )}
        <button onClick={() => setShowArchived(!showArchived)}
          className={cn("px-2.5 py-1 rounded-lg text-xs border transition-all flex items-center gap-1", showArchived ? "bg-muted/40 text-foreground border-border" : "text-muted-foreground border-transparent hover:bg-muted/40")}>
          <Archive className="w-3 h-3" /> Archived
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BookOpen className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground text-sm">No notes found</p>
          <Button className="mt-3 gap-2" size="sm" onClick={() => setShowCreate(true)}><Plus className="w-3.5 h-3.5" /> Create note</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((note) => {
            const area = areas?.find((a) => a.id === note.areaId);
            const project = projects?.find((p) => p.id === note.projectId);
            const tags = note.tags?.split(",").map((t) => t.trim()).filter(Boolean) ?? [];
            return (
              <div key={note.id} className={cn("glass-card rounded-xl p-4 group hover:border-primary/25 transition-all duration-200 flex flex-col", note.isArchived && "opacity-60")}>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-sm text-foreground line-clamp-2 flex-1">{note.title}</h3>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-1">
                        <MoreHorizontal className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem onClick={() => openEdit(note)} className="gap-2 text-xs"><Pencil className="w-3 h-3" /> Edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { if (confirm("Delete note?")) deleteMutation.mutate({ id: note.id }); }} className="gap-2 text-xs text-destructive focus:text-destructive">
                        <Trash2 className="w-3 h-3" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {note.content && <p className="text-xs text-muted-foreground line-clamp-3 flex-1 mb-3">{note.content}</p>}
                <div className="mt-auto space-y-2">
                  {(area || project) && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {area && <Badge variant="outline" className="text-[10px] px-1.5 py-0" style={{ borderColor: `${area.color}50`, color: area.color ?? undefined }}>{area.name}</Badge>}
                      {project && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{project.name}</Badge>}
                    </div>
                  )}
                  {tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {tags.map((tag) => <span key={tag} className="text-[10px] text-primary/70">#{tag}</span>)}
                    </div>
                  )}
                  {note.attachmentUrl && (
                    <a href={note.attachmentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-blue-400 hover:underline">
                      <LinkIcon className="w-2.5 h-2.5" /> Attachment
                    </a>
                  )}
                  <div className="text-[10px] text-muted-foreground/50">{format(new Date(note.createdAt), "MMM d, yyyy")}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showCreate || !!editNote} onOpenChange={(o) => { if (!o) { setShowCreate(false); setEditNote(null); } }}>
        <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-base">{editNote ? "Edit Note" : "New Note"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Title</Label>
              <Input placeholder="Note title..." value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="bg-input border-border" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Content</Label>
              <Textarea placeholder="Write your note..." value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="bg-input border-border resize-none" rows={5} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Area</Label>
                <Select value={form.areaId} onValueChange={(v) => setForm({ ...form, areaId: v })}>
                  <SelectTrigger className="bg-input border-border h-8 text-xs"><SelectValue placeholder="Link to area" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">No area</SelectItem>{areas?.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Project</Label>
                <Select value={form.projectId} onValueChange={(v) => setForm({ ...form, projectId: v })}>
                  <SelectTrigger className="bg-input border-border h-8 text-xs"><SelectValue placeholder="Link to project" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">No project</SelectItem>{projects?.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tags (comma-separated)</Label>
              <Input placeholder="strategy, ideas, reference..." value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="bg-input border-border h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Attachment URL</Label>
              <Input placeholder="https://..." value={form.attachmentUrl} onChange={(e) => setForm({ ...form, attachmentUrl: e.target.value })} className="bg-input border-border h-8 text-xs" />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.isArchived} onCheckedChange={(v) => setForm({ ...form, isArchived: v })} />
              <Label className="text-xs text-muted-foreground">Archived</Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => { setShowCreate(false); setEditNote(null); }}>Cancel</Button>
            <Button size="sm" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>{editNote ? "Save changes" : "Create note"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
