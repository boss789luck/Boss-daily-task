import React, { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Dumbbell, TrendingUp, BookOpen, Moon, Sun, Target, Check, Plus, Settings,
  ChevronLeft, ChevronRight, BarChart2, Calendar, Flame, Edit2, Trash2,
  Clock, Activity, Star, Zap, Heart, Coffee, Music, Bike, Leaf, Award
} from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────
type HabitType = "frequency" | "time_limit" | "book" | "monthly_frequency";

interface Habit {
  id: number;
  name: string;
  icon: string | null;
  color: string | null;
  type: HabitType;
  weeklyTarget: number | null;
  monthlyTarget?: number | null;
  timeLimit: string | null;
  isBeforeLimit: boolean | null;
  scoreWeight: number | null;
  isActive: boolean;
}

// ─── Icon Map ─────────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  dumbbell: Dumbbell, "trending-up": TrendingUp, "book-open": BookOpen, moon: Moon, sun: Sun,
  target: Target, activity: Activity, heart: Heart, coffee: Coffee, music: Music,
  bike: Bike, leaf: Leaf, zap: Zap, star: Star, flame: Flame, clock: Clock,
};

const ICON_OPTIONS = Object.keys(ICON_MAP);

const COLOR_OPTIONS = [
  "#22c55e", "#f59e0b", "#6366f1", "#8b5cf6", "#f97316",
  "#ec4899", "#14b8a6", "#ef4444", "#3b82f6", "#a3e635",
];

function HabitIcon({ icon, className, style }: { icon: string | null; className?: string; style?: React.CSSProperties }) {
  const Comp = ICON_MAP[icon ?? "target"] ?? Target;
  return <Comp className={className} style={style} />;
}

// ─── Bangkok date helpers ─────────────────────────────────────────────────────
function todayBKK(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

function getBKKMonthYear(): { year: number; month: number } {
  const d = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const [y, m] = d.split("-").map(Number);
  return { year: y, month: m };
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function monthName(month: number, year: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString("th-TH", { month: "long", year: "numeric" });
}

// ─── Score Ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : score >= 40 ? "#f97316" : "#ef4444";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={10} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={10}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.23,1,0.32,1)" }}
      />
      <text
        x={size / 2} y={size / 2 + 2}
        textAnchor="middle" dominantBaseline="middle"
        style={{ transform: "rotate(90deg)", transformOrigin: `${size / 2}px ${size / 2}px`, fill: color, fontSize: size * 0.22, fontWeight: 700 }}
      >
        {score}
      </text>
      <text
        x={size / 2} y={size / 2 + size * 0.18}
        textAnchor="middle" dominantBaseline="middle"
        style={{ transform: "rotate(90deg)", transformOrigin: `${size / 2}px ${size / 2}px`, fill: "hsl(var(--muted-foreground))", fontSize: size * 0.11 }}
      >
        คะแนน
      </text>
    </svg>
  );
}

// ─── Habit Card ───────────────────────────────────────────────────────────────
function HabitCard({
  habit, score, todayLog, onCheckin, onEdit, onDelete
}: {
  habit: Habit;
  score: number;
  todayLog?: { completed: boolean; loggedTime?: string | null; activityType?: string | null; durationMinutes?: number | null };
  onCheckin: (habitId: number, data: { completed: boolean; loggedTime?: string; activityType?: string; durationMinutes?: number }) => void;
  onEdit: (habit: Habit) => void;
  onDelete: (habitId: number) => void;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const [loggedTime, setLoggedTime] = useState(todayLog?.loggedTime ?? "");
  const [activityType, setActivityType] = useState(todayLog?.activityType ?? "");
  const [duration, setDuration] = useState(String(todayLog?.durationMinutes ?? ""));

  const isDone = todayLog?.completed ?? false;
  const color = habit.color ?? "#6366f1";

  const handleToggle = () => {
    if (habit.type === "time_limit") {
      setShowDetail(true);
    } else {
      onCheckin(habit.id, { completed: !isDone, activityType: activityType || undefined, durationMinutes: duration ? parseInt(duration) : undefined });
    }
  };

  const handleSaveDetail = () => {
    onCheckin(habit.id, {
      completed: true,
      loggedTime: loggedTime || undefined,
      activityType: activityType || undefined,
      durationMinutes: duration ? parseInt(duration) : undefined,
    });
    setShowDetail(false);
  };

  return (
    <>
      <div
        className="rounded-2xl border bg-card p-4 flex flex-col gap-3 transition-all duration-200 hover:shadow-md"
        style={{ borderLeft: `4px solid ${color}` }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}22` }}>
              <HabitIcon icon={habit.icon} className="w-5 h-5" style={{ color } as React.CSSProperties} />
            </div>
            <div>
              <p className="font-semibold text-sm leading-tight">{habit.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {habit.type === "frequency" && `${habit.weeklyTarget ?? 3}x/สัปดาห์`}
                {habit.type === "monthly_frequency" && `${(habit as any).monthlyTarget ?? 4}x/เดือน`}
                {habit.type === "time_limit" && (habit.isBeforeLimit ? `ก่อน ${habit.timeLimit}` : `หลัง ${habit.timeLimit}`)}
                {habit.type === "book" && "อ่านหนังสือ"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => onEdit(habit)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <button onClick={() => onDelete(habit.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors">
              <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Score bar */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">คะแนนเดือนนี้</span>
            <span className="text-xs font-bold" style={{ color }}>{score}%</span>
          </div>
          <Progress value={score} className="h-1.5" style={{ "--progress-color": color } as React.CSSProperties} />
        </div>

        {/* Today check-in */}
        <button
          onClick={handleToggle}
          className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-all duration-150 active:scale-[0.97] ${
            isDone
              ? "text-white"
              : "border-2 border-dashed hover:border-solid"
          }`}
          style={isDone ? { background: color } : { borderColor: color, color }}
        >
          {isDone ? (
            <><Check className="w-4 h-4" /> ทำแล้ววันนี้</>
          ) : (
            <><Plus className="w-4 h-4" /> บันทึกวันนี้</>
          )}
        </button>

        {/* Time log detail */}
        {habit.type === "time_limit" && todayLog?.loggedTime && (
          <p className="text-xs text-center text-muted-foreground">⏰ {todayLog.loggedTime} น.</p>
        )}
      </div>

      {/* Detail dialog for time_limit */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HabitIcon icon={habit.icon} className="w-5 h-5" />
              {habit.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>เวลาที่ทำ (HH:MM)</Label>
              <Input
                type="time"
                value={loggedTime}
                onChange={(e) => setLoggedTime(e.target.value)}
                placeholder="22:30"
              />
            </div>
            {habit.type !== "time_limit" && (
              <div className="space-y-2">
                <Label>ระยะเวลา (นาที)</Label>
                <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="45" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetail(false)}>ยกเลิก</Button>
            <Button onClick={handleSaveDetail}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Calendar View ────────────────────────────────────────────────────────────
function HabitCalendarView({
  habits, logs, year, month, selectedDate, onSelectDate, selectedDateLogs, onCheckinDate, isCheckinPending
}: {
  habits: Habit[];
  logs: { habitId: number; logDate: string; completed: boolean; loggedTime?: string | null }[];
  year: number;
  month: number;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  selectedDateLogs: { habitId: number; completed: boolean; loggedTime?: string | null }[];
  onCheckinDate: (habitId: number, data: { completed: boolean; loggedTime?: string }) => void;
  isCheckinPending: boolean;
}) {
  const days = daysInMonth(year, month);
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const today = todayBKK();
  const [timeInputHabitId, setTimeInputHabitId] = useState<number | null>(null);
  const [timeInputValue, setTimeInputValue] = useState("");

  const logMap = useMemo(() => {
    const m = new Map<string, Map<number, boolean>>();
    for (const log of logs) {
      if (!m.has(log.logDate)) m.set(log.logDate, new Map());
      m.get(log.logDate)!.set(log.habitId, log.completed);
    }
    return m;
  }, [logs]);

  const dayCompletionRate = (dateStr: string) => {
    const dayLogs = logMap.get(dateStr);
    if (!dayLogs) return 0;
    const done = Array.from(dayLogs.values()).filter(Boolean).length;
    return habits.length > 0 ? done / habits.length : 0;
  };

  const isRetroactive = selectedDate !== null && selectedDate !== today;

  return (
    <div className="space-y-4">
      {/* Calendar grid */}
      <div className="rounded-2xl border bg-card p-4">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((d) => (
            <div key={d} className="text-center text-xs text-muted-foreground font-medium py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
          {Array.from({ length: days }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const rate = dayCompletionRate(dateStr);
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDate;
            const isFuture = dateStr > today;

            return (
              <button
                key={day}
                onClick={() => !isFuture && onSelectDate(isSelected ? null : dateStr)}
                disabled={isFuture}
                className={`aspect-square rounded-lg flex items-center justify-center text-xs font-medium transition-all duration-150 ${
                  isSelected ? "ring-2 ring-primary" : ""
                } ${isToday ? "ring-2 ring-offset-1 ring-blue-500" : ""} ${
                  isFuture ? "opacity-30 cursor-not-allowed" : "cursor-pointer hover:scale-105"
                }`}
                style={{
                  background: isFuture ? undefined : rate === 0 ? "hsl(var(--muted))" : `oklch(${0.5 + rate * 0.3} ${0.1 + rate * 0.15} 142)`,
                  color: rate > 0.5 ? "white" : undefined,
                }}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {/* Day detail panel */}
      {selectedDate && (
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">
              {new Date(selectedDate + "T12:00:00+07:00").toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long" })}
            </h3>
            {isRetroactive && (
              <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">
                ✏️ แก้ไขย้อนหลัง
              </span>
            )}
          </div>
          <div className="space-y-2">
            {habits.map((h) => {
              const selLog = selectedDateLogs.find((l) => l.habitId === h.id);
              const done = selLog?.completed ?? false;
              const loggedTime = selLog?.loggedTime ?? null;
              const isTimeHabit = h.type === "time_limit";
              const showTimeInput = timeInputHabitId === h.id;

              const handleToggle = () => {
                if (isTimeHabit && !done) {
                  // Show inline time input
                  setTimeInputHabitId(h.id);
                  setTimeInputValue(loggedTime ?? "");
                } else {
                  onCheckinDate(h.id, { completed: !done });
                }
              };

              const handleSaveTime = () => {
                onCheckinDate(h.id, { completed: true, loggedTime: timeInputValue || undefined });
                setTimeInputHabitId(null);
                setTimeInputValue("");
              };

              return (
                <div key={h.id} className="space-y-1.5">
                  <div className="flex items-center gap-3 py-1">
                    <button
                      onClick={handleToggle}
                      disabled={isCheckinPending}
                      className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-150 active:scale-95 ${
                        done ? "text-white" : "border-2 hover:opacity-70"
                      }`}
                      style={done ? { background: h.color ?? "#6366f1" } : { borderColor: h.color ?? "#6366f1" }}
                    >
                      {done && <Check className="w-3.5 h-3.5" />}
                    </button>
                    <HabitIcon icon={h.icon} className="w-4 h-4 flex-shrink-0" style={{ color: h.color ?? "#6366f1" } as React.CSSProperties} />
                    <span className={`text-sm flex-1 ${done ? "line-through text-muted-foreground" : ""}`}>{h.name}</span>
                    {loggedTime && !showTimeInput && (
                      <button
                        onClick={() => { setTimeInputHabitId(h.id); setTimeInputValue(loggedTime); }}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                      >
                        <Clock className="w-3 h-3" />{loggedTime}
                      </button>
                    )}
                  </div>
                  {/* Inline time input for time_limit habits */}
                  {showTimeInput && (
                    <div className="ml-9 flex items-center gap-2">
                      <input
                        type="time"
                        value={timeInputValue}
                        onChange={(e) => setTimeInputValue(e.target.value)}
                        className="text-sm border rounded-lg px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveTime}
                        className="text-xs px-3 py-1 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors"
                      >
                        บันทึก
                      </button>
                      <button
                        onClick={() => { setTimeInputHabitId(null); setTimeInputValue(""); }}
                        className="text-xs px-2 py-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {habits.length > 0 && (
            <p className="text-xs text-muted-foreground pt-1 border-t">
              {selectedDateLogs.filter((l) => l.completed).length}/{habits.length} habit สำเร็จ
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Analytics View ───────────────────────────────────────────────────────────
function HabitAnalyticsView({
  habits, logs, year, month
}: {
  habits: Habit[];
  logs: { habitId: number; logDate: string; completed: boolean; loggedTime?: string | null }[];
  year: number;
  month: number;
}) {
  const days = daysInMonth(year, month);

  // Weekly completion data
  const weeklyData = useMemo(() => {
    const weeks: { week: string; [key: string]: number | string }[] = [];
    for (let w = 0; w < 5; w++) {
      const weekStart = w * 7 + 1;
      const weekEnd = Math.min(weekStart + 6, days);
      const weekLabel = `W${w + 1}`;
      const entry: { week: string; [key: string]: number | string } = { week: weekLabel };
      for (const h of habits) {
        let count = 0;
        for (let d = weekStart; d <= weekEnd; d++) {
          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const log = logs.find((l) => l.habitId === h.id && l.logDate === dateStr);
          if (log?.completed) count++;
        }
        entry[h.name] = count;
      }
      weeks.push(entry);
    }
    return weeks;
  }, [habits, logs, year, month, days]);

  // Daily completion trend
  const dailyData = useMemo(() => {
    const today = todayBKK();
    return Array.from({ length: days }, (_, i) => {
      const day = i + 1;
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (dateStr > today) return null;
      const done = logs.filter((l) => l.logDate === dateStr && l.completed).length;
      return { day, rate: habits.length > 0 ? Math.round((done / habits.length) * 100) : 0 };
    }).filter(Boolean) as { day: number; rate: number }[];
  }, [habits, logs, year, month, days]);

  // Sleep/Wake time data
  const sleepWakeHabits = habits.filter((h) => h.type === "time_limit");
  const timeData = useMemo(() => {
    if (sleepWakeHabits.length === 0) return [];
    const today = todayBKK();
    return Array.from({ length: Math.min(14, days) }, (_, i) => {
      const day = i + 1;
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (dateStr > today) return null;
      const entry: { day: number; [key: string]: number | string } = { day };
      for (const h of sleepWakeHabits) {
        const log = logs.find((l) => l.habitId === h.id && l.logDate === dateStr);
        if (log?.loggedTime) {
          const [hh, mm] = log.loggedTime.split(":").map(Number);
          entry[h.name] = hh + mm / 60;
        }
      }
      return entry;
    }).filter(Boolean) as { day: number; [key: string]: number | string }[];
  }, [sleepWakeHabits, logs, year, month, days]);

  const COLORS = ["#22c55e", "#f59e0b", "#6366f1", "#8b5cf6", "#f97316", "#ec4899"];

  return (
    <div className="space-y-6">
      {/* Weekly bar chart */}
      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <h3 className="font-semibold text-sm flex items-center gap-2"><BarChart2 className="w-4 h-4" /> ความถี่รายสัปดาห์</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={weeklyData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
            <XAxis dataKey="week" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            {habits.map((h, i) => (
              <Bar key={h.id} dataKey={h.name} fill={h.color ?? COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Daily completion rate */}
      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <h3 className="font-semibold text-sm flex items-center gap-2"><Activity className="w-4 h-4" /> อัตราทำสำเร็จรายวัน (%)</h3>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={dailyData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
            <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={4} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => `${v}%`} />
            <Line type="monotone" dataKey="rate" stroke="#6366f1" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Sleep/Wake chart */}
      {timeData.length > 0 && sleepWakeHabits.length > 0 && (
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2"><Clock className="w-4 h-4" /> เวลานอน/ตื่น (14 วันล่าสุด)</h3>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={timeData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis domain={[5, 25]} tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.floor(v)}:00`} />
              <Tooltip formatter={(v: number) => `${Math.floor(v)}:${String(Math.round((v % 1) * 60)).padStart(2, "0")}`} />
              {sleepWakeHabits.map((h, i) => (
                <Line key={h.id} type="monotone" dataKey={h.name} stroke={h.color ?? COLORS[i]} strokeWidth={2} dot={{ r: 3 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-4 flex-wrap">
            {sleepWakeHabits.map((h) => (
              <div key={h.id} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ background: h.color ?? "#6366f1" }} />
                <span className="text-xs text-muted-foreground">{h.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Habit score summary */}
      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <h3 className="font-semibold text-sm flex items-center gap-2"><Award className="w-4 h-4" /> สรุปคะแนนแต่ละ Habit</h3>
        <div className="space-y-3">
          {habits.map((h, i) => {
            const habitLogs = logs.filter((l) => l.habitId === h.id && l.completed);
            const rate = days > 0 ? Math.min(100, Math.round((habitLogs.length / days) * 100)) : 0;
            return (
              <div key={h.id} className="space-y-1">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <HabitIcon icon={h.icon} className="w-4 h-4" style={{ color: h.color ?? COLORS[i % COLORS.length] } as React.CSSProperties} />
                    <span className="text-sm">{h.name}</span>
                  </div>
                  <span className="text-sm font-semibold" style={{ color: h.color ?? COLORS[i % COLORS.length] }}>{rate}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${rate}%`, background: h.color ?? COLORS[i % COLORS.length] }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Habit Form Dialog ────────────────────────────────────────────────────────
function HabitFormDialog({
  open, onOpenChange, habit, onSave
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  habit?: Habit | null;
  onSave: (data: Partial<Habit> & { name: string; type: HabitType }) => void;
}) {
  const [name, setName] = useState(habit?.name ?? "");
  const [icon, setIcon] = useState(habit?.icon ?? "target");
  const [color, setColor] = useState(habit?.color ?? "#6366f1");
  const [type, setType] = useState<HabitType>((habit?.type as HabitType) ?? "frequency");
  const [weeklyTarget, setWeeklyTarget] = useState(String(habit?.weeklyTarget ?? 3));
  const [monthlyTarget, setMonthlyTarget] = useState(String((habit as any)?.monthlyTarget ?? 4));
  const [timeLimit, setTimeLimit] = useState(habit?.timeLimit ?? "23:00");
  const [isBeforeLimit, setIsBeforeLimit] = useState(habit?.isBeforeLimit ?? true);
  const [scoreWeight, setScoreWeight] = useState(String(habit?.scoreWeight ?? 20));

  React.useEffect(() => {
    if (habit) {
      setName(habit.name); setIcon(habit.icon ?? "target"); setColor(habit.color ?? "#6366f1");
      setType((habit.type as HabitType)); setWeeklyTarget(String(habit.weeklyTarget ?? 3));
      setMonthlyTarget(String((habit as any).monthlyTarget ?? 4));
      setTimeLimit(habit.timeLimit ?? "23:00"); setIsBeforeLimit(habit.isBeforeLimit ?? true);
      setScoreWeight(String(habit.scoreWeight ?? 20));
    } else {
      setName(""); setIcon("target"); setColor("#6366f1"); setType("frequency");
      setWeeklyTarget("3"); setMonthlyTarget("4"); setTimeLimit("23:00"); setIsBeforeLimit(true); setScoreWeight("20");
    }
  }, [habit, open]);

  const handleSave = () => {
    if (!name.trim()) return toast.error("กรุณาใส่ชื่อ Habit");
    onSave({ name: name.trim(), icon, color, type, weeklyTarget: parseInt(weeklyTarget), monthlyTarget: parseInt(monthlyTarget), timeLimit, isBeforeLimit, scoreWeight: parseFloat(scoreWeight) } as any);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{habit ? "แก้ไข Habit" : "เพิ่ม Habit ใหม่"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>ชื่อ Habit *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น ออกกำลังกาย" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>ไอคอน</Label>
              <Select value={icon} onValueChange={setIcon}>
                <SelectTrigger>
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <HabitIcon icon={icon} className="w-4 h-4" />
                      <span className="text-xs">{icon}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map((ic) => (
                    <SelectItem key={ic} value={ic}>
                      <div className="flex items-center gap-2">
                        <HabitIcon icon={ic} className="w-4 h-4" />
                        <span>{ic}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>สี</Label>
              <div className="flex gap-1.5 flex-wrap">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className="w-6 h-6 rounded-full transition-transform hover:scale-110"
                    style={{ background: c, outline: color === c ? `2px solid ${c}` : "none", outlineOffset: 2 }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>ประเภท</Label>
            <Select value={type} onValueChange={(v) => setType(v as HabitType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="frequency">ความถี่ (กี่ครั้ง/สัปดาห์)</SelectItem>
                <SelectItem value="monthly_frequency">ความถี่ (กี่ครั้ง/เดือน)</SelectItem>
                <SelectItem value="time_limit">เวลา (ก่อน/หลังเวลาที่กำหนด)</SelectItem>
                <SelectItem value="book">อ่านหนังสือ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === "frequency" && (
            <div className="space-y-2">
              <Label>เป้าหมาย (ครั้ง/สัปดาห์)</Label>
              <Input type="number" min={1} max={7} value={weeklyTarget} onChange={(e) => setWeeklyTarget(e.target.value)} />
            </div>
          )}
          {type === "monthly_frequency" && (
            <div className="space-y-2">
              <Label>เป้าหมาย (ครั้ง/เดือน)</Label>
              <Input type="number" min={1} max={365} value={monthlyTarget} onChange={(e) => setMonthlyTarget(e.target.value)} placeholder="เช่น 8" />
              <p className="text-xs text-muted-foreground">นับยอดรวมทั้งเดือน ไม่จำกัดวันใดวันหนึ่ง</p>
            </div>
          )}

          {type === "time_limit" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>เวลากำหนด</Label>
                <Input type="time" value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>เงื่อนไข</Label>
                <Select value={isBeforeLimit ? "before" : "after"} onValueChange={(v) => setIsBeforeLimit(v === "before")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="before">ต้องทำก่อนเวลาที่กำหนด</SelectItem>
                    <SelectItem value="after">ต้องทำหลังเวลาที่กำหนด</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>น้ำหนักคะแนน (%)</Label>
            <Input type="number" min={0} max={100} value={scoreWeight} onChange={(e) => setScoreWeight(e.target.value)} />
            <p className="text-xs text-muted-foreground">ผลต่อคะแนนรวมเดือนนี้ (ทุก Habit รวมกัน = 100%)</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button onClick={handleSave}>{habit ? "บันทึก" : "เพิ่ม Habit"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main HabitOS Page ────────────────────────────────────────────────────────
export default function HabitOS() {
  const { user } = useAuth();
  const authLoading = false;
  const today = todayBKK();
  const { year: currentYear, month: currentMonth } = getBKKMonthYear();
  const [viewYear, setViewYear] = useState(currentYear);
  const [viewMonth, setViewMonth] = useState(currentMonth);
  const [tab, setTab] = useState<"today" | "calendar" | "analytics">("today");
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [calSelectedDate, setCalSelectedDate] = useState<string | null>(null);

  const utils = trpc.useUtils();

  // Queries
  const habitsQ = trpc.habits.list.useQuery(undefined, { enabled: !!user });
  const monthScoreQ = trpc.habits.monthScore.useQuery({ year: viewYear, month: viewMonth }, { enabled: !!user });
  const logsQ = trpc.habits.logsForMonth.useQuery({ year: viewYear, month: viewMonth }, { enabled: !!user });
  const todayLogsQ = trpc.habits.logsForDate.useQuery({ date: today }, { enabled: !!user });
  // Query logs for the selected calendar date (for retroactive editing)
  const calDateLogsQ = trpc.habits.logsForDate.useQuery(
    { date: calSelectedDate ?? today },
    { enabled: !!user && calSelectedDate !== null && calSelectedDate !== today }
  );

  // Mutations
  const createHabit = trpc.habits.create.useMutation({
    onSuccess: () => { utils.habits.list.invalidate(); utils.habits.monthScore.invalidate(); toast.success("เพิ่ม Habit แล้ว"); },
  });
  const updateHabit = trpc.habits.update.useMutation({
    onSuccess: () => { utils.habits.list.invalidate(); utils.habits.monthScore.invalidate(); toast.success("อัปเดต Habit แล้ว"); },
  });
  const deleteHabit = trpc.habits.delete.useMutation({
    onSuccess: () => { utils.habits.list.invalidate(); utils.habits.monthScore.invalidate(); toast.success("ลบ Habit แล้ว"); },
  });
  const checkin = trpc.habits.checkin.useMutation({
    onMutate: async (input) => {
      // Parse year/month from logDate for logsForMonth optimistic update
      const [logYear, logMonth] = input.logDate.split("-").map(Number);
      const monthKey = { year: logYear, month: logMonth };

      await utils.habits.logsForDate.cancel({ date: input.logDate });
      await utils.habits.logsForMonth.cancel(monthKey);

      const prevDate = utils.habits.logsForDate.getData({ date: input.logDate });
      const prevMonth = utils.habits.logsForMonth.getData(monthKey);

      const newLogEntry = {
        id: 0, userId: 0, habitId: input.habitId, logDate: input.logDate,
        completed: input.completed, activityType: input.activityType ?? null,
        durationMinutes: input.durationMinutes ?? null, topic: null, notes: null,
        loggedTime: input.loggedTime ?? null, createdAt: new Date(), updatedAt: new Date(),
      };

      // Optimistic update: logsForDate
      utils.habits.logsForDate.setData({ date: input.logDate }, (old: typeof prevDate) => {
        if (!old) return old;
        const existing = old.find((l) => l.habitId === input.habitId);
        if (existing) return old.map((l) => l.habitId === input.habitId ? { ...l, ...input } : l);
        return [...old, newLogEntry];
      });

      // Optimistic update: logsForMonth (calendar coloring)
      utils.habits.logsForMonth.setData(monthKey, (old: typeof prevMonth) => {
        if (!old) return old;
        const existing = old.find((l) => l.habitId === input.habitId && l.logDate === input.logDate);
        if (existing) return old.map((l) => (l.habitId === input.habitId && l.logDate === input.logDate) ? { ...l, ...input } : l);
        return [...old, newLogEntry];
      });

      return { prevDate, prevMonth, monthKey };
    },
    onError: (_, input, ctx) => {
      if (ctx?.prevDate) utils.habits.logsForDate.setData({ date: input.logDate }, ctx.prevDate);
      if (ctx?.prevMonth && ctx?.monthKey) utils.habits.logsForMonth.setData(ctx.monthKey, ctx.prevMonth);
    },
    onSettled: () => {
      utils.habits.logsForDate.invalidate();
      utils.habits.logsForMonth.invalidate();
      utils.habits.monthScore.invalidate();
    },
  });
  const seedDemo = trpc.habits.seedDemo.useMutation({
    onSuccess: (data) => {
      if (data.seeded) { utils.habits.list.invalidate(); utils.habits.monthScore.invalidate(); utils.habits.logsForMonth.invalidate(); utils.habits.logsForDate.invalidate(); toast.success("โหลด Demo Data แล้ว"); }
      else toast.info("มี Habit อยู่แล้ว ไม่ต้อง seed ซ้ำ");
    },
  });

  const habits = (habitsQ.data ?? []) as Habit[];
  const monthScore = monthScoreQ.data;
  const logs = logsQ.data ?? [];
  const todayLogs = todayLogsQ.data ?? [];
  const overallScore = monthScore?.overall ?? 0;

  const getTodayLog = (habitId: number) => todayLogs.find((l) => l.habitId === habitId);
  const getHabitScore = (habitId: number) => monthScore?.habitScores.find((s: { habitId: number; score: number }) => s.habitId === habitId)?.score ?? 0;

  const handleCheckin = (habitId: number, data: { completed: boolean; loggedTime?: string; activityType?: string; durationMinutes?: number }) => {
    checkin.mutate({ habitId, logDate: today, ...data });
  };

  // Retroactive check-in for calendar view
  const handleCheckinDate = (habitId: number, data: { completed: boolean; loggedTime?: string }) => {
    if (!calSelectedDate) return;
    checkin.mutate({ habitId, logDate: calSelectedDate, ...data });
  };

  // Logs for the selected calendar date
  const calSelectedDateLogs = calSelectedDate === today
    ? todayLogs
    : (calDateLogsQ.data ?? []);

  const handleSaveHabit = (data: Partial<Habit> & { name: string; type: HabitType }) => {
    if (editingHabit) {
      // Strip null values — update procedure only accepts string | undefined, not null
      const updateData: Record<string, unknown> = { id: editingHabit.id };
      for (const [k, v] of Object.entries(data)) {
        if (v !== null) updateData[k] = v;
      }
      updateHabit.mutate(updateData as Parameters<typeof updateHabit.mutate>[0]);
      setEditingHabit(null);
    } else {
      createHabit.mutate(data as Parameters<typeof createHabit.mutate>[0]);
    }
  };

  const handleDeleteHabit = (habitId: number) => {
    deleteHabit.mutate({ id: habitId });
  };

  const prevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };
  const canGoNext = viewYear < currentYear || (viewYear === currentYear && viewMonth < currentMonth);

  if (authLoading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!user) return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center space-y-4">
        <p className="text-muted-foreground">กรุณาเข้าสู่ระบบก่อน</p>
        <Button asChild><a href={getLoginUrl()}>เข้าสู่ระบบ</a></Button>
      </div>
    </div>
  );

  const todayDone = todayLogs.filter((l) => l.completed).length;
  const todayTotal = habits.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-bold text-lg leading-tight">BOSS HABIT OS</h1>
              <p className="text-xs text-muted-foreground">สร้างนิสัยที่ดี ทีละวัน</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {habits.length === 0 && (
              <Button variant="outline" size="sm" onClick={() => seedDemo.mutate()} disabled={seedDemo.isPending}>
                {seedDemo.isPending ? "กำลังโหลด..." : "โหลด Demo"}
              </Button>
            )}
            <Button size="sm" onClick={() => setShowAddHabit(true)}>
              <Plus className="w-4 h-4 mr-1" /> เพิ่ม Habit
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Month navigation */}
        <div className="flex items-center justify-between">
          <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="font-semibold">{monthName(viewMonth, viewYear)}</h2>
          <button onClick={nextMonth} disabled={!canGoNext} className="p-2 rounded-xl hover:bg-muted transition-colors disabled:opacity-30">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Monthly score overview */}
        <div className="rounded-2xl border bg-card p-6">
          <div className="flex items-center gap-6">
            <ScoreRing score={overallScore} size={110} />
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">คะแนนรวมเดือนนี้</p>
                <p className="text-3xl font-bold">{overallScore}<span className="text-lg text-muted-foreground">/100</span></p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge variant={overallScore >= 80 ? "default" : "secondary"} className="text-xs">
                  {overallScore >= 80 ? "🏆 ยอดเยี่ยม" : overallScore >= 60 ? "👍 ดี" : overallScore >= 40 ? "💪 พยายามต่อ" : "🌱 เริ่มต้นใหม่"}
                </Badge>
                {viewYear === currentYear && viewMonth === currentMonth && (
                  <Badge variant="outline" className="text-xs">
                    วันนี้: {todayDone}/{todayTotal} habit
                  </Badge>
                )}
              </div>
              {/* Mini habit scores */}
              <div className="space-y-1">
                {habits.slice(0, 3).map((h) => (
                  <div key={h.id} className="flex items-center gap-2">
                    <HabitIcon icon={h.icon} className="w-3.5 h-3.5 flex-shrink-0" style={{ color: h.color ?? "#6366f1" } as React.CSSProperties} />
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${getHabitScore(h.id)}%`, background: h.color ?? "#6366f1" }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-7 text-right">{getHabitScore(h.id)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="w-full">
            <TabsTrigger value="today" className="flex-1"><Check className="w-4 h-4 mr-1.5" />วันนี้</TabsTrigger>
            <TabsTrigger value="calendar" className="flex-1"><Calendar className="w-4 h-4 mr-1.5" />ปฏิทิน</TabsTrigger>
            <TabsTrigger value="analytics" className="flex-1"><BarChart2 className="w-4 h-4 mr-1.5" />วิเคราะห์</TabsTrigger>
          </TabsList>

          {/* Today Tab */}
          <TabsContent value="today" className="mt-4 space-y-4">
            {habits.length === 0 ? (
              <div className="text-center py-16 space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
                  <Target className="w-8 h-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold">ยังไม่มี Habit</p>
                  <p className="text-sm text-muted-foreground mt-1">เพิ่ม Habit แรกของคุณ หรือลอง Demo Data</p>
                </div>
                <div className="flex gap-2 justify-center">
                  <Button onClick={() => setShowAddHabit(true)}><Plus className="w-4 h-4 mr-1" /> เพิ่ม Habit</Button>
                  <Button variant="outline" onClick={() => seedDemo.mutate()} disabled={seedDemo.isPending}>โหลด Demo</Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {habits.map((h) => (
                  <HabitCard
                    key={h.id}
                    habit={h}
                    score={getHabitScore(h.id)}
                    todayLog={getTodayLog(h.id)}
                    onCheckin={handleCheckin}
                    onEdit={(h) => { setEditingHabit(h); setShowAddHabit(true); }}
                    onDelete={handleDeleteHabit}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Calendar Tab */}
          <TabsContent value="calendar" className="mt-4">
            {habits.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">เพิ่ม Habit ก่อนเพื่อดูปฏิทิน</div>
            ) : (
              <HabitCalendarView
                habits={habits}
                logs={logs}
                year={viewYear}
                month={viewMonth}
                selectedDate={calSelectedDate}
                onSelectDate={setCalSelectedDate}
                selectedDateLogs={calSelectedDateLogs}
                onCheckinDate={handleCheckinDate}
                isCheckinPending={checkin.isPending}
              />
            )}
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="mt-4">
            {habits.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">เพิ่ม Habit ก่อนเพื่อดูการวิเคราะห์</div>
            ) : (
              <HabitAnalyticsView habits={habits} logs={logs} year={viewYear} month={viewMonth} />
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Habit Form Dialog */}
      <HabitFormDialog
        open={showAddHabit}
        onOpenChange={(v) => { setShowAddHabit(v); if (!v) setEditingHabit(null); }}
        habit={editingHabit}
        onSave={handleSaveHabit}
      />
    </div>
  );
}
