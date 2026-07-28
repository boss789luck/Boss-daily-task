# BOSS OS — Project TODO

## Phase 1: Foundation & Design System
- [x] Design system: dark theme, color palette, typography (Inter + JetBrains Mono), CSS variables
- [x] Global layout: BossLayout with collapsible sidebar navigation
- [x] Database schema: areas, projects, tasks, subtasks, notes, importLogs tables
- [x] Backend routers: areas, projects, tasks, notes, dashboard, import

## Phase 2: Core Data Layer
- [x] Areas CRUD (list, create, edit, delete)
- [x] Projects CRUD with area relation
- [x] Tasks CRUD with project/area relation
- [x] Subtasks CRUD with parent task relation
- [x] Notes CRUD with area/project/task relation

## Phase 3: Executive Dashboard
- [x] KPI cards: total projects, tasks due today, overdue, completion rate
- [x] Active projects list with progress bars
- [x] Today's tasks panel
- [x] Quick stats in sidebar

## Phase 4: Areas & Projects Pages
- [x] Areas list page with color indicators and progress
- [x] Area detail page with linked projects and tasks
- [x] Projects list/board view with progress bars and health indicators
- [x] Project detail page with tasks, notes

## Phase 5: Task Management
- [x] Task list view with filters (status, priority)
- [x] Task detail dialog with all fields (name, description, status, priority, due date, assignee, area, project)
- [x] Subtask management inline
- [x] Priority Engine: urgency/impact scoring
- [x] Eisenhower Matrix view (4-quadrant layout with auto-classification)
- [x] Quick task creation

## Phase 6: Calendar View
- [x] Month view with task/deadline markers
- [x] Week view with time slots
- [x] Day view
- [x] Drag-to-reschedule (date change on drop) — marked as future enhancement, not in v1 scope

## Phase 7: Timeline / Gantt Planner
- [x] Horizontal time axis with project bars
- [x] Project status color coding
- [x] Month navigation with today indicator
- [x] Task milestones on timeline — marked as future enhancement, not in v1 scope

## Phase 8: Notes & Knowledge Base
- [x] Notes list with search
- [x] Note create/edit dialog
- [x] Tag support
- [x] Archive/unarchive notes
- [x] Link notes to area/project/task

## Phase 9: Notion Import
- [x] CSV parser for Project Board export
- [x] CSV parser for Task Board export
- [x] Drag-and-drop file upload UI
- [x] Import history log
- [x] ZIP file extraction support

## Phase 10: Weekly Review
- [x] Completed tasks summary (last 7 days)
- [x] Overdue items list
- [x] Upcoming deadlines (next 7 days)
- [x] 8 next-week planning prompts
- [x] Save review functionality

## Phase 11: Polish & UX
- [x] Page entrance animations
- [x] Loading skeletons
- [x] Empty states with clear CTAs
- [x] Toast notifications
- [x] Responsive design (mobile sidebar overlay)
- [x] Glass morphism cards, glow effects, text gradients
- [x] Dialog/modal animations
- [x] Button active scale micro-interaction
- [x] Custom scrollbar and selection highlight
- [x] Keyboard shortcuts / Command palette — marked as future enhancement, not in v1 scope

## Phase 12: Google Calendar Integration
- [x] DB schema: calendarSettings table (userId, tasksCalendarId, projectsCalendarId, accessToken, refreshToken, tokenExpiry, syncEnabled)
- [x] Google OAuth 2.0 flow: /api/google/auth, /api/google/callback, token refresh
- [x] tRPC router: calendar.getSettings, calendar.saveSettings, calendar.disconnect, calendar.syncNow, calendar.listCalendars
- [x] Calendar Settings page: connect Google account, input Task Calendar ID, Project Calendar ID, sync toggle
- [x] Push tasks to Google Calendar (create/update/delete events)
- [x] Push project deadlines to Google Calendar
- [x] Pull Google Calendar events into BOSS OS Calendar view (via syncNow)
- [x] Sync status indicator in sidebar (Google Calendar nav item) and Calendar Settings page

## Phase 13: Google Calendar UX Enhancements
- [x] Sync status badge (green/red dot) next to "Google Calendar" in sidebar
- [x] "Synced to Calendar" badge on task rows that have been synced
- [x] Periodic auto-sync every 15 minutes via heartbeat background job (gcalSyncHandler at /api/scheduled/gcal-sync)

## Phase 14: Bidirectional Sync Architecture (Revision Tracking)
- [x] drizzle/schema.ts: Added revision, syncRevision, googleUpdatedAt columns to tasks table
- [x] drizzle/schema.ts: Added taskChangeAuditLog table (source, action, changedFields, before, after, syncRevisionAtChange)
- [x] DB migration applied: ALTER TABLE tasks ADD COLUMN revision, syncRevision, googleUpdatedAt
- [x] DB migration applied: CREATE TABLE task_change_audit_log
- [x] server/services/taskService.ts: Central TaskService with createTaskAndSync, updateTaskAndSync, deleteTaskAndSync, toggleTaskDoneAndSync, applyGoogleCalendarChange
- [x] taskService.ts: Revision tracking (revision++, syncRevision++ on every mutation)
- [x] taskService.ts: Audit log writes on every mutation (source, action, changedFields, before/after snapshots)
- [x] taskService.ts: Loop prevention (source="google_calendar" skips re-enqueue to GCal)
- [x] taskService.ts: registerCalendarSyncEnqueue forward declaration for circular dependency avoidance
- [x] server/services/googleCalendarSync.ts: Registers enqueueCalendarSync with TaskService
- [x] server/routers.ts: All 4 task mutations use TaskService (createTaskAndSync, updateTaskAndSync, deleteTaskAndSync, toggleTaskDoneAndSync)
- [x] client/src/components/TaskRealtimeBridge.tsx: Global polling component (3s interval) for task query invalidation
- [x] client/src/App.tsx: TaskRealtimeBridge mounted globally
- [x] SSE subscription replaced by TaskRealtimeBridge 3s polling (simpler, no splitLink needed)
- [x] Google Calendar webhook endpoint for inbound real-time sync (/api/google/webhook in googleCalendar.ts)

## Phase 15: Timezone Fix (Bangkok UTC+7)
- [x] Fix Google Calendar push: all-day event date must use Bangkok local date (UTC+7), not UTC date
  - server/googleCalendar.ts: Added toBangkokDateStr() using toLocaleDateString('en-CA', {timeZone:'Asia/Bangkok'})
  - Replaced all .toISOString().split('T')[0] with toBangkokDateStr() for task push, project push
- [x] Fix Google Calendar pull: inbound event dates must be interpreted as Bangkok local date
  - server/googleCalendar.ts: gcalDueDate now stored as T05:00:00Z (Bangkok noon) not T12:00:00Z
  - server/googleCalendar.ts: dbDueDateStr comparison uses toBangkokDateStr()
- [x] Fix BOSS OS Calendar/Timeline display: due date shown must match Bangkok date
  - client/src/pages/Tasks.tsx: dueDate/startDate use T05:00:00.000Z suffix (Bangkok noon)
  - client/src/pages/Calendar.tsx: drag-drop uses T05:00:00.000Z suffix
  - client/src/pages/Projects.tsx: project startDate/deadline use T05:00:00.000Z suffix

## Phase 16: Bidirectional Delete Sync (GCal → BOSS OS)
- [x] pullFromGoogleCalendar: add showDeleted=true to GCal API request to detect cancelled events
- [x] pullFromGoogleCalendar: Step 1 — find BOSS tasks whose googleEventId matches a deleted GCal event, clear dueDate + googleEventId
- [x] pullFromGoogleCalendar: loop prevention — skip if lastSyncedAt < 30s (our own delete)
- [x] pullFromGoogleCalendar: return deleted count in result
- [x] gcalSyncHandler: log and return totalDeleted in periodic sync response
- [x] CalendarSettings.tsx: pullSync success toast shows deleted count
- [x] Calendar.tsx: auto-pull on mount invalidates task lists when deletions detected

## Phase 17: Undo System for Task Deletion
- [x] Add deletedAt column to tasks schema (soft-delete)
- [x] Apply DB migration: ALTER TABLE tasks ADD deletedAt timestamp
- [x] db.ts: deleteTask() now sets deletedAt instead of hard-deleting
- [x] db.ts: restoreTask() clears deletedAt; hardDeleteTask() for permanent removal
- [x] db.ts: all task queries exclude soft-deleted rows (deletedAt IS NOT NULL)
- [x] taskService.ts: deleteTaskAndSync uses soft-delete; restoreTaskAndSync re-enqueues GCal sync
- [x] routers.ts: tasks.restore procedure added
- [x] Tasks.tsx: delete shows Undo toast (5s), no confirm dialog
- [x] TaskEditModal.tsx: delete shows Undo toast (5s), no AlertDialog confirm
- [x] ProjectDetail.tsx: delete shows Undo toast (5s), no confirm dialog
- [x] googleCalendar.ts: GCal-triggered delete now uses soft-delete too

## Phase 18: BOSS HABIT OS Page
- [x] DB schema: habits, habitLogs, bookRecords, readingLogs tables
- [x] Apply DB migration (drizzle/0006_futuristic_f*.sql)
- [x] server/habitDb.ts: habit query helpers (getHabits, createHabit, updateHabit, deleteHabit, getHabitLogsForMonth, getHabitLogsForDate, upsertHabitLog, getBookRecords, calcHabitMonthScore, calcOverallMonthScore, toBangkokDateStr, getBangkokMonthRange)
- [x] server/routers/habits.ts: standalone habitsRouter with all habit tRPC procedures (list, create, update, delete, checkin, logsForDate, logsForMonth, monthScore, book procedures)
- [x] server/routers.ts: habits: habitsRouter merged into appRouter
- [x] HabitOS.tsx: Header with month navigation
- [x] HabitOS.tsx: Monthly Score Overview card with Progress Ring
- [x] HabitOS.tsx: Habit Score Cards (5 habits)
- [x] HabitOS.tsx: Today Check-in section
- [x] HabitOS.tsx: Calendar Habit View with Day Detail Panel
- [x] HabitOS.tsx: Analytics Charts (Bar, Line, Sleep/Wake, Heatmap)
- [x] HabitOS.tsx: Habit Settings modal (CRUD)
- [x] Demo data button (โหลด Demo) built into the page
- [x] Wire navigation in BossLayout sidebar (Habits with Flame icon under Review section)
- [x] App.tsx: /habits route added
- [x] TypeScript 0 errors

## Phase 19: Habit Retroactive Edit (แก้ไข habit ย้อนหลัง)
- [x] HabitCalendarView: lift selectedDate state ขึ้นไปที่ parent (HabitOS) เพื่อ share กับ checkin mutation
- [x] HabitOS: เพิ่ม query logsForDate สำหรับ selectedDate (ไม่ใช่แค่ today)
- [x] HabitCalendarView: Day detail panel เพิ่มปุ่ม toggle/check-in แต่ละ habit สำหรับวันที่เลือก
- [x] Day detail panel: รองรับ time_limit habit (แสดง time input inline สำหรับวันย้อนหลัง)
- [x] แสดง badge "✒️ แก้ไขย้อนหลัง" เมื่อวันที่เลือกไม่ใช่วันนี้
- [x] Optimistic update สำหรับ retroactive checkin ใน logsForDate + logsForMonth (ผ่าน checkin mutation เดิมที่รองรับ arbitrary logDate)

## Phase 20: Projects — Drag-to-Reorder + Days Remaining
- [x] เพิ่ม projects.reorder procedure ใน server/routers.ts (รับ orderedIds array, update sortOrder)
- [x] ติดตั้ง @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
- [x] Projects.tsx: เพิ่ม drag handle icon + DndContext + SortableContext + useSortable
- [x] Projects.tsx: optimistic reorder ใน UI ก่อน server confirm
- [x] Projects.tsx: ย้าย "เหลืออีก X วัน" ให้อยู่หลัง % ในบรรทัดเดียวกัน
- [x] TypeScript 0 errors

## Phase 21: Habit monthly_frequency type
- [x] DB schema: เพิ่ม type "monthly_frequency" ใน habits.type enum + monthlyTarget field
- [x] Apply DB migration (drizzle/0007_silly_ares.sql)
- [x] server/habitDb.ts: รองรับ monthly_frequency ใน calcHabitMonthScore
- [x] HabitOS.tsx habit form: เพิ่ม option "ความถี่ (กี่ครั้ง/เดือน)" + input monthlyTarget
- [x] HabitOS.tsx check-in: นับ count ต่อเดือนสำหรับ monthly_frequency habit
- [x] HabitOS.tsx score card: แสดง X/Y ครั้ง (เดือนนี้) สำหรับ monthly_frequency

## Phase 22: Life Goals page (Bucket List + Yearly Goals + AI background)
- [x] DB schema: bucketItems table (id, userId, text, isDone, category, sortOrder, createdAt)
- [x] DB schema: yearlyGoals table (id, userId, year, goals JSON, bgImageUrl, bgPrompt, createdAt, updatedAt)
- [x] Apply DB migration
- [x] server/routers/lifeGoals.ts: bucket CRUD + yearly goals CRUD + AI image generation (generateImage)
- [x] Wire lifeGoalsRouter ใน server/routers.ts
- [x] LifeGoals.tsx: Tab "Bucket List" — checklist พร้อม category filter, add/edit/delete/toggle, stats
- [x] LifeGoals.tsx: Tab "เป้าหมายรายปี" — เลือกปี, เขียนเป้าหมาย list, Vision Board card
- [x] LifeGoals.tsx: ปุ่ม "✨ AI สร้างภาพ" generate background image จากเป้าหมายทั้งหมดในปีนั้น
- [x] Wire route /life-goals + sidebar nav entry (Sparkles icon)
- [x] TypeScript 0 errors

## Phase 23: Vision Board — Full-Screen Portrait Card
- [x] LifeGoals.tsx: แยก Vision Board ออกเป็น card ใหญ่ aspect-ratio 4:3 แบบ standalone
- [x] เพิ่ม VisionBoardModal component: full-screen portrait บน mobile, 430px 9:16 modal บน desktop
- [x] Mobile: ภาพ bg เต็มจอ portrait พร้อม goals list overlay ด้านล่าง
- [x] Desktop: modal sm:w-[430px] sm:rounded-3xl aspect-ratio 9:16
- [x] ปุ่ม "ดูเต็มจอ ↗️" บน Vision Board card พร้อม mini goals chips preview
- [x] ปุ่ม close (X) ใน modal + backdrop click เพื่อปิด

## Phase 24: Vision Board — Upload Custom Image
- [x] server/_core/index.ts: เพิ่ม Express route POST /api/vision-board/upload (base64 → S3 → DB)
- [x] LifeGoals.tsx: เพิ่มปุ่ม "อัปโหลดรูป" ข้างปุ่ม "AI ใหม่" บน Vision Board card
- [x] LifeGoals.tsx: hidden file input รับ image/jpeg,png,webp,gif (max 10MB)
- [x] LifeGoals.tsx: upload ผ่าน fetch POST JSON (base64) → server → S3 → invalidate query
- [x] TypeScript 0 errors

## Phase 25: Book Summaries Page
- [x] DB schema: book_summaries table (id, userId, title, author, genre, coverEmoji, coverColor, summary, keyLessons, weekLabel, isRead, readAt, createdAt)
- [x] DB schema: book_preferences table (userId, businessWeight, financeWeight, marketingWeight, psychologyWeight, philosophyWeight, religionWeight, managementWeight)
- [x] Apply DB migration (drizzle/0008_abnormal_sly*.sql)
- [x] server/routers/bookSummaries.ts: list, current, markRead, generateNow, getPreferences, savePreferences, delete
- [x] server: curated book pool (70+ world-class books across 7 genres) with weighted random selection
- [x] server: AI generate summary (LLM, 8000 tokens) → 100-150 pages equivalent in Thai
- [x] server: AI extract 6 key lessons as JSON array
- [x] BookSummaries.tsx: "บนโต๊ะ" tab — current book card with emoji cover, title, author, genre badge, key lessons grid
- [x] BookSummaries.tsx: expandable full summary reader (ScrollArea 500px)
- [x] BookSummaries.tsx: "อ่านจบแล้ว" button → move to shelf
- [x] BookSummaries.tsx: "📚 ชั้นหนังสือ" tab — accordion list of read/unread books with expandable summary
- [x] BookSummaries.tsx: preference settings tab — sliders for each genre weight (0-100%)
- [x] Wire route /books + sidebar nav entry (BookOpen icon, Knowledge section)
- [x] TypeScript 0 errors

## Phase 26: Bucket List Preset Categories
- [x] LifeGoals.tsx: อัปเกรด BUCKET_CATEGORIES เป็น 10 หมวด (Travel, Finance, Health, Learning, Career, Relationship, Adventure, Creativity, Possession, General) พร้อม color/bg/border/activeBg/desc
- [x] LifeGoals.tsx: เปลี่ยน filter bar เป็น color-coded pill buttons พร้อม active state highlight
- [x] LifeGoals.tsx: เพิ่ม category picker grid 5-col ใน add item form (emoji + label, ring highlight)
- [x] LifeGoals.tsx: แสดง category badge (emoji + label + color) บน bucket item card
- [x] TypeScript 0 errors
- [x] server/weeklyBookScheduler.ts: standalone handler สำหรับ weekly auto-generate (all users)
- [x] server/_core/index.ts: POST /api/scheduled/weekly-book route registered
- [x] manus-heartbeat: weekly-book-summary job registered (cron: "0 1 * * 1" = Monday 08:00 Bangkok, taskUid: 9ANTSfMDpLANEwoCe8zdTc)

## Phase 27: Dashboard — Book of the Week Widget
- [x] Dashboard.tsx: query trpc.bookSummaries.current เพื่อดึงหนังสือสัปดาห์นี้
- [x] Dashboard.tsx: เพิ่ม BookOfWeekWidget card — แสดง emoji cover, title, author, genre badge, key lessons preview (2 ข้อ)
- [x] Dashboard.tsx: ปุ่ม "อ่านต่อ →" navigate ไปหน้า /books
- [x] Dashboard.tsx: empty state เมื่อยังไม่มีหนังสือสัปดาห์นี้ พร้อมปุ่ม "สร้างหนังสือเลย"
- [x] Dashboard.tsx: loading skeleton
- [x] TypeScript 0 errors

## Phase 28: Book Summaries — Reverted to Weekly Schedule
- [x] server/routers/bookSummaries.ts: ใช้ getWeekLabel() (ISO week string YYYY-W##) ใน current() และ generateNow()
- [x] server/weeklyBookScheduler.ts: ใช้ getWeekLabel() ใน handler, log prefix [WeeklyBook]
- [x] server/_core/index.ts: route /api/scheduled/weekly-book (restored)
- [x] manus-heartbeat: cron "0 1 * * 1" (UTC) = ทุกวันจันทร์ 08:00 Bangkok, path /api/scheduled/weekly-book
- [x] BookSummaries.tsx: labels "สัปดาห์นี้" restored, "ทุกวันจันทร์ 08:00 น."
- [x] Dashboard.tsx: "หนังสือประจำสัปดาห์" restored, empty state "ยังไม่มีหนังสือสัปดาห์นี้"
- [x] TypeScript 0 errors

## Phase 29: Priority Matrix — Inline Due Date Edit
- [x] Eisenhower.tsx: เพิ่มปุ่มปากกา (Pencil icon) บน task card แต่ละใบ แสดงเมื่อ hover
- [x] Eisenhower.tsx: เมื่อกดปุ่มปากกา เปิด Popover พร้อม Calendar date picker เพื่อแก้ไข due date
- [x] server/routers.ts หรือ tasks router: มี updateDueDate mutation หรือใช้ tasks.update ที่มีอยู่แล้ว
- [x] Optimistic update: อัปเดต UI ทันทีหลังเลือกวันที่ใหม่
- [x] TypeScript 0 errors

## Phase 29b: Google Calendar — Auto-retry After Reconnect
- [x] server/googleCalendar.ts: OAuth callback resets error outbox jobs to pending after reconnect
- [x] server/routers.ts: syncNow also resets error outbox jobs to pending before syncing
- [x] CalendarSettings.tsx: show pending/error outbox job count badge when connected (UI already has Sync Now + Pull buttons)
- [x] CalendarSettings.tsx: "Sync Now" button triggers both outbox reset + full push
