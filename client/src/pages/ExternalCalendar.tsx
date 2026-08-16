import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Calendar as CalIcon, ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Check, CalendarIcon as CalIconList } from "lucide-react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday,
} from "date-fns";

export default function ExternalCalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("boss_os_external_calendars");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // ─── Day events popover (for +N more) ─────────────────────────────────────────
  const [dayPopoverDate, setDayPopoverDate] = useState<Date | null>(null);

  const rangeStart = useMemo(() => startOfWeek(startOfMonth(currentDate)), [currentDate]);
  const rangeEnd = useMemo(() => endOfWeek(endOfMonth(currentDate)), [currentDate]);

  // Fetch available calendars
  const { data: calendars = [], isLoading: loadingCalendars } = trpc.googleCalendar.listCalendars.useQuery();

  // Set primary as default when calendars load if nothing is selected
  useMemo(() => {
    if (selectedCalendarIds.length === 0 && calendars.length > 0) {
      // Check if we have anything in local storage first to prevent overwriting an intentionally empty state
      // (Though usually we want at least one selected). If it's completely empty and no local storage, use primary.
      const saved = localStorage.getItem("boss_os_external_calendars");
      if (!saved || saved === "[]") {
        const primary = calendars.find((c: any) => c.primary) || calendars[0];
        setSelectedCalendarIds([primary.id]);
        localStorage.setItem("boss_os_external_calendars", JSON.stringify([primary.id]));
      }
    }
  }, [calendars, selectedCalendarIds.length]);

  // Fetch events for the selected calendar
  const { data: events = [], isLoading: loadingEvents } = trpc.googleCalendar.getEvents.useQuery(
    {
      calendarIds: selectedCalendarIds,
      timeMin: rangeStart.toISOString(),
      timeMax: rangeEnd.toISOString(),
    },
    {
      enabled: selectedCalendarIds.length > 0,
      staleTime: 60 * 1000,
    }
  );

  const toggleCalendar = (id: string) => {
    setSelectedCalendarIds(prev => {
      const next = prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id];
      localStorage.setItem("boss_os_external_calendars", JSON.stringify(next));
      return next;
    });
  };

  const navigate = (dir: 1 | -1) => {
    setCurrentDate(dir === 1 ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
  };

  const getEventsForDay = (day: Date) =>
    events?.filter((e: any) => e.start && isSameDay(new Date(e.start), day)) ?? [];

  // Month view days
  const monthDays = useMemo(() => {
    const days: Date[] = [];
    let d = rangeStart;
    while (d <= rangeEnd) { days.push(d); d = addDays(d, 1); }
    return days;
  }, [rangeStart, rangeEnd]);

  // ─── Event chip ────────────────────────────────────────────────────────────────
  const EventChip = ({ event, compact = false }: { event: any; compact?: boolean }) => {
    const chipContent = (
      <div
        className={cn(
          "group flex items-center gap-1.5 rounded-lg border text-xs cursor-pointer transition-all duration-100",
          "hover:shadow-sm hover:scale-[1.01]",
          compact ? "px-1.5 py-0.5" : "px-2 py-1.5",
          "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800",
        )}
        title={event.title}
      >
        <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0 bg-blue-500")} />
        <span className="truncate font-medium text-foreground/80">{event.title}</span>
        {!compact && !event.isAllDay && event.start && (
          <span className="ml-auto text-muted-foreground/60 flex-shrink-0">{format(new Date(event.start), "h:mm a")}</span>
        )}
      </div>
    );
    
    if (event.htmlLink) {
      return (
        <a href={event.htmlLink} target="_blank" rel="noopener noreferrer" className="block">
          {chipContent}
        </a>
      );
    }
    
    return chipContent;
  };

  // ─── Month View ─────────────────────────────────────────────────────────────
  const renderMonth = () => {
    const weekDaysHeader = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-background/50 rounded-xl border shadow-sm overflow-hidden">
        {/* Header Days */}
        <div className="grid grid-cols-7 border-b bg-muted/20">
          {weekDaysHeader.map(d => (
            <div key={d} className="py-3 text-center text-xs font-medium text-muted-foreground tracking-wider uppercase">
              {d}
            </div>
          ))}
        </div>
        {/* Grid */}
        <div className="grid grid-cols-7 flex-1 auto-rows-fr">
          {monthDays.map((day, i) => {
            const isCurrMonth = isSameMonth(day, currentDate);
            const isTdy = isToday(day);
            const iso = format(day, "yyyy-MM-dd");
            const dayEvents = getEventsForDay(day);
            const showMoreBtn = dayEvents.length > 4;
            const visibleEvents = showMoreBtn ? dayEvents.slice(0, 3) : dayEvents;

            return (
              <div
                key={iso}
                className={cn(
                  "min-h-[120px] p-2 border-b border-r transition-colors flex flex-col gap-1.5 relative group/cell",
                  !isCurrMonth && "bg-muted/10 opacity-70",
                  (i + 1) % 7 === 0 && "border-r-0"
                )}
              >
                {/* Day Header */}
                <div className="flex justify-between items-center mb-1">
                  <div className={cn(
                    "flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium",
                    isTdy
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : isCurrMonth
                        ? "text-foreground"
                        : "text-muted-foreground/50"
                  )}>
                    {format(day, "d")}
                  </div>
                </div>

                {/* Events list */}
                <div className="flex-1 flex flex-col gap-1 overflow-hidden relative">
                  {visibleEvents.map((evt: any) => (
                    <EventChip key={evt.id} event={evt} compact />
                  ))}

                  {showMoreBtn && (
                    <Popover open={dayPopoverDate?.getTime() === day.getTime()} onOpenChange={(open) => setDayPopoverDate(open ? day : null)}>
                      <PopoverTrigger asChild>
                        <button className="text-xs font-semibold text-primary hover:text-primary/80 self-start mt-0.5 px-1 rounded hover:bg-primary/10 transition-colors">
                          +{dayEvents.length - 3} more
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-0 rounded-xl shadow-xl border-border/50" align="start" side="right" sideOffset={10}>
                        <div className="px-4 py-3 border-b bg-muted/30">
                          <h4 className="font-semibold">{format(day, "EEEE, MMMM d")}</h4>
                          <p className="text-xs text-muted-foreground">{dayEvents.length} events</p>
                        </div>
                        <div className="p-3 max-h-[300px] overflow-y-auto flex flex-col gap-2">
                          {dayEvents.map((evt: any) => (
                            <EventChip key={evt.id} event={evt} />
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 gap-6 max-w-[1600px] mx-auto w-full">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <CalIcon className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Google Calendar</h1>
          </div>
          <p className="text-sm text-muted-foreground">View your connected Google Calendar events (Read-only)</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {loadingCalendars ? (
            <div className="text-sm text-muted-foreground">Loading calendars...</div>
          ) : calendars.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-[240px] justify-between font-normal">
                  <span className="truncate">
                    {selectedCalendarIds.length === 0 ? "Select calendars..." 
                      : selectedCalendarIds.length === 1 
                        ? calendars.find((c: any) => c.id === selectedCalendarIds[0])?.summary || "1 calendar selected"
                        : `${selectedCalendarIds.length} calendars selected`}
                  </span>
                  <CalIconList className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[280px]" align="end">
                <DropdownMenuLabel>Select Calendars</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="max-h-[300px] overflow-y-auto">
                  {calendars.map((c: any) => (
                    <DropdownMenuCheckboxItem
                      key={c.id}
                      checked={selectedCalendarIds.includes(c.id)}
                      onCheckedChange={() => toggleCalendar(c.id)}
                      onSelect={(e) => e.preventDefault()}
                      className="cursor-pointer"
                    >
                      <div className="flex flex-col gap-0.5 max-w-[220px]">
                        <span className="truncate font-medium">{c.summary}</span>
                        {c.primary && <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Primary</span>}
                      </div>
                    </DropdownMenuCheckboxItem>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="text-sm text-muted-foreground">No calendars found (Check Settings)</div>
          )}

          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border">
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => navigate(-1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-3 text-xs font-medium rounded-md" onClick={() => setCurrentDate(new Date())}>
              Today
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => navigate(1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Date Header */}
      <h2 className="text-xl font-bold flex-shrink-0">
        {format(currentDate, "MMMM yyyy")}
      </h2>

      {renderMonth()}
    </div>
  );
}
