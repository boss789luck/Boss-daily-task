/**
 * TaskSyncBridge
 * ─────────────────────────────────────────────────────────────────────────────
 * A global background component that listens to the React Query mutation cache.
 * Whenever any task-related mutation succeeds, it calls invalidateTaskDomain()
 * so every page (Calendar, Tasks, Dashboard, ProjectDetail, Areas, etc.) shows
 * fresh data immediately — without each page needing its own invalidation logic.
 *
 * Mount this once inside App.tsx (inside the tRPC + QueryClient providers).
 * Phase 8: now uses the centralized invalidateTaskDomain helper.
 */

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { invalidateTaskDomain } from "@/lib/queryHelpers";

// Mutation keys that should trigger a full task-domain refresh
const TASK_MUTATION_KEYS = [
  "tasks.create",
  "tasks.update",
  "tasks.delete",
  "tasks.toggleDone",
  "tasks.bulkAssignToday",
  "tasks.reschedule",
];

const PROJECT_MUTATION_KEYS = [
  "projects.create",
  "projects.update",
  "projects.delete",
];

export function TaskSyncBridge() {
  const queryClient = useQueryClient();
  const utils = trpc.useUtils();

  useEffect(() => {
    const unsubscribe = queryClient.getMutationCache().subscribe((event) => {
      if (event.type !== "updated") return;
      if (event.action.type !== "success") return;

      const mutationKey = event.mutation.options.mutationKey as string[] | undefined;
      if (!mutationKey) return;

      const keyStr = mutationKey.join(".");

      const isTaskMutation = TASK_MUTATION_KEYS.some((k) => keyStr.includes(k));
      const isProjectMutation = PROJECT_MUTATION_KEYS.some((k) => keyStr.includes(k));

      if (isTaskMutation) {
        // Phase 8: use centralized helper — invalidates tasks.list, tasks.inRange,
        // dashboard.stats, dashboard.todayTasks, dashboard.overdueTasks,
        // projects.list, projects.byId, areas.list
        invalidateTaskDomain(utils);
      }

      if (isProjectMutation) {
        utils.projects.list.invalidate();
        utils.projects.byId.invalidate();
        utils.dashboard.stats.invalidate();
      }
    });

    return () => unsubscribe();
  }, [queryClient, utils]);

  return null;
}
