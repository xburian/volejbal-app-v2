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
- **Handlers in `api/`**: `users.ts`, `events.ts`, `attendance.ts`, `photos.ts`, `bank-accounts.ts`
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

## Testing

- Vitest with jsdom environment and React Testing Library
- Tests co-located with components (`*.test.tsx`)
- Storage tests use localStorage fallback (no Redis needed)

## Release Notes

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

