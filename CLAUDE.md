# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A volleyball event planner web app — manages events, participants, payments, and QR code generation for Czech bank transfers. Built with React 19 + TypeScript, deployed on Vercel with Upstash Redis backend.

## Commands

```bash
npm run dev              # Start both frontend (:5173) and API (:3001) servers
npm run dev:vite         # Frontend only (Vite dev server)
npm run dev:api          # API only (Express proxy with tsx watch)
npm run build            # tsc + vite build
npm test                 # Vitest in watch mode
npm test -- --run        # Run tests once
npm test -- --run --coverage  # With coverage
```

## Architecture

### Frontend (SPA)
- **Entry**: `index.tsx` → `App.tsx` (central state holder, no Redux/Context)
- **Components**: `components/` — functional components with hooks, Tailwind CSS, Lucide icons
- **Views**: Login → Calendar/List toggle → Event detail (all state-driven, no router)

### Backend (Vercel Serverless Functions)
- **Handlers in `api/`**: `users.ts`, `events.ts`, `events-batch.ts`, `attendance.ts`, `photos.ts`, `bank-accounts.ts`
- Each handler follows Vercel's `(req, res)` pattern with method-based routing inside
- Local dev uses Express wrapper (`scripts/dev-server.ts`) that adapts Express req/res to Vercel interface
- Vite proxies `/api/*` → `localhost:3001` in development

### Data Layer (Upstash Redis)
- **Credentials**: `volejbal_KV_REST_API_URL` and `volejbal_KV_REST_API_TOKEN` in `.env.local`
- **Key schema**:
  - `user:{id}`, `users:all` (set of IDs)
  - `event:{id}`, `events:all` (set of IDs)
  - `attendance:{eventId}_{userId}`, `attendance:event:{eventId}` (set), `attendance:user:{userId}` (set)
  - `photo:{id}` (base64 data), `bankaccount:user:{userId}`, `bankaccounts:users` (set)
- Events are stored **without** participants — hydrated on GET by joining attendance + user data
- `services/storage.ts` abstracts API calls; falls back to localStorage in tests (detects VITEST env)

### Types
All domain types in `types.ts`: `User`, `BankAccount`, `Participant`, `VolleyballEvent`, `AttendanceRecord`, `DebtItem`, `ViewMode`.

## Key Patterns

- **Participant hydration**: Events API joins attendance records with user data to build `participants[]` on read
- **Cascade deletes**: Deleting a user/event also removes related attendance records, photos, and index entries
- **Photo storage**: Photos stored as base64 in separate Redis keys (`photo:{id}`), referenced by lightweight URL in user object
- **Czech payment QR codes**: SPD format with IBAN conversion from Czech account numbers (e.g., `123456789/0100`)
- **Sorting**: Czech locale (`cs`) collation for alphabetical user sorting
- **Recurring events**: `utils/recurrence.ts` generates arrays of ISO dates (weekly/biweekly, capped at 26). Batch-created via `POST /api/events-batch` with atomic Redis pipeline.

## Testing

- Vitest with jsdom environment and React Testing Library
- Tests co-located with components (`*.test.tsx`)
- Storage tests use localStorage fallback (no Redis needed)

## Release Notes

### v1.6.0 — Statistics Redesign (2026-05-11)

#### 📊 New Statistics Engine (`services/statsEngine.ts`)
- **Pure computation functions**: All stats logic extracted from hook into standalone, unit-testable functions.
- **ELO rating system**: Running skill rating (K=32, initial 1000) computed on the fly from game history. Team-averaged for fair multi-player matching.
- **Form trend**: Last 5/10 game win rates vs all-time, with trend detection (up/down/stable, ±10% threshold).
- **Day-of-week heatmap**: Per-user attendance distribution across Mon–Sun.
- **Nemesis & Favorite opponent**: Tracks win/loss record against each opponent (min 3 games).
- **Clutch factor**: Win rate in close sets (≤3pt margin) vs blowout sets (min 5 sets).
- **Reliability score**: 0–100 blending 60% attendance + 40% payment rate.
- **Event health**: Average fill rate, average set margin, top 3 most competitive matches.
- **Extended badges**: 10 badge types including Comeback King, Clutch Hráč, Všední Válečník, plus original 6.

#### 🎯 Per-Metric Data Thresholds
- Each stat independently shows "Nedostatek dat" when its minimum isn't met.
- ELO: min 5 games | Form: min 5/10 games | Nemesis: min 3 games against | Clutch: min 5 close sets | Duos: min 3 games together (raised from 2) | Leaderboard: min 3 events | Day heatmap: min 5 events.

#### 🏆 Redesigned Stats Page
- **Vertical scroll layout**: Single-column, mobile-friendly. No tabs.
- **Žebříček (Leaderboard)**: Sortable table with rank, avatar, ELO, win%, games, reliability. Current user highlighted.
- **Moje forma**: Hand-rolled SVG sparkline (30px, blue/green/red) + last 5 rate + trend arrow + V/P result dots.
- **Denní rozložení**: 7-bar horizontal heatmap (Po–Ne) with proportional fill.
- **Soupeři**: Nemesis (😈) and Favorite (😊) opponent cards with win rate.
- **Clutch faktor**: Close-game vs blowout win rate comparison.
- **Personal stats**: Extended with ELO + reliability tiles.
- **Ocenění**: Horizontal scroll of 10 badge types.
- **Nejlepší dvojice**: Duo stats with raised threshold.
- **Zdraví událostí**: Fill rate gauge + competitive match highlights.

#### ✅ Tests (30 new, 265 total)
- `services/statsEngine.test.ts` — 30 tests: ELO (4), form trend (6), day heatmap (3), nemesis (3), clutch (3), reliability (3), leaderboard (2), event health (2), badges (2), user stats (1), duo threshold (1).
- Updated `services/useStatistics.test.ts` — duo tests bumped to 3-game threshold.

### v1.5.0 — Recurring Events (2026-05-11)

#### 🔁 Recurring Event Creation
- **"Opakovat událost" toggle**: New section in CreateEventModal lets users create repeating events in a single action.
- **Frequency selector**: Choose between "Každý týden" (weekly) or "Každé 2 týdny" (biweekly).
- **Count input**: Set number of occurrences (2–26, capped at half a year of weekly events).
- **Batch creation**: All recurring events created atomically via a single API call — no partial failures.
- **Dynamic submit button**: Button text reflects event count (e.g. "Vytvořit 8 událostí").

#### 🛠️ Batch API Endpoint (`api/events-batch.ts`)
- **`POST /api/events-batch`**: Accepts `{ events: EventData[] }`, validates array (non-empty, max 26), normalizes IDs and sport types.
- **Atomic Redis pipeline**: All events stored in a single pipeline execution — all-or-nothing semantics.
- **Error handling**: Returns 400 for invalid input (empty array, exceeds max), 405 for wrong method, 500 with `{ error, detail }` on pipeline failure.
- **Response**: `{ success: true, ids: string[], count: number }` on success.

#### 📦 Storage Layer
- **`storage.createEventsBatch()`**: New function that POSTs to `/api/events-batch` with localStorage fallback for tests.
- **`useDataLoading.createEventsBatch()`**: Hook wrapper with loading state management.

#### 🧮 Pure Utility (`utils/recurrence.ts`)
- **`generateRecurringDates(startDate, config)`**: Returns array of ISO date strings based on `RecurrenceConfig`.
- **`RecurrenceConfig`** interface: `{ enabled: boolean; frequency: 'weekly' | 'biweekly'; count: number }`.
- **Internal capping**: Count always clamped to `Math.min(count, 26)`.

#### ✅ Tests (18 new, 235 total)
- `utils/recurrence.test.ts` — 8 tests: disabled, weekly, biweekly, cap at 26, count edge cases, day-of-week preservation, year boundary.
- `components/CreateEventModal.test.tsx` — 10 tests: toggle renders, options visibility, single vs. batch submit, unique IDs, biweekly dates, count clamping, shared properties.

### v1.4.0 — Multi-Strategy Team Rebalancing (2026-04-13)

#### 🔄 Always-Different Team Shuffling
- **Multi-strategy balancing**: "Zamíchat" now rotates through 3 different balanced-team strategies, ensuring every click produces a different team configuration.
- **Previous-team avoidance**: `balanceTeams()` accepts `previousTeams` option; tries up to 12 attempts across strategies to avoid duplicating the current split.
- **`teamsAreSame()` helper**: Compares team configurations regardless of team order or member order within a team.

#### 🎯 3 Balancing Strategies
- **Jittered Snake Draft** (`jitteredSnakeDraft`): Snake-draft with controlled random noise on ratings. Similarly-rated players get shuffled into different positions each time.
- **Greedy Swap** (`greedySwapBalance`): Random initial partition → iterative pairwise swaps to minimize total rating difference.
- **Random Partition** (`randomPartitionBalance`): Random shuffle → hill-climbing optimization picking the best swap per iteration.

#### ✅ Tests (20 new, 207 total)
- `teamsAreSame` — 5 tests: identical, swapped order, different, single-player, reordered members.
- `balanceTeams with previousTeams` — 4 tests: different result, 2-player edge, team size, no-previous.
- `jitteredSnakeDraft` — 3 tests: valid split, fixed size, varied results.
- `greedySwapBalance` — 2 tests: balanced output, varied results.
- `randomPartitionBalance` — 2 tests: correct sizes, hill-climbing balance.
- `balanceTeams with forced strategy` — 3 tests: one per strategy.
- `ALL_STRATEGIES` — 1 test.

### v1.3.0 — Smart Teams, Set Scores & EventDetail Refactor (2026-04-06)

#### 🎯 Balanced Team Splitting
- **Performance-based balancing**: Teams split using snake-draft algorithm based on player win rate + set performance.
- **Blended rating**: `effectiveRating = 0.6 × winRate + 0.4 × setWinRatio` for players with enough data.
- **Minimum data threshold**: Players with < 3 games get group average rating instead of unreliable personal stats.
- **`utils/teamBalancer.ts`**: Exports `computePlayerRatings()`, `balanceTeams()`, `teamRating()`, `extractRounds()`, `teamsAreSame()`, `jitteredSnakeDraft()`, `greedySwapBalance()`, `randomPartitionBalance()`, `BalancingStrategy`, `ALL_STRATEGIES`.

#### 📊 Set Score Tracking
- **Score input per game**: Enter set scores (e.g. 25:20, 18:25) via inline editor in team section.
- **Read-only display**: Color-coded set results + set tally (e.g. "2:1 na sety").
- **Persisted in history**: Scores saved with game rounds and displayed in game history.
- **Feeds balancer**: Set-level performance data improves team balancing accuracy.

#### 🧩 EventDetail Component Split (1 133 → 14 files)
- **4 custom hooks**: `useTeamManagement`, `useScoreTracking`, `useParticipants`, `usePhotoUpload`.
- **6 sub-components**: `EventDetailHeader`, `ParticipantList`, `WaitlistSection`, `TeamSection`, `ScoreEditor`, `PaymentSection`.
- **Shared utilities**: `teamUtils.ts` (team participant sync), `utils/iban.ts` (IBAN conversion).
- **Hook objects pattern**: Sub-components receive hook return objects (e.g. `teamManagement={teamManagement}`) instead of 10+ individual props.
- **`@/` path alias**: All cross-module imports use `@/types.ts`, `@/utils/...`, `@/services/...` pattern.

#### ✨ UX Improvements
- **Spinning shuffle button**: RefreshCw icon animates on "Zamíchat" / "Nová hra" click.
- **Compact login screen**: Horizontal layout with smaller padding.
- **Removed Fotbal/Florbal**: App supports Volejbal, Tenis, Badminton only.
- **Auto team refresh**: Teams update incrementally when participants join/leave.

#### ✅ Tests (27 new, 185 total)
- `utils/teamBalancer.test.ts` — 27 tests: snake-draft, blended rating, min threshold, backward compat, extractRounds.

### v1.2.0 — Async Payments, Stability & Changelog Page (2026-03-29)

#### ⚡ Optimistic Async Updates
- **Payment toggle** (`handlePaymentToggle`): Checkbox flips instantly with optimistic UI; persists to server in background. No full-page reload.
- **Status change** (`handleStatusChange`): Jdu/Nejdu updates instantly; background sync fetches authoritative state. Rollback on error.
- **Per-participant loading**: Only the affected row shows a spinner — rest of the UI stays interactive.

#### 🔧 Fixes
- **Stable participant ordering**: Participants sorted by name (Czech locale `cs`) via `useMemo` — no more random reordering on server sync.
- **Fixed-width payment label**: Checkbox container and "Zaplaceno/Nezaplaceno" text have fixed widths (`w-4 h-4` + `w-[4.5rem]`) — no layout shift on toggle.

#### 📋 Release Notes Page (`ReleaseNotesPage.tsx`)
- Static "Seznam změn" page with full version history (v1.0.0 → v1.2.0)
- Accessible from **desktop header** (ℹ️ info icon) and **mobile settings modal** (link at bottom)
- New `MobileView: 'changelog'` with animated slide-in and back navigation

### v1.1.0 — Mobile Redesign & Code Splitting (2026-03-29)

#### 🎨 Mobile UX Overhaul
- **Section-based mobile navigation**: Mobile view now shows one screen at a time instead of everything stacked in one long scroll.
  - **Calendar screen**: Calendar + upcoming event list. Tap an event card → slides to detail.
  - **Event detail screen**: Full-screen `EventDetail` with animated slide-in. Back button in header returns to calendar.
  - **Stats screen**: Full-screen `StatsPage` accessible from bottom nav.
- **Bottom navigation bar** (`MobileBottomNav`): Fixed bar with 4 slots — Kalendář, floating ➕ FAB, Statistiky, Nastavení. Only visible on mobile (`md:hidden`).
- **Context-aware mobile header** (`MobileHeader`): Shows app name + logout on calendar, back arrow + title on detail/stats views.
- **Slide & fade animations**: `slideInRight` for drill-down transitions, `fadeInUp` for calendar screen entry. CSS keyframes added to `index.html`.
- **Desktop layout unchanged**: All existing desktop two-column layout preserved behind `hidden md:flex` breakpoints.

#### 🧩 Code Splitting (App.tsx: 512 → 276 lines)
- **`utils/debt.ts`**: Pure `calculateDebts()` function extracted from App's inline debt useEffect. No React dependency — trivially unit-testable.
- **`components/EventCard.tsx`**: Reusable event card with selected state styling, participant count, delete button, and optional chevron mode for mobile drill-down.
- **`components/EventList.tsx`**: Event list section with header (upcoming vs. date mode), empty states, back-to-upcoming button, and optional "Přidat" button.
- **`components/MobileBottomNav.tsx`**: Bottom tab bar with grid layout, floating FAB for event creation.
- **`components/MobileHeader.tsx`**: Context-aware mobile header switching between home/detail/stats views.

#### ✅ New Tests (42 tests across 5 files)
- `utils/debt.test.ts` — 9 tests: empty inputs, overdue detection, rounding, multi-event debts, declined participant exclusion.
- `components/EventCard.test.tsx` — 8 tests: rendering, click handlers, selected styles, chevron vs. delete mode.
- `components/EventList.test.tsx` — 10 tests: upcoming vs. date headers, empty states, add button visibility, back button.
- `components/MobileBottomNav.test.tsx` — 8 tests: tab rendering, active highlighting, all click handler routing.
- `components/MobileHeader.test.tsx` — 7 tests: view mode switching, back/logout callbacks, photo display.

