import React, { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Play, Pause, Briefcase, Activity, TrendingUp, Cpu, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from "recharts";

const iconMap: Record<string, React.ReactNode> = {
  "briefcase": <Briefcase className="w-6 h-6" />,
  "activity": <Activity className="w-6 h-6" />,
  "trending-up": <TrendingUp className="w-6 h-6" />,
  "cpu": <Cpu className="w-6 h-6" />,
  "clock": <Clock className="w-6 h-6" />,
};

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function TrackerPage() {
  const utils = trpc.useUtils();
  const { data: categories = [], isLoading: loadingCats } = trpc.timeTracker.getCategories.useQuery();
  const { data: todayLogs = [], isLoading: loadingLogs } = trpc.timeTracker.getTodayLogs.useQuery();
  const { data: stats, isLoading: loadingStats } = trpc.timeTracker.getAllTimeStats.useQuery();
  
  const logTimeMutation = trpc.timeTracker.logTime.useMutation({
    onSuccess: () => {
      utils.timeTracker.getTodayLogs.invalidate();
      utils.timeTracker.getAllTimeStats.invalidate();
    },
    onError: (err) => {
      toast.error(`Error saving time: ${err.message}`);
    }
  });

  const [activeTimerId, setActiveTimerId] = useState<number | null>(null);
  const [sessionSeconds, setSessionSeconds] = useState(0);

  // Handle timer ticks
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (activeTimerId !== null) {
      interval = setInterval(() => {
        setSessionSeconds(s => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeTimerId]);

  // Sync session to DB occasionally (every 30 seconds) to prevent data loss, or on stop.
  useEffect(() => {
    if (activeTimerId !== null && sessionSeconds > 0 && sessionSeconds % 30 === 0) {
      logTimeMutation.mutate({ categoryId: activeTimerId, durationSeconds: 30 });
      // Reset session seconds because we've persisted them
      setSessionSeconds(0);
    }
  }, [sessionSeconds, activeTimerId, logTimeMutation]);

  const toggleTimer = (categoryId: number) => {
    if (activeTimerId === categoryId) {
      // Pause
      if (sessionSeconds > 0) {
        logTimeMutation.mutate({ categoryId, durationSeconds: sessionSeconds });
      }
      setActiveTimerId(null);
      setSessionSeconds(0);
    } else {
      // Switch or Start
      if (activeTimerId !== null && sessionSeconds > 0) {
        logTimeMutation.mutate({ categoryId: activeTimerId, durationSeconds: sessionSeconds });
      }
      setActiveTimerId(categoryId);
      setSessionSeconds(0);
    }
  };

  const getTrackedSeconds = (categoryId: number) => {
    const log = todayLogs.find(l => l.categoryId === categoryId);
    let base = log ? log.durationSeconds : 0;
    if (activeTimerId === categoryId) {
      base += sessionSeconds;
    }
    return base;
  };

  const todayChartData = useMemo(() => {
    return categories.map(cat => ({
      name: cat.name,
      Tracked: parseFloat((getTrackedSeconds(cat.id) / 3600).toFixed(2)),
      Goal: parseFloat((cat.goalMinutesPerDay / 60).toFixed(2)),
      color: cat.color
    }));
  }, [categories, todayLogs, activeTimerId, sessionSeconds]);

  const allTimeChartData = useMemo(() => {
    if (!stats || !stats.allTime) return [];
    return stats.allTime.map(stat => {
      const cat = categories.find(c => c.id === stat.categoryId);
      return {
        name: cat ? cat.name : "Unknown",
        value: parseFloat((stat.totalSeconds / 3600).toFixed(2)),
        color: cat ? cat.color : "#94a3b8"
      };
    });
  }, [stats, categories]);

  if (loadingCats || loadingLogs || loadingStats) {
    return <div className="p-8 text-center text-muted-foreground">Loading Tracker...</div>;
  }

  return (
    <div className="p-8 pb-32">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Clock className="w-8 h-8 text-indigo-500" />
            Time Tracker
          </h1>
          <p className="text-muted-foreground mt-1">
            Focus on your goals and track your invested time.
          </p>
        </div>
      </div>

      {/* Timer Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {categories.map(cat => {
          const tracked = getTrackedSeconds(cat.id);
          const goal = cat.goalMinutesPerDay * 60;
          const progress = Math.min((tracked / goal) * 100, 100);
          const isActive = activeTimerId === cat.id;

          return (
            <div key={cat.id} className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${isActive ? 'shadow-lg shadow-indigo-500/20 border-indigo-500/50 scale-[1.02]' : 'bg-card border-border hover:border-border/80'}`}>
              <div className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 rounded-xl" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>
                    {iconMap[cat.icon] || <Clock className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{cat.name}</h3>
                    <p className="text-xs text-muted-foreground">Goal: {cat.goalMinutesPerDay / 60} hrs</p>
                  </div>
                </div>

                <div className="flex flex-col items-center mb-6">
                  <div className={`font-mono text-4xl tracking-wider mb-2 transition-colors ${isActive ? 'text-indigo-500' : 'text-foreground'}`}>
                    {formatDuration(tracked)}
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-full transition-all duration-1000 ease-linear"
                      style={{ 
                        width: `${progress}%`,
                        backgroundColor: progress >= 100 ? '#10b981' : cat.color 
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 self-start">
                    {progress >= 100 ? '🎉 Goal Reached!' : `${Math.round(progress)}% of daily goal`}
                  </p>
                </div>

                <Button 
                  onClick={() => toggleTimer(cat.id)}
                  className={`w-full gap-2 rounded-xl h-12 text-md transition-all ${isActive ? 'bg-red-500 hover:bg-red-600 text-white' : ''}`}
                  style={!isActive ? { backgroundColor: cat.color, color: '#fff' } : undefined}
                >
                  {isActive ? <><Pause className="w-5 h-5" /> Pause Timer</> : <><Play className="w-5 h-5" /> Start Focus</>}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Today vs Goal Chart */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="font-semibold text-lg mb-6">Today's Progress (Hours)</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={todayChartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#334155" opacity={0.3} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{fill: 'transparent'}}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend />
                <Bar dataKey="Goal" fill="#94a3b8" opacity={0.3} radius={[0, 4, 4, 0]} />
                <Bar dataKey="Tracked" radius={[0, 4, 4, 0]}>
                  {todayChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* All-Time Distribution Chart */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="font-semibold text-lg mb-6">All-Time Distribution (Hours)</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={allTimeChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={5}
                  dataKey="value"
                  label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {allTimeChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
