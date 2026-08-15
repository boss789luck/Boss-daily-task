import { useAuth } from "@/_core/hooks/useAuth";
import React from "react";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  BookOpen,
  Calendar,
  ChevronRight,
  Clock,
  Download,
  Flame,
  FolderOpen,
  Grid3X3,
  Home,
  Layers,
  LogOut,
  Menu,
  Moon,
  Sun,
  Target,
  Zap,
  Settings,
  Sparkles,
  CreditCard,
} from "lucide-react";
import { useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { Link, useLocation } from "wouter";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

const navItems = [
  { href: "/", icon: Home, label: "Dashboard", section: "workspace" },
  { href: "/areas", icon: Layers, label: "Areas", section: "workspace" },
  { href: "/projects", icon: FolderOpen, label: "Projects", section: "workspace" },
  { href: "/tasks", icon: Target, label: "Tasks", section: "workspace" },
  { href: "/calendar", icon: Calendar, label: "Calendar", section: "views" },
  { href: "/external-calendar", icon: Calendar, label: "Google Calendar", section: "views" },
  { href: "/timeline", icon: BarChart3, label: "Timeline", section: "views" },
  { href: "/eisenhower", icon: Grid3X3, label: "Priority Matrix", section: "views" },
  { href: "/notes", icon: BookOpen, label: "Notes", section: "knowledge" },
  { href: "/habits", icon: Flame, label: "Habits", section: "review" },
  { href: "/life-goals", icon: Sparkles, label: "Life Goals", section: "review" },
  { href: "/books", icon: BookOpen, label: "Book Summaries", section: "knowledge" },
  { href: "/weekly-review", icon: Target, label: "Weekly Review", section: "review" },
  { href: "/tracker", icon: Clock, label: "Time Tracker", section: "tools" },
  { href: "/cards", icon: CreditCard, label: "Cards Vault", section: "tools" },
  { href: "/entities", icon: Layers, label: "Ads Entities", section: "tools" },
  { href: "/graph", icon: Grid3X3, label: "Link Graph", section: "tools" },
  { href: "/import", icon: Download, label: "Import", section: "tools" },
  { href: "/settings/calendar", icon: Settings, label: "Google Calendar", section: "tools" },
];

const sections = [
  { key: "workspace", label: "Workspace" },
  { key: "views", label: "Views" },
  { key: "knowledge", label: "Knowledge" },
  { key: "review", label: "Review" },
  { key: "tools", label: "Tools" },
];

// Accent colors per section for nav icons
const sectionAccent: Record<string, string> = {
  workspace: "oklch(0.52 0.26 270)",
  views:     "oklch(0.60 0.22 200)",
  knowledge: "oklch(0.62 0.22 25)",
  review:    "oklch(0.58 0.20 145)",
  tools:     "oklch(0.72 0.18 70)",
};

interface BossLayoutProps {
  children: React.ReactNode;
}

function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 text-muted-foreground hover:text-foreground hover:bg-accent/60 rounded-lg"
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {theme === "dark" ? "Light Mode" : "Dark Mode"}
      </TooltipContent>
    </Tooltip>
  );
}

export default function BossLayout({ children }: BossLayoutProps) {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const { data: stats } = trpc.dashboard.stats.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 60000,
  });

  const { data: calSettings } = trpc.googleCalendar.getSettings.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Zap className="w-6 h-6 text-primary animate-pulse" />
          </div>
          <p className="text-muted-foreground text-sm font-medium">Loading BOSS OS…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background bg-dots flex items-center justify-center px-4">
        <div className="text-center space-y-8 max-w-sm w-full">
          {/* Logo mark */}
          <div className="flex flex-col items-center gap-5">
            <div className="relative">
              <div className="w-20 h-20 rounded-3xl bg-primary flex items-center justify-center shadow-xl shadow-primary/30">
                <Zap className="w-10 h-10 text-white" />
              </div>
              <div className="absolute -inset-1 rounded-3xl bg-primary/20 blur-lg -z-10" />
            </div>
            <div>
              <h1 className="text-5xl font-bold text-gradient tracking-tight">BOSS OS</h1>
              <p className="text-muted-foreground mt-2 text-xs font-semibold tracking-[0.2em] uppercase">
                Plan · Execute · Review
              </p>
            </div>
          </div>

          <div className="boss-card p-8 space-y-5">
            <p className="text-foreground/70 text-sm leading-relaxed text-center">
              Your all-in-one operating system for managing projects, tasks, and priorities with clarity.
            </p>
            <Button
              size="lg"
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl shadow-lg shadow-primary/25 transition-all"
              onClick={() => (window.location.href = getLoginUrl())}
            >
              Sign in to BOSS OS
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          <p className="text-muted-foreground/40 text-xs">Powered by Manus · Secure & Private</p>
        </div>
      </div>
    );
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn(
        "flex items-center border-b border-sidebar-border flex-shrink-0",
        sidebarOpen ? "px-5 py-4 gap-3" : "px-0 py-4 justify-center"
      )}>
        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow-md shadow-primary/30">
          <Zap className="w-4 h-4 text-white" />
        </div>
        {sidebarOpen && (
          <div className="min-w-0">
            <div className="font-bold text-sm text-sidebar-foreground tracking-tight">BOSS OS</div>
            <div className="text-[10px] text-muted-foreground/50 tracking-[0.15em] uppercase font-medium">Plan · Execute · Review</div>
          </div>
        )}
      </div>

      {/* Quick stats */}
      {sidebarOpen && stats && (
        <div className="px-4 py-3 border-b border-sidebar-border">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl px-3 py-2.5" style={{ background: "oklch(0.52 0.26 270 / 0.07)" }}>
              <div className="text-xl font-bold" style={{ color: "oklch(0.42 0.22 270)" }}>{stats.activeProjects}</div>
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mt-0.5">Active</div>
            </div>
            <div className={cn("rounded-xl px-3 py-2.5", stats.overdueTasks > 0 ? "" : "")}
              style={{ background: stats.overdueTasks > 0 ? "oklch(0.62 0.22 25 / 0.08)" : "oklch(0.58 0.20 145 / 0.07)" }}>
              <div className="text-xl font-bold" style={{ color: stats.overdueTasks > 0 ? "oklch(0.48 0.20 25)" : "oklch(0.40 0.18 145)" }}>
                {stats.overdueTasks}
              </div>
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mt-0.5">Overdue</div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-5">
        {sections.map((section) => {
          const items = navItems.filter((i) => i.section === section.key);
          if (items.length === 0) return null;
          const accent = sectionAccent[section.key] || "oklch(0.52 0.26 270)";
          return (
            <div key={section.key}>
              {sidebarOpen && (
                <div className="px-1 mb-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em]">
                    {section.label}
                  </span>
                </div>
              )}
              <div className="space-y-0.5">
                {items.map((item) => {
                  const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                  return sidebarOpen ? (
                    <Link key={item.href} href={item.href}>
                      <div
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer group",
                          isActive
                            ? "text-white shadow-sm"
                            : "text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                        )}
                        style={isActive ? { background: accent, boxShadow: `0 2px 8px ${accent}40` } : {}}
                      >
                        <item.icon className={cn("w-4 h-4 flex-shrink-0 transition-colors", isActive ? "text-white" : "text-muted-foreground/60 group-hover:text-sidebar-foreground")} />
                        <span className="truncate flex-1">{item.label}</span>
                        {item.href === "/settings/calendar" && (
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{
                              background: calSettings?.connected
                                ? "oklch(0.58 0.20 145)"
                                : "oklch(0.62 0.22 25)",
                              boxShadow: calSettings?.connected
                                ? "0 0 6px oklch(0.58 0.20 145 / 0.7)"
                                : "0 0 6px oklch(0.62 0.22 25 / 0.5)",
                            }}
                          />
                        )}
                      </div>
                    </Link>
                  ) : (
                    <Tooltip key={item.href}>
                      <TooltipTrigger asChild>
                        <Link href={item.href}>
                          <div
                            className={cn(
                              "flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-150 cursor-pointer mx-auto",
                              isActive ? "text-white shadow-sm" : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                            )}
                            style={isActive ? { background: accent, boxShadow: `0 2px 8px ${accent}40` } : {}}
                          >
                            <item.icon className="w-4 h-4" />
                          </div>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User profile */}
      <div className="px-3 py-3 border-t border-sidebar-border flex-shrink-0">
        <div className={cn("flex items-center gap-2.5", !sidebarOpen && "justify-center")}>
          <Avatar className="w-8 h-8 flex-shrink-0">
            <AvatarFallback className="text-xs font-bold text-white" style={{ background: "oklch(0.52 0.26 270)" }}>
              {user?.name?.charAt(0)?.toUpperCase() || "B"}
            </AvatarFallback>
          </Avatar>
          {sidebarOpen && (
            <>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-sidebar-foreground truncate">{user?.name || "User"}</div>
                <div className="text-xs text-muted-foreground truncate">{user?.email || ""}</div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/8 flex-shrink-0 rounded-lg"
                onClick={logout}
              >
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 flex-shrink-0",
          sidebarOpen ? "w-56" : "w-14"
        )}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex"
          onClick={() => setMobileSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <aside
            className="relative w-60 bg-sidebar border-r border-sidebar-border flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="h-13 border-b border-border flex items-center px-5 gap-3 bg-background/95 backdrop-blur-md flex-shrink-0 sticky top-0 z-30">
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 text-muted-foreground hover:text-foreground hover:bg-accent/60 rounded-lg lg:flex hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 text-muted-foreground hover:text-foreground hover:bg-accent/60 rounded-lg lg:hidden"
            onClick={() => setMobileSidebarOpen(true)}
          >
            <Menu className="w-4 h-4" />
          </Button>

          {/* Brand */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="font-bold text-sm text-foreground tracking-tight">BOSS OS</span>
          </div>

          {/* Date */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <Clock className="w-3.5 h-3.5" />
            <span>{new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
          </div>

          {/* Theme Toggle */}
          <ThemeToggleButton />
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
