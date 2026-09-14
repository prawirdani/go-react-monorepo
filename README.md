# React Monorepo Template

A production-oriented React monorepo template built with **pnpm + Turborepo**. Ships a single dashboard app plus a set of shared packages (API client, TanStack Query wrappers, zod schemas, UI kit) that can be reused by future apps.

## Tech Stack

- **Build:** Vite + Turborepo + pnpm workspaces
- **Framework:** React 19
- **Routing:** TanStack Router (file-based)
- **Server state:** TanStack Query
- **Forms:** TanStack Form (via a shared `useAppForm` wrapper) + zod
- **Client state:** zustand (auth store)
- **UI:** Tailwind CSS v4 + base-ui/shadcn-style components in `@repo/ui`
- **Linting/formatting:** Biome (per-package configs)

## Structure

```
apps/
  dashboard/          # Vite + React app (the only app)
    src/
      components/     # shared UI + form components
      hooks/          # useErrorHandler etc.
      lib/api.ts      # APIClient + typed API instances + imageUrl
      routes/         # TanStack Router file routes (login, (app), auth/...)
      stores/         # zustand auth store
packages/
  api/                # @repo/api      fetch wrapper + AuthAPI/UserAPI + error types
  config/             # @repo/config   shared tsconfig/biome configs
  queries/            # @repo/queries  TanStack Query queryOptions wrappers
  schemas/            # @repo/schemas  zod schemas + TS types (request/response)
  ui/                 # @repo/ui       shared UI components, icons, providers
  utils/              # @repo/utils    helpers (date, strings, ...)
```

## Getting Started

```bash
pnpm install
cp apps/dashboard/example.env apps/dashboard/.env   # then fill in values
pnpm dev                                             # dashboard on :3000
```

### Environment Variables (`apps/dashboard/.env`)

| Variable          | Purpose                                                    |
| ----------------- | ---------------------------------------------------------- |
| `VITE_API_URL`    | Backend base URL (e.g. `http://localhost:8080`)            |
| `VITE_IMAGE_URL`  | Asset server base URL for uploaded files (`/profiles/...`) |
| `VITE_VERSION`    | App version shown in the sidebar footer (e.g. `v0.1.0`)    |

### Scripts

```bash
pnpm build          # turbo run build
pnpm dev            # turbo run dev
pnpm lint           # biome lint
pnpm format         # biome format
pnpm check:write    # biome check --write
```

## Authentication & Session Model

The template is built around a **cookie-based** auth flow — no tokens are stored in `localStorage`:

- Login/refresh set `httpOnly` cookies (`access_token`, `refresh_token`).
- `APIClient` always sends `credentials: "include"` and transparently refreshes on `401` (single-flight, retries once).
- A refresh failure marks the session expired and redirects to `/login`.
- Auth state lives in `apps/dashboard/src/stores/auth-store.ts` (zustand); `/auth/me` populates the current user.

## Backend Compatibility

This template is the frontend companion to

**https://github.com/prawirdani/golang-restapi**

The two repos are kept in sync; when the backend changes, the API layer in `packages/api` and schemas in `packages/schemas` must be updated to match. Key contracts:

- **Base path:** all endpoints live under `/api` (no version prefix). Health check at `/status`.
- **Success envelope:** `{ "data": ..., "message": string | null }` (201 for register, `data` omitted).
- **Error envelope (flat):** `{ "message": string, "details": any, "code": string }`.
  - Validation failures: HTTP 422, `code: "VALIDATION"`, `details` = `{ errors: [{field, tag, message}], details: { field: [msg, ...] } }`.
  - `parseAPIError` (`packages/api/src/errors.ts`) unwraps this into the app's discriminated error union; field maps feed `setFormErrors`.
- **Auth endpoints:**

| Method | Path                          | Notes                                   |
| ------ | ----------------------------- | --------------------------------------- |
| POST   | `/api/auth/login`             | rate-limited 5/min; sets cookies        |
| POST   | `/api/auth/register`          | `{ name, email, phone?, password, gender? }` |
| POST   | `/api/auth/refresh`           | no body; cookie or Bearer refresh token |
| POST   | `/api/auth/password/recover`  | `{ email }`; throttle + `Retry-After` header |
| GET    | `/api/auth/password/recover/{token}` | `{ expires_at, used_at }`          |
| PUT    | `/api/auth/password/reset`    | `{ token, new_password }`               |
| DELETE | `/api/auth/logout`            | clears cookies                          |
| GET    | `/api/auth/me`                | current user                            |
| PUT    | `/api/auth/password/change`   | `{ password, new_password }`            |
| PUT    | `/api/users`                  | `{ name, phone?, gender? }`             |
| PUT/DELETE | `/api/users/profile-picture` | multipart form field `image`         |

- **Auth header:** `Authorization: Bearer <access_token>`, or the `access_token` cookie (cookie tried first).
- **Error codes used by the app:** `VALIDATION`, `AUTH_CREDENTIALS`, `AUTH_EXPIRED`, `AUTH_INVALID_SESSION`, `AUTH_INVALID_RECOV_TOKEN`, `AUTH_RECOVERY_THROTTLED` (details: `{ allowed, retry_after }`), `RESOURCE_NOT_FOUND`, `REQ_UNAUTHORIZED`, `USER_EMAIL_CONFLICT`, plus the general HTTP codes (`REQ_RATE_LIMIT`, `BODY_TOO_LARGE`, ...).

## Gotchas

- **Adding an `exports` subpath to a workspace package requires a dev-server restart.** Vite caches the `exports` map, so a stale cache surfaces as an HTTP 500 on whichever module imports the new subpath — while `tsc` and `vite build` stay green, because a fresh process resolves it correctly. Restart `pnpm dev`; don't chase the module itself.
- **Set `VITE_VERSION` in the build environment.** `apps/dashboard/.env` is gitignored and `example.env` is only a template, so a production build needs the value supplied by the environment — otherwise the sidebar footer falls back to `dev`.
- **Pre-existing `tsc` failures** (not caused by feature work): the `/example` vs `/example/` route-type mismatch under `src/components/layout/*`, an unknown `babel` option in `vite.config.ts`, and an unused `userAPI` in `packages/queries/src/user.query.ts`. Don't "fix" them unless asked.
