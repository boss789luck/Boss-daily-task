import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { BookOpen, CheckCircle2, Sparkles, RefreshCw, Settings, Library, BookMarked, Loader2, ChevronDown, ChevronUp } from "lucide-react";

// ─── Genre Config ─────────────────────────────────────────────────────────────
const GENRE_CONFIG: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  business: { label: "การทำธุรกิจ", emoji: "💼", color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200" },
  finance: { label: "การเงิน", emoji: "💰", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  marketing: { label: "การตลาด", emoji: "📣", color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
  psychology: { label: "จิตวิทยา", emoji: "🧠", color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
  philosophy: { label: "ปรัชญาชีวิต", emoji: "🌿", color: "text-cyan-600", bg: "bg-cyan-50 border-cyan-200" },
  religion: { label: "ศาสนา", emoji: "🙏", color: "text-pink-600", bg: "bg-pink-50 border-pink-200" },
  management: { label: "การบริหารคน", emoji: "👥", color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
};

// ─── BookCover Component ──────────────────────────────────────────────────────
function BookCover({ emoji, color, size = "md" }: { emoji: string; color: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "w-12 h-16", md: "w-20 h-28", lg: "w-32 h-44" };
  const textSizes = { sm: "text-2xl", md: "text-4xl", lg: "text-6xl" };
  return (
    <div
      className={`${sizes[size]} rounded-lg flex items-center justify-center shadow-lg flex-shrink-0`}
      style={{ background: `linear-gradient(135deg, ${color}dd, ${color}88)` }}
    >
      <span className={textSizes[size]}>{emoji}</span>
    </div>
  );
}

// ─── CurrentBookCard ──────────────────────────────────────────────────────────
function CurrentBookCard() {
  const utils = trpc.useUtils();
  const { data: currentBook, isLoading } = trpc.bookSummaries.current.useQuery();
  const [expanded, setExpanded] = useState(false);

  const generateMutation = trpc.bookSummaries.generateNow.useMutation({
    onSuccess: () => {
      toast.success("สร้างหนังสือสัปดาห์นี้แล้ว!");
      utils.bookSummaries.current.invalidate();
      utils.bookSummaries.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const markReadMutation = trpc.bookSummaries.markRead.useMutation({
    onSuccess: () => {
      toast.success("ย้ายไปชั้นหนังสือแล้ว! 📚");
      utils.bookSummaries.current.invalidate();
      utils.bookSummaries.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <Card className="border-2 border-dashed">
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!currentBook) {
    return (
      <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-primary" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold text-lg">ยังไม่มีหนังสือสัปดาห์นี้</h3>
            <p className="text-sm text-muted-foreground mt-1">
              AI จะสร้างหนังสือใหม่ให้ทุกวันจันทร์ 08:00 น. หรือกดสร้างเลยตอนนี้
            </p>
          </div>
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="gap-2"
          >
            {generateMutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> กำลังสร้าง...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> สร้างหนังสือสัปดาห์นี้</>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const genreCfg = GENRE_CONFIG[currentBook.genre] ?? GENRE_CONFIG.business;
  let keyLessons: string[] = [];
  try { keyLessons = JSON.parse(currentBook.keyLessons); } catch { /* ignore */ }

  return (
    <Card className="border-2 border-primary/20 shadow-md overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-6 py-4 flex items-center gap-2">
        <BookOpen className="w-5 h-5 text-primary" />
        <span className="font-semibold text-primary">หนังสือบนโต๊ะ — สัปดาห์นี้</span>
        <Badge variant="outline" className="ml-auto text-xs">{currentBook.weekLabel}</Badge>
      </div>

      <CardContent className="p-6">
        {/* Book info row */}
        <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-5 mb-6">
          <BookCover emoji={currentBook.coverEmoji} color={currentBook.coverColor} size="lg" />
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold leading-tight">{currentBook.title}</h2>
            <p className="text-muted-foreground mt-1">โดย {currentBook.author}</p>
            <div className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-xs font-medium border ${genreCfg.bg} ${genreCfg.color}`}>
              <span>{genreCfg.emoji}</span>
              <span>{genreCfg.label}</span>
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                size="sm"
                variant="default"
                className="gap-1.5"
                onClick={() => markReadMutation.mutate({ id: currentBook.id })}
                disabled={markReadMutation.isPending}
              >
                {markReadMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                อ่านจบแล้ว
              </Button>
            </div>
          </div>
        </div>

        {/* Key lessons */}
        {keyLessons.length > 0 && (
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">💡 บทเรียนสำคัญ</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {keyLessons.map((lesson, i) => (
                <div key={i} className="flex gap-2 text-sm bg-muted/40 rounded-lg px-3 py-2">
                  <span className="text-primary font-bold flex-shrink-0">{i + 1}.</span>
                  <span>{lesson}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator className="my-4" />

        {/* Summary toggle */}
        <button
          className="w-full flex items-center justify-between text-sm font-medium text-primary hover:opacity-80 transition-opacity"
          onClick={() => setExpanded(!expanded)}
        >
          <span>📖 อ่านสรุปฉบับเต็ม (100-150 หน้า)</span>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {expanded && (
          <ScrollArea className="mt-4 h-[500px] pr-2">
            <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap text-sm leading-relaxed">
              {currentBook.summary}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

// ─── ShelfCard ────────────────────────────────────────────────────────────────
function ShelfSection() {
  const { data: allBooks, isLoading } = trpc.bookSummaries.list.useQuery();
  const utils = trpc.useUtils();
  const [selectedBook, setSelectedBook] = useState<number | null>(null);

  const deleteMutation = trpc.bookSummaries.delete.useMutation({
    onSuccess: () => {
      toast.success("ลบออกจากชั้นแล้ว");
      utils.bookSummaries.list.invalidate();
      setSelectedBook(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const readBooks = allBooks?.filter((b) => b.isRead) ?? [];
  const unreadBooks = allBooks?.filter((b) => !b.isRead) ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const BookRow = ({ book }: { book: typeof allBooks extends (infer T)[] | undefined ? T : never }) => {
    if (!book) return null;
    const genreCfg = GENRE_CONFIG[book.genre] ?? GENRE_CONFIG.business;
    const isSelected = selectedBook === book.id;
    let keyLessons: string[] = [];
    try { keyLessons = JSON.parse(book.keyLessons); } catch { /* ignore */ }

    return (
      <div className={`rounded-xl border transition-all ${isSelected ? "border-primary/50 shadow-md" : "border-border hover:border-primary/30"}`}>
        <button
          className="w-full flex items-center gap-4 p-4 text-left"
          onClick={() => setSelectedBook(isSelected ? null : book.id)}
        >
          <BookCover emoji={book.coverEmoji} color={book.coverColor} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{book.title}</div>
            <div className="text-sm text-muted-foreground truncate">โดย {book.author}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${genreCfg.bg} ${genreCfg.color}`}>
                {genreCfg.emoji} {genreCfg.label}
              </span>
              {book.isRead && (
                <span className="text-xs text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> อ่านแล้ว
                </span>
              )}
            </div>
          </div>
          <Badge variant="outline" className="text-xs flex-shrink-0">{book.weekLabel}</Badge>
          {isSelected ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
        </button>

        {isSelected && (
          <div className="px-4 pb-4 border-t">
            {keyLessons.length > 0 && (
              <div className="mt-3 mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">บทเรียนสำคัญ</p>
                <ul className="space-y-1">
                  {keyLessons.map((l, i) => (
                    <li key={i} className="text-sm flex gap-2">
                      <span className="text-primary font-bold">{i + 1}.</span> {l}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <ScrollArea className="h-64 mt-3">
              <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap text-sm leading-relaxed pr-2">
                {book.summary}
              </div>
            </ScrollArea>
            <div className="flex justify-end mt-3">
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => deleteMutation.mutate({ id: book.id })}
                disabled={deleteMutation.isPending}
              >
                ลบออกจากชั้น
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (readBooks.length === 0 && unreadBooks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <Library className="w-12 h-12 opacity-30" />
        <p className="text-sm">ยังไม่มีหนังสือในชั้น</p>
        <p className="text-xs">อ่านหนังสือบนโต๊ะให้จบเพื่อเพิ่มเข้าชั้น</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {readBooks.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <BookMarked className="w-4 h-4" /> ชั้นหนังสือ — อ่านแล้ว ({readBooks.length} เล่ม)
          </h3>
          <div className="space-y-2">
            {readBooks.map((book) => <BookRow key={book.id} book={book} />)}
          </div>
        </div>
      )}
      {unreadBooks.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <BookOpen className="w-4 h-4" /> รอบนโต๊ะ — ยังไม่ได้อ่าน ({unreadBooks.length} เล่ม)
          </h3>
          <div className="space-y-2">
            {unreadBooks.map((book) => <BookRow key={book.id} book={book} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PreferencesSection ───────────────────────────────────────────────────────
const GENRE_PREFS = [
  { key: "businessWeight", label: "การทำธุรกิจ", emoji: "💼" },
  { key: "financeWeight", label: "การเงิน", emoji: "💰" },
  { key: "marketingWeight", label: "การตลาด", emoji: "📣" },
  { key: "psychologyWeight", label: "จิตวิทยา", emoji: "🧠" },
  { key: "philosophyWeight", label: "ปรัชญาชีวิต", emoji: "🌿" },
  { key: "religionWeight", label: "ศาสนา", emoji: "🙏" },
  { key: "managementWeight", label: "การบริหารคน", emoji: "👥" },
] as const;

type PrefKey = typeof GENRE_PREFS[number]["key"];

function PreferencesSection() {
  const utils = trpc.useUtils();
  const { data: prefs, isLoading } = trpc.bookSummaries.getPreferences.useQuery();
  const [weights, setWeights] = useState<Record<PrefKey, number> | null>(null);

  const saveMutation = trpc.bookSummaries.savePreferences.useMutation({
    onSuccess: () => {
      toast.success("บันทึกความชอบแล้ว");
      utils.bookSummaries.getPreferences.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const currentWeights = weights ?? (prefs ? {
    businessWeight: prefs.businessWeight,
    financeWeight: prefs.financeWeight,
    marketingWeight: prefs.marketingWeight,
    psychologyWeight: prefs.psychologyWeight,
    philosophyWeight: prefs.philosophyWeight,
    religionWeight: prefs.religionWeight,
    managementWeight: prefs.managementWeight,
  } : {
    businessWeight: 100, financeWeight: 100, marketingWeight: 80,
    psychologyWeight: 70, philosophyWeight: 50, religionWeight: 50, managementWeight: 70,
  });

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Settings className="w-4 h-4" /> ความชอบในการอ่าน
        </CardTitle>
        <p className="text-sm text-muted-foreground">ปรับน้ำหนักแต่ละแนวหนังสือ (0 = ไม่ต้องการ, 100 = ต้องการมาก)</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {GENRE_PREFS.map(({ key, label, emoji }) => (
          <div key={key}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{emoji} {label}</span>
              <span className="text-sm font-bold text-primary w-8 text-right">{currentWeights[key]}%</span>
            </div>
            <Slider
              min={0}
              max={100}
              step={10}
              value={[currentWeights[key]]}
              onValueChange={([val]) => setWeights({ ...currentWeights, [key]: val })}
              className="w-full"
            />
          </div>
        ))}
        <Button
          className="w-full mt-4"
          onClick={() => saveMutation.mutate(currentWeights)}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> บันทึก...</> : "บันทึกความชอบ"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BookSummaries() {
  const { data: allBooks } = trpc.bookSummaries.list.useQuery();
  const readCount = allBooks?.filter((b) => b.isRead).length ?? 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-primary" />
            Book Summaries
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            สรุปหนังสือระดับโลก — AI สร้างให้ทุกวันจันทร์ · อ่านแล้ว {readCount} เล่ม
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>ทุกวันจันทร์</span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="desk">
        <TabsList className="w-full">
          <TabsTrigger value="desk" className="flex-1 gap-2">
            <BookOpen className="w-4 h-4" /> บนโต๊ะ
          </TabsTrigger>
          <TabsTrigger value="shelf" className="flex-1 gap-2">
            <Library className="w-4 h-4" /> ชั้นหนังสือ {readCount > 0 && <Badge variant="secondary" className="text-xs">{readCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex-1 gap-2">
            <Settings className="w-4 h-4" /> ความชอบ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="desk" className="mt-4">
          <CurrentBookCard />
        </TabsContent>

        <TabsContent value="shelf" className="mt-4">
          <ShelfSection />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <PreferencesSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
