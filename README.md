# Feliam frontend

Premium, responsive React application for Feliam. It serves Super Admin, Client Admin, Client Staff and restricted guest experiences through one design system and one generic event workflow.

## Stack

- React 19, Vite and strict TypeScript
- Tailwind CSS with semantic theme tokens
- TanStack Query for server state
- React Router with lazy-loaded major routes
- React Hook Form and Zod
- Socket.IO client with short-lived backend tickets
- i18next/react-i18next with English namespaces
- Vitest, React Testing Library, MSW and Playwright

## Setup

```bash
cd /Users/brikenaahmeti/events-ai-frontend
corepack enable
pnpm install
cp .env.example .env
pnpm dev
```

Open `http://localhost:5173`. Start the backend separately at `http://localhost:3000`.

## Environment

Only browser-safe endpoints belong here:

```dotenv
VITE_API_URL=http://localhost:3000/api/v1
VITE_WS_URL=http://localhost:3000
VITE_ENABLE_SOCKET_PROGRESS=true
```

Never add database URLs, Supabase secret keys, OpenAI keys, R2 credentials, Resend keys or encryption keys to frontend environment variables.

## Vercel deployment

Create a Vercel project with this directory as its root. The checked-in `vercel.json` selects Vite and preserves React Router routes on direct navigation. Add these production variables in the project settings:

```dotenv
VITE_API_URL=https://YOUR-BACKEND.vercel.app/api/v1
VITE_ENABLE_SOCKET_PROGRESS=false
```

Then deploy from the project directory:

```bash
pnpm dlx vercel
pnpm dlx vercel --prod
```

The Concierge uses streamed HTTPS for its response path, so it does not depend on a persistent WebSocket connection. Keep `VITE_ENABLE_SOCKET_PROGRESS=false` on Vercel. Socket.IO is an optional enhancement for organizer-side background progress updates on a long-running backend; set it to `true` there and provide `VITE_WS_URL`.

## Application architecture

```text
src/
  app/             brand, providers and router
  components/      atoms, molecules and organisms
  features/        domain hooks, policies and composed behavior
  pages/           route-level compositions
  layouts/         platform and guest shells
  lib/             API, WebSocket and query-key infrastructure
  i18n/            locale namespaces
  styles/          semantic theme tokens
  types/           API/domain contracts
```

Atoms contain generic visual primitives without API behavior. Molecules compose accessible fields, status, dialogs and empty states. Organisms compose complete application sections such as event cards and the Concierge workspace. Pages own route composition and domain mutations.

TanStack Query is the server-state source of truth. Query-key factories centralize cache invalidation. Major page routes are split into independent production chunks.

## Authentication and API client

All business traffic goes to NestJS. Requests use `credentials: include`. The centralized client obtains and sends `X-CSRF-Token` for mutations, normalizes the backend error contract and performs single-flight refresh followed by one eligible retry.

Platform access/refresh credentials are never returned to application JavaScript, decoded by React or stored in localStorage, sessionStorage or IndexedDB. `GET /auth/me` provides the authoritative identity, membership and effective UI permissions.

UI permission checks improve navigation and action clarity; the backend remains authoritative.

## Routes

- `/login`, `/forgot-password`, `/activate`, `/reset-password`
- `/app/dashboard`
- `/app/profile`
- `/app/clients`, `/app/clients/:clientId`
- `/app/team`
- `/app/events`, `/app/events/new`
- `/app/events/:eventId` with overview, Concierge, guests, documents, invitations and schedule
- `/e/:eventSlug` for general guest identification
- `/i/:invitationToken` for one-time invitation exchange
- `/guest/events/:eventId` for the restricted guest experience

Event setup is a guided Concierge conversation. A Super Admin first selects the client; client users stay in their own tenant. Text and optional PDF, DOCX, TXT, CSV or XLSX input is reviewed into structured details, an event type, mandatory-field follow-ups and venue facilities. Missing names receive an explicit Accept/Reject suggestion flow.

The event directory is a paginated table with all-client access for the platform administrator and tenant-wide access for client users. It filters by event name, client, creator, upcoming/ongoing/past/cancelled state, a single date or a date range. Server-provided capabilities keep edit, cancel and delete actions aligned with upcoming-state and staff ownership rules.

Published event workspaces show the general link and QR directly in the Concierge conversation. General and personal links both confirm name and email before opening the guest experience; closed links show not-started, ended or cancelled states. Guest access remains available through four hours after the event ends.

## Brand and theme

The supplied Feliam identity is centralized in `src/app/config/brand.ts`, with browser assets in `public/brand`. The interface uses the official charcoal teal, warm white, black and grey palette, the supplied mark, and Space Grotesk without gradients or drop shadows.

All colors live as semantic CSS variables in `src/styles/index.css`, including background, surfaces, text, borders, primary, accent, success, warning, danger, focus and sidebar. Components use semantic Tailwind utilities rather than raw colors.

Light, dark and system themes are supported. Preference is persisted independently of authentication and system changes are observed. A small inline bootstrap prevents a major initial theme flash.

## Responsive and accessible behavior

- sidebar becomes an accessible mobile drawer
- event navigation wraps into touch-friendly rows
- tables become labeled stacked records at narrow widths
- dashboard cards and event workspaces deliberately recompose by breakpoint
- guest pages are mobile-first and separate from administration
- native labels, semantic landmarks, visible focus, ARIA live regions, accessible dialogs and reduced-motion behavior are built in
- long-running documents and invitations use status/progress states instead of blocking pages

## Internationalization

English is the only active locale. Copy is organized by `common`, `auth`, `dashboard`, `clients`, `team`, `events`, `guests`, `documents`, `concierge`, `invitations`, `guest` and `errors` namespaces. Add future locales without changing page/component architecture.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Vitest/MSW tests do not require external services. Playwright intercepts backend calls for deterministic desktop/mobile browser flows. Live full-stack verification requires configured non-production Supabase, R2, Resend or SMTP, and OpenAI services in the backend.

## Demo workflow

Run the backend migration and seed first. With real demo Supabase passwords configured, sign in using the email values set by `DEMO_SUPER_ADMIN_EMAIL`, `DEMO_CLIENT_ADMIN_EMAIL` or `DEMO_CLIENT_STAFF_EMAIL` and the matching password. The dashboard exposes the same underlying event workflow for the fictional Presidents Club Mallorca and Global Leadership Forum scenarios.
