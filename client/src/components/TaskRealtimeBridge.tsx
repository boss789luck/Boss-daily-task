/**
 * TaskRealtimeBridge
 * ─────────────────────────────────────────────────────────────────────────────
 * A global background component that subscribes to the `tasks.onChanged` SSE
 * stream. Whenever the server emits a task change event (create / update /
 * delete / status_changed / due_date_changed / calendar_synced), it calls
 * invalidateTaskDomain() so every page shows fresh data immediately.
 *
 * This component complements TaskSyncBridge (which handles local mutations).
 * TaskRealtimeBridge handles *external* changes — e.g. a Google Calendar
 * webhook that updated a task's due date on the server side.
 *
 * Mount this once inside App.tsx (inside the tRPC + QueryClient providers).
 * It is a no-op when the user is not logged in.
 */
import { trpc } from "@/lib/trpc";
import { invalidateTaskDomain } from "@/lib/queryHelpers";
import { useAuth } from "@/_core/hooks/useAuth";

export function TaskRealtimeBridge() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  // Only subscribe when user is authenticated
  const enabled = !!user;

  // Use the tRPC SSE subscription hook
  trpc.tasks.onChanged.useSubscription(undefined, {
    enabled,
    onData: (event) => {
      // Invalidate the full task domain so all views refresh
      invalidateTaskDomain(utils).catch(() => {});
      console.debug("[TaskRealtimeBridge] task event:", event.type, "taskId:", event.taskId);
    },
    onError: (err) => {
      // Log but don't crash — SSE will auto-reconnect
      console.warn("[TaskRealtimeBridge] subscription error:", err.message);
    },
  });

  return null;
}
