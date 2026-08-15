import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { toast } from "sonner";

interface TimeTrackerContextType {
  activeTimerId: number | null;
  sessionSeconds: number;
  toggleTimer: (categoryId: number) => void;
}

const TimeTrackerContext = createContext<TimeTrackerContextType | undefined>(undefined);

export function TimeTrackerProvider({ children }: { children: ReactNode }) {
  const [activeTimerId, setActiveTimerId] = useState<number | null>(null);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const sessionStartRef = useRef<number | null>(null);
  
  const utils = trpc.useUtils();
  const logTimeMutation = trpc.timeTracker.logTime.useMutation({
    onSuccess: () => {
      utils.timeTracker.getTodayLogs.invalidate();
      utils.timeTracker.getAllTimeStats.invalidate();
    },
    onError: (err) => {
      toast.error(`Error saving time: ${err.message}`);
    }
  });

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (activeTimerId !== null) {
      if (!sessionStartRef.current) {
        sessionStartRef.current = Date.now();
      }
      interval = setInterval(() => {
        if (sessionStartRef.current) {
          const elapsed = Math.floor((Date.now() - sessionStartRef.current) / 1000);
          setSessionSeconds(elapsed);
        }
      }, 1000);
    } else {
      setSessionSeconds(0);
      sessionStartRef.current = null;
    }
    return () => clearInterval(interval);
  }, [activeTimerId]);

  useEffect(() => {
    if (activeTimerId !== null && sessionSeconds >= 30) {
      const localDate = format(new Date(), "yyyy-MM-dd");
      const elapsed = sessionStartRef.current ? Math.floor((Date.now() - sessionStartRef.current) / 1000) : sessionSeconds;
      
      logTimeMutation.mutate({ categoryId: activeTimerId, durationSeconds: elapsed, date: localDate });
      
      sessionStartRef.current = Date.now();
      setSessionSeconds(0);
    }
  }, [sessionSeconds, activeTimerId]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (activeTimerId !== null && sessionStartRef.current) {
        const elapsed = Math.floor((Date.now() - sessionStartRef.current) / 1000);
        if (elapsed > 0) {
          const localDate = format(new Date(), "yyyy-MM-dd");
          logTimeMutation.mutate({ categoryId: activeTimerId, durationSeconds: elapsed, date: localDate });
        }
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [activeTimerId]);

  const toggleTimer = (categoryId: number) => {
    const localDate = format(new Date(), "yyyy-MM-dd");
    if (activeTimerId === categoryId) {
      // Pause
      if (sessionStartRef.current) {
        const elapsed = Math.floor((Date.now() - sessionStartRef.current) / 1000);
        if (elapsed > 0) {
          logTimeMutation.mutate({ categoryId, durationSeconds: elapsed, date: localDate });
        }
      }
      setActiveTimerId(null);
    } else {
      // Switch or Start
      if (activeTimerId !== null && sessionStartRef.current) {
        const elapsed = Math.floor((Date.now() - sessionStartRef.current) / 1000);
        if (elapsed > 0) {
          logTimeMutation.mutate({ categoryId: activeTimerId, durationSeconds: elapsed, date: localDate });
        }
      }
      setActiveTimerId(categoryId);
      sessionStartRef.current = Date.now();
      setSessionSeconds(0);
    }
  };

  return (
    <TimeTrackerContext.Provider value={{ activeTimerId, sessionSeconds, toggleTimer }}>
      {children}
    </TimeTrackerContext.Provider>
  );
}

export function useTimeTracker() {
  const context = useContext(TimeTrackerContext);
  if (context === undefined) {
    throw new Error("useTimeTracker must be used within a TimeTrackerProvider");
  }
  return context;
}
