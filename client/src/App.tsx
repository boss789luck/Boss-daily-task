import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import BossLayout from "./components/BossLayout";
import Dashboard from "./pages/Dashboard";
import AreasPage from "./pages/Areas";
import AreaDetailPage from "./pages/AreaDetail";
import ProjectsPage from "./pages/Projects";
import ProjectDetailPage from "./pages/ProjectDetail";
import TasksPage from "./pages/Tasks";
import CalendarPage from "./pages/Calendar";
import TimelinePage from "./pages/Timeline";
import NotesPage from "./pages/Notes";
import WeeklyReviewPage from "./pages/WeeklyReview";
import ImportPage from "./pages/Import";
import EisenhowerPage from "./pages/Eisenhower";
import CalendarSettingsPage from "@/pages/CalendarSettings";
import HabitOSPage from "@/pages/HabitOS";
import LifeGoalsPage from "@/pages/LifeGoals";
import BookSummariesPage from "@/pages/BookSummaries";
import { TaskSyncBridge } from "./components/TaskSyncBridge";

function Router() {
  return (
    <>
    <TaskSyncBridge />
    <BossLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/areas" component={AreasPage} />
        <Route path="/areas/:id" component={AreaDetailPage} />
        <Route path="/projects" component={ProjectsPage} />
        <Route path="/projects/:id" component={ProjectDetailPage} />
        <Route path="/tasks" component={TasksPage} />
        <Route path="/calendar" component={CalendarPage} />
        <Route path="/timeline" component={TimelinePage} />
        <Route path="/notes" component={NotesPage} />
        <Route path="/weekly-review" component={WeeklyReviewPage} />
        <Route path="/eisenhower" component={EisenhowerPage} />
        <Route path="/import" component={ImportPage} />
        <Route path="/settings/calendar" component={CalendarSettingsPage} />
        <Route path="/habits" component={HabitOSPage} />
        <Route path="/life-goals" component={LifeGoalsPage} />
        <Route path="/books" component={BookSummariesPage} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
      </BossLayout>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster position="bottom-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
