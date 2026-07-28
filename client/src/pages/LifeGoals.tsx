import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus, Check, Trash2, Edit2, Sparkles, Star, Target, ChevronLeft, ChevronRight,
  Loader2, ImageIcon, ListChecks, Trophy, Wand2, X, Upload
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface BucketItem {
  id: number;
  text: string;
  category: string | null;
  isDone: boolean;
  sortOrder: number | null;
}

interface GoalItem {
  id: string;
  text: string;
  isDone: boolean;
}

interface YearlyGoalData {
  id: number;
  year: number;
  goals: GoalItem[];
  bgImageUrl: string | null;
  bgPrompt: string | null;
}

// ─── Bucket categories ────────────────────────────────────────────────────────
const BUCKET_CATEGORIES = [
  { value: "travel",       label: "ท่องเที่ยว",              emoji: "🌍", color: "text-sky-600",      bg: "bg-sky-50 dark:bg-sky-950/40",       border: "border-sky-200 dark:border-sky-800",       activeBg: "bg-sky-500",     desc: "สถานที่, การเดินทาง" },
  { value: "finance",      label: "การเงิน",                  emoji: "💰", color: "text-emerald-600",  bg: "bg-emerald-50 dark:bg-emerald-950/40", border: "border-emerald-200 dark:border-emerald-800", activeBg: "bg-emerald-500", desc: "เป้าหมายทางการเงิน" },
  { value: "health",       label: "สุขภาพ",                   emoji: "🏋️", color: "text-rose-600",     bg: "bg-rose-50 dark:bg-rose-950/40",       border: "border-rose-200 dark:border-rose-800",     activeBg: "bg-rose-500",    desc: "ร่างกาย, กีฬา, ฟิตเนส" },
  { value: "learning",     label: "การเรียนรู้",             emoji: "📚", color: "text-violet-600",   bg: "bg-violet-50 dark:bg-violet-950/40",   border: "border-violet-200 dark:border-violet-800", activeBg: "bg-violet-500",  desc: "ทักษะ, ภาษา, ความรู้" },
  { value: "career",       label: "อาชีพ/ธุรกิจ",         emoji: "💼", color: "text-amber-600",    bg: "bg-amber-50 dark:bg-amber-950/40",     border: "border-amber-200 dark:border-amber-800",   activeBg: "bg-amber-500",   desc: "งาน, ธุรกิจ, ความสำเร็จ" },
  { value: "relationship", label: "ความสัมพันธ์",         emoji: "❤️",  color: "text-pink-600",     bg: "bg-pink-50 dark:bg-pink-950/40",       border: "border-pink-200 dark:border-pink-800",     activeBg: "bg-pink-500",    desc: "ครอบครัว, เพื่อน, ความรัก" },
  { value: "adventure",    label: "ผจญภัย",                  emoji: "🏔️", color: "text-orange-600",  bg: "bg-orange-50 dark:bg-orange-950/40",   border: "border-orange-200 dark:border-orange-800", activeBg: "bg-orange-500",  desc: "กีฬาเอ็กซ์ตรีม, ความท้าทาย" },
  { value: "creativity",   label: "ความคิดสร้างสรรค์",   emoji: "🎨", color: "text-fuchsia-600",  bg: "bg-fuchsia-50 dark:bg-fuchsia-950/40", border: "border-fuchsia-200 dark:border-fuchsia-800", activeBg: "bg-fuchsia-500", desc: "ศิลปะ, ดนตรี, งานสร้างสรรค์" },
  { value: "possession",   label: "สิ่งที่อยากได้",        emoji: "🎁", color: "text-teal-600",     bg: "bg-teal-50 dark:bg-teal-950/40",       border: "border-teal-200 dark:border-teal-800",     activeBg: "bg-teal-500",    desc: "ของสะสม, ทรัพย์สิน" },
  { value: "general",      label: "ทั่วไป",                   emoji: "⭐",  color: "text-slate-600",    bg: "bg-slate-50 dark:bg-slate-900/40",     border: "border-slate-200 dark:border-slate-700",   activeBg: "bg-slate-500",   desc: "อื่นๆ" },
];

function getCategoryEmoji(cat: string | null) {
  return BUCKET_CATEGORIES.find((c) => c.value === cat)?.emoji ?? "⭐";
}
function getCategoryLabel(cat: string | null) {
  return BUCKET_CATEGORIES.find((c) => c.value === cat)?.label ?? "ทั่วไป";
}
function getCategoryMeta(cat: string | null) {
  return BUCKET_CATEGORIES.find((c) => c.value === cat) ?? BUCKET_CATEGORIES[BUCKET_CATEGORIES.length - 1];
}

// ─── Bucket List Section ──────────────────────────────────────────────────────
function BucketListSection() {
  const utils = trpc.useUtils();
  const { data: items = [], isLoading } = trpc.lifeGoals.listBucket.useQuery();
  const [newText, setNewText] = useState("");
  const [newCategory, setNewCategory] = useState("travel");
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [editItem, setEditItem] = useState<BucketItem | null>(null);
  const [editText, setEditText] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [showDone, setShowDone] = useState(true);

  const addItem = trpc.lifeGoals.addBucketItem.useMutation({
    onMutate: async (input) => {
      await utils.lifeGoals.listBucket.cancel();
      const prev = utils.lifeGoals.listBucket.getData();
      utils.lifeGoals.listBucket.setData(undefined, (old) => [
        ...(old ?? []),
        { id: -Date.now(), text: input.text, category: input.category ?? "general", isDone: false, sortOrder: (old?.length ?? 0), createdAt: new Date(), updatedAt: new Date(), userId: 0 },
      ]);
      return { prev };
    },
    onError: (_, __, ctx) => { if (ctx?.prev) utils.lifeGoals.listBucket.setData(undefined, ctx.prev); },
    onSettled: () => utils.lifeGoals.listBucket.invalidate(),
  });

  const toggleItem = trpc.lifeGoals.toggleBucketItem.useMutation({
    onMutate: async (input) => {
      await utils.lifeGoals.listBucket.cancel();
      const prev = utils.lifeGoals.listBucket.getData();
      utils.lifeGoals.listBucket.setData(undefined, (old) =>
        old?.map((i) => i.id === input.id ? { ...i, isDone: input.isDone } : i)
      );
      return { prev };
    },
    onError: (_, __, ctx) => { if (ctx?.prev) utils.lifeGoals.listBucket.setData(undefined, ctx.prev); },
    onSettled: () => utils.lifeGoals.listBucket.invalidate(),
  });

  const updateItem = trpc.lifeGoals.updateBucketItem.useMutation({
    onSuccess: () => { utils.lifeGoals.listBucket.invalidate(); setEditItem(null); toast.success("แก้ไขแล้ว"); },
  });

  const deleteItem = trpc.lifeGoals.deleteBucketItem.useMutation({
    onMutate: async (input) => {
      await utils.lifeGoals.listBucket.cancel();
      const prev = utils.lifeGoals.listBucket.getData();
      utils.lifeGoals.listBucket.setData(undefined, (old) => old?.filter((i) => i.id !== input.id));
      return { prev };
    },
    onError: (_, __, ctx) => { if (ctx?.prev) utils.lifeGoals.listBucket.setData(undefined, ctx.prev); },
    onSettled: () => utils.lifeGoals.listBucket.invalidate(),
  });

  const handleAdd = () => {
    if (!newText.trim()) return;
    addItem.mutate({ text: newText.trim(), category: newCategory });
    setNewText("");
  };

  const filteredItems = useMemo(() => {
    let list = items as BucketItem[];
    if (filterCat !== "all") list = list.filter((i) => i.category === filterCat);
    if (!showDone) list = list.filter((i) => !i.isDone);
    return list;
  }, [items, filterCat, showDone]);

  const doneCount = (items as BucketItem[]).filter((i) => i.isDone).length;
  const totalCount = (items as BucketItem[]).length;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="rounded-2xl border bg-card p-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
          <Trophy className="w-6 h-6 text-amber-500" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">สิ่งที่ทำสำเร็จแล้ว</p>
          <p className="text-2xl font-bold">{doneCount}<span className="text-base text-muted-foreground">/{totalCount}</span></p>
        </div>
        {totalCount > 0 && (
          <div className="text-right">
            <p className="text-3xl font-bold text-amber-500">{Math.round((doneCount / totalCount) * 100)}%</p>
          </div>
        )}
      </div>

      {/* Add new item */}
      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <h3 className="font-semibold text-sm flex items-center gap-2"><Plus className="w-4 h-4" /> เพิ่มสิ่งที่อยากทำในชีวิต</h3>
        {/* Category picker */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">หมวดหมู่</p>
          <div className="grid grid-cols-5 gap-1.5">
            {BUCKET_CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setNewCategory(c.value)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-center transition-all duration-150 ${
                  newCategory === c.value
                    ? `${c.bg} ${c.border} ring-2 ring-offset-1 ${c.color} scale-105`
                    : "border-transparent hover:bg-muted"
                }`}
              >
                <span className="text-xl leading-none">{c.emoji}</span>
                <span className={`text-[10px] font-medium leading-tight ${newCategory === c.value ? c.color : "text-muted-foreground"}`}>{c.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder={`เช่น ปีนยอดเขาฟูจิ, เรียนภาษาญี่ปุ่น... (${getCategoryMeta(newCategory).label})`}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="flex-1"
          />
          <Button onClick={handleAdd} disabled={!newText.trim()}>เพิ่ม</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex gap-1.5 flex-wrap items-center">
          <button
            onClick={() => setFilterCat("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 ${
              filterCat === "all"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            }`}
          >
            ✨ ทั้งหมด ({(items as BucketItem[]).length})
          </button>
          {BUCKET_CATEGORIES.map((c) => {
            const count = (items as BucketItem[]).filter((i) => i.category === c.value).length;
            if (count === 0) return null;
            const isActive = filterCat === c.value;
            return (
              <button
                key={c.value}
                onClick={() => setFilterCat(c.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? `${c.activeBg} text-white shadow-sm scale-105`
                    : `${c.bg} ${c.color} hover:opacity-80`
                }`}
              >
                {c.emoji} {c.label} ({count})
              </button>
            );
          })}
          <button
            onClick={() => setShowDone(!showDone)}
            className={`ml-auto px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              !showDone ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80 text-muted-foreground"
            }`}
          >
            {showDone ? "👁️ ซ่อนที่ทำแล้ว" : "✔️ แสดงที่ทำแล้ว"}
          </button>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
            <Star className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="font-semibold">ยังไม่มีรายการ</p>
          <p className="text-sm text-muted-foreground">เพิ่มสิ่งที่อยากทำในชีวิตของคุณ</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border bg-card p-3 flex items-center gap-3 transition-all duration-200 group ${item.isDone ? "opacity-60" : ""}`}
            >
              <button
                onClick={() => toggleItem.mutate({ id: item.id, isDone: !item.isDone })}
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                  item.isDone ? "bg-green-500 border-green-500 text-white" : "border-muted-foreground hover:border-primary"
                }`}
              >
                {item.isDone && <Check className="w-3.5 h-3.5" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium leading-tight ${item.isDone ? "line-through text-muted-foreground" : ""}`}>{item.text}</p>
                <div className="mt-1">
                  {(() => {
                    const meta = getCategoryMeta(item.category);
                    return (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${meta.bg} ${meta.color} ${meta.border} border`}>
                        {meta.emoji} {meta.label}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => { setEditItem(item); setEditText(item.text); }}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                <button
                  onClick={() => deleteItem.mutate({ id: item.id })}
                  className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editItem} onOpenChange={(v) => !v && setEditItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>แก้ไขรายการ</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Input value={editText} onChange={(e) => setEditText(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>ยกเลิก</Button>
            <Button onClick={() => { if (editItem) updateItem.mutate({ id: editItem.id, text: editText }); }}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Vision Board Full-Screen Modal ─────────────────────────────────────────
function VisionBoardModal({ bgUrl, goals, year, onClose }: {
  bgUrl: string;
  goals: GoalItem[];
  year: number;
  onClose: () => void;
}) {
  const doneCount = goals.filter((g) => g.isDone).length;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Portrait card — fills viewport on mobile, max 430px wide on desktop */}
      <div
        className="relative w-full h-full sm:w-[430px] sm:h-auto sm:max-h-[92dvh] sm:rounded-3xl overflow-hidden shadow-2xl"
        style={{
          backgroundImage: `url(${bgUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          aspectRatio: "9/16",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient overlay — darker at bottom for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/80" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top: title + year */}
        <div className="absolute top-6 left-6 z-10">
          <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">Vision Board</p>
          <h2 className="text-white text-3xl font-bold">{year}</h2>
          <p className="text-white/70 text-sm mt-1">{doneCount}/{goals.length} เป้าหมายสำเร็จ</p>
        </div>

        {/* Bottom: goals list */}
        <div className="absolute bottom-0 left-0 right-0 z-10 p-5 space-y-2.5 max-h-[55%] overflow-y-auto">
          {goals.map((g, i) => (
            <div
              key={g.id}
              className={`flex items-start gap-3 ${
                g.isDone ? "opacity-60" : ""
              }`}
            >
              <span className="text-xl leading-none mt-0.5 flex-shrink-0">
                {g.isDone ? "✅" : ["🎯", "💡", "🚀", "⭐", "💪", "🌟", "🔥", "🏆", "💎", "🌈"][i % 10]}
              </span>
              <p className={`text-white text-sm font-medium leading-snug ${
                g.isDone ? "line-through opacity-60" : ""
              }`}>{g.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Yearly Goals Section ─────────────────────────────────────────────────────
function YearlyGoalsSection() {
  const utils = trpc.useUtils();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [newGoalText, setNewGoalText] = useState("");
  const [localGoals, setLocalGoals] = useState<GoalItem[] | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showVisionBoard, setShowVisionBoard] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const { data: yearData, isLoading } = trpc.lifeGoals.getYearlyGoal.useQuery({ year });

  // Sync localGoals when yearData changes (but only if not dirty)
  React.useEffect(() => {
    if (!isDirty) setLocalGoals(yearData?.goals ?? []);
  }, [yearData, isDirty]);

  const goals: GoalItem[] = localGoals ?? yearData?.goals ?? [];

  const saveGoals = trpc.lifeGoals.saveYearlyGoal.useMutation({
    onSuccess: () => {
      utils.lifeGoals.getYearlyGoal.invalidate({ year });
      setIsDirty(false);
      toast.success("บันทึกเป้าหมายแล้ว");
    },
  });

  const generateBg = trpc.lifeGoals.generateBgImage.useMutation({
    onSuccess: (data) => {
      utils.lifeGoals.getYearlyGoal.invalidate({ year });
      toast.success("สร้างภาพ background แล้ว ✨");
    },
    onError: () => toast.error("สร้างภาพไม่สำเร็จ ลองใหม่อีกครั้ง"),
  });

  const handleAddGoal = () => {
    if (!newGoalText.trim()) return;
    const newGoal: GoalItem = { id: String(Date.now()), text: newGoalText.trim(), isDone: false };
    const updated = [...goals, newGoal];
    setLocalGoals(updated);
    setIsDirty(true);
    setNewGoalText("");
  };

  const handleToggleGoal = (id: string) => {
    const updated = goals.map((g) => g.id === id ? { ...g, isDone: !g.isDone } : g);
    setLocalGoals(updated);
    setIsDirty(true);
  };

  const handleDeleteGoal = (id: string) => {
    const updated = goals.filter((g) => g.id !== id);
    setLocalGoals(updated);
    setIsDirty(true);
  };

  const handleSave = () => {
    saveGoals.mutate({ year, goals });
  };

  const handleGenerateBg = () => {
    const goalTexts = goals.map((g) => g.text).filter(Boolean);
    if (goalTexts.length === 0) return toast.error("กรุณาเพิ่มเป้าหมายก่อน");
    generateBg.mutate({ year, goals: goalTexts });
  };

  const handleUploadCustomBg = async (file: File) => {
    if (!file) return;
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error("ไฟล์ใหญ่เกินไป (สูงสุด 10MB)");
      return;
    }
    setIsUploading(true);
    try {
      // Read as base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const resp = await fetch("/api/vision-board/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, imageBase64: base64, mimeType: file.type }),
        credentials: "include",
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error ?? "Upload failed");
      }
      utils.lifeGoals.getYearlyGoal.invalidate({ year });
      toast.success("อัปโหลดรูปสำเร็จ ✨");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ";
      toast.error(msg);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const bgUrl = yearData?.bgImageUrl;
  const doneCount = goals.filter((g) => g.isDone).length;

  return (
    <div className="space-y-5">
      {/* Full-screen Vision Board Modal */}
      {showVisionBoard && bgUrl && (
        <VisionBoardModal
          bgUrl={bgUrl}
          goals={goals}
          year={year}
          onClose={() => setShowVisionBoard(false)}
        />
      )}

      {/* Year selector */}
      <div className="flex items-center justify-between">
        <button onClick={() => { setYear(y => y - 1); setLocalGoals(null); setIsDirty(false); }} className="p-2 rounded-xl hover:bg-muted transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h2 className="font-bold text-xl">เป้าหมายปี {year}</h2>
          <p className="text-xs text-muted-foreground">{goals.length} เป้าหมาย · สำเร็จ {doneCount}/{goals.length}</p>
        </div>
        <button onClick={() => { setYear(y => y + 1); setLocalGoals(null); setIsDirty(false); }} className="p-2 rounded-xl hover:bg-muted transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Vision Board Card — large standalone card */}
      <div
        className="relative rounded-2xl overflow-hidden border cursor-pointer group"
        style={{
          aspectRatio: "4/3",
          backgroundImage: bgUrl ? `url(${bgUrl})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        onClick={() => bgUrl && setShowVisionBoard(true)}
      >
        {/* Overlay */}
        <div className={`absolute inset-0 transition-opacity duration-300 ${
          bgUrl
            ? "bg-gradient-to-b from-black/20 via-transparent to-black/70 group-hover:from-black/30 group-hover:to-black/80"
            : "bg-gradient-to-br from-indigo-500/20 to-purple-500/20"
        }`} />

        {/* No image placeholder */}
        {!bgUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center">
              <ImageIcon className="w-8 h-8 opacity-40" />
            </div>
            <p className="text-sm font-medium">ยังไม่มีภาพ Vision Board</p>
            <p className="text-xs opacity-60">เพิ่มเป้าหมาย แล้วกด ✨ AI สร้างภาพ</p>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUploadCustomBg(file);
          }}
        />

        {/* Top-right: buttons row */}
        <div className="absolute top-3 right-3 z-10 flex gap-2" onClick={(e) => e.stopPropagation()}>
          {/* Upload custom image */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || generateBg.isPending}
            className={`text-xs gap-1.5 shadow-lg ${
              bgUrl
                ? "bg-black/40 border-white/20 text-white hover:bg-black/60 backdrop-blur-sm"
                : ""
            }`}
          >
            {isUploading ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> อัปโหลด...</>
            ) : (
              <><Upload className="w-3.5 h-3.5" /> อัปโหลดรูป</>
            )}
          </Button>
          {/* AI generate */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateBg}
            disabled={generateBg.isPending || isUploading || goals.length === 0}
            className={`text-xs gap-1.5 shadow-lg ${
              bgUrl
                ? "bg-black/40 border-white/20 text-white hover:bg-black/60 backdrop-blur-sm"
                : ""
            }`}
          >
            {generateBg.isPending ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> กำลังสร้าง...</>
            ) : (
              <><Wand2 className="w-3.5 h-3.5" /> {bgUrl ? "AI ใหม่" : "✨ AI สร้างภาพ"}</>
            )}
          </Button>
        </div>

        {/* Bottom overlay: title + progress + "tap to expand" hint */}
        {bgUrl && (
          <div className="absolute bottom-0 left-0 right-0 z-10 p-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-white/60 text-xs uppercase tracking-widest font-semibold mb-0.5">Vision Board</p>
                <h3 className="text-white text-2xl font-bold">{year}</h3>
                <p className="text-white/70 text-xs mt-1">
                  {doneCount}/{goals.length} เป้าหมายสำเร็จ ({goals.length > 0 ? Math.round((doneCount / goals.length) * 100) : 0}%)
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5 text-white text-xs font-medium">
                  <span>ดูเต็มจอ</span>
                  <span className="text-base leading-none">↗️</span>
                </div>
              </div>
            </div>
            {/* Mini goals preview */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {goals.slice(0, 5).map((g, i) => (
                <span
                  key={g.id}
                  className={`text-xs rounded-full px-2.5 py-1 font-medium backdrop-blur-sm ${
                    g.isDone
                      ? "bg-green-500/70 text-white"
                      : "bg-white/20 text-white"
                  }`}
                >
                  {g.isDone ? "✅" : ["🎯", "💡", "🚀", "⭐", "💪"][i % 5]} {g.text.length > 18 ? g.text.slice(0, 18) + "…" : g.text}
                </span>
              ))}
              {goals.length > 5 && (
                <span className="text-xs rounded-full px-2.5 py-1 bg-white/10 text-white/70">
                  +{goals.length - 5} อีก
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add goal */}
      <div className="flex gap-2">
        <Input
          value={newGoalText}
          onChange={(e) => setNewGoalText(e.target.value)}
          placeholder={`เพิ่มเป้าหมายปี ${year}... เช่น ออมเงิน 500,000 บาท`}
          onKeyDown={(e) => e.key === "Enter" && handleAddGoal()}
          className="flex-1"
        />
        <Button onClick={handleAddGoal} disabled={!newGoalText.trim()}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Goals list */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : goals.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">ยังไม่มีเป้าหมาย — เพิ่มเป้าหมายแรกของปี {year}</div>
      ) : (
        <div className="space-y-2">
          {goals.map((g, i) => (
            <div
              key={g.id}
              className={`rounded-xl border bg-card p-3 flex items-center gap-3 group transition-all duration-200 ${g.isDone ? "opacity-60" : ""}`}
            >
              <span className="text-muted-foreground text-xs w-5 text-center font-mono">{i + 1}</span>
              <button
                onClick={() => handleToggleGoal(g.id)}
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                  g.isDone ? "bg-green-500 border-green-500 text-white" : "border-muted-foreground hover:border-primary"
                }`}
              >
                {g.isDone && <Check className="w-3.5 h-3.5" />}
              </button>
              <p className={`flex-1 text-sm font-medium ${g.isDone ? "line-through text-muted-foreground" : ""}`}>{g.text}</p>
              <button
                onClick={() => handleDeleteGoal(g.id)}
                className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Save button */}
      {isDirty && (
        <div className="sticky bottom-4">
          <Button className="w-full shadow-lg" onClick={handleSave} disabled={saveGoals.isPending}>
            {saveGoals.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> กำลังบันทึก...</> : "💾 บันทึกเป้าหมาย"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LifeGoals() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"bucket" | "yearly">("yearly");

  if (!user) return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center space-y-4">
        <p className="text-muted-foreground">กรุณาเข้าสู่ระบบก่อน</p>
        <Button asChild><a href={getLoginUrl()}>เข้าสู่ระบบ</a></Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <div>
            <h1 className="font-bold text-lg leading-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" /> Life Goals
            </h1>
            <p className="text-xs text-muted-foreground">เป้าหมายในชีวิต · สิ่งที่อยากทำ</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="w-full mb-6">
            <TabsTrigger value="yearly" className="flex-1">
              <Target className="w-4 h-4 mr-1.5" /> เป้าหมายรายปี
            </TabsTrigger>
            <TabsTrigger value="bucket" className="flex-1">
              <ListChecks className="w-4 h-4 mr-1.5" /> Bucket List
            </TabsTrigger>
          </TabsList>

          <TabsContent value="yearly">
            <YearlyGoalsSection />
          </TabsContent>

          <TabsContent value="bucket">
            <BucketListSection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
