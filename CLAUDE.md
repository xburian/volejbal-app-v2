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
