/**
 * queryHelpers.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralized query invalidation helper for task-related mutations.
 *
 * Phase 8 requirement: instead of each page calling invalidate() on only the
 * queries it knows about, every mutation should call invalidateTaskDomain()
 * so ALL views (Calendar, Dashboard, Tasks, ProjectDetail, Areas, etc.) stay
 * consistent after any task change.
 *
 * Usage:
 *   import { invalidateTaskDomain } from "@/lib/queryHelpers";
 *   const utils = trpc.useUtils();
 *   createTask.mutate({ ... }, {
 *     onSuccess: () => invalidateTaskDomain(utils),
 *   });
 */

// We use the tRPC utils type via inference — import the actual utils type
// from the generated router shape so this stays fully type-safe.
type TrpcUtils = ReturnType<typeof import("@/lib/trpc").trpc.useUtils>;

/**
 * Invalidate every query that depends on the tasks domain.
 * Call this in onSuccess of any task create / update / delete / toggleDone mutation.
 */
export async function invalidateTaskDomain(utils: TrpcUtils): Promise<void> {
  await Promise.all([
    // Core task queries
    utils.tasks.list.invalidate(),
    utils.tasks.inRange.invalidate(),

    // Dashboard widgets
    utils.dashboard.stats.invalidate(),
    utils.dashboard.todayTasks.invalidate(),
    utils.dashboard.overdueTasks.invalidate(),

    // Project & area progress (task count / progress % changes)
    utils.projects.list.invalidate(),
    utils.projects.byId.invalidate(),
    utils.areas.list.invalidate(),
  ]);
}
