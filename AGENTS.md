# AGENTS.md

Guidance for AI agents and humans working in this repo.

## Commands

```bash
pnpm install                # workspace install (pnpm 10)
pnpm dev                    # run dashboard on :3000
pnpm build                  # turbo build (vite build && tsc per app)
pnpm lint / format / check:write   # biome
pnpm --filter @repo/api exec tsc --noEmit     # typecheck a package
pnpm --filter dashboard exec tsc --noEmit     # typecheck the app
```

## Layout

- `apps/dashboard` — Vite + React 19 app. Routes are TanStack Router file routes (`src/routes/**`), generated tree in `src/routeTree.gen.ts` (rebuilt by the router plugin on dev).
- `packages/api` — `APIClient` (fetch wrapper + 401 refresh interceptor), `AuthAPI`/`UserAPI`, error types (`errors.ts`).
- `packages/schemas` — zod schemas and TS types for API request/response shapes.
- `packages/queries` — `queryOptions` factories for TanStack Query.
- `packages/ui` — shared UI components (base-ui/shadcn style), icons, toast.
- `packages/utils`, `packages/config` — helpers and shared tsconfig/biome configs.

## Conventions

### API layer (`packages/api`)
- All endpoints go through `APIClient` with the configured `baseURL` from `VITE_API_URL`. **Never hardcode URLs** — a hardcoded `http://localhost:8080` was removed from `recoverPassword`; don't reintroduce.
- Client always sends `credentials: "include"`; auth is **httpOnly-cookie based**. Do not store tokens in localStorage. `tokenProvider`/`TokenPair` are currently unused scaffolding — wire them only if switching to header-based auth.
- Backend error envelope is **flat**: `{ message, details, code }`. `parseAPIError` handles it (plus a legacy `{ error: {...} }` wrapper). `VALIDATION` details are unwrapped to the `{ field: string[] }` map inside `parseAPIError` — callers pass `e.details` straight into `setFormErrors`.
- Response success envelope: `{ data, message }`.

### Schemas (`packages/schemas`)
- Distinguish **form schemas** (client validation only, e.g. include `new_password_confirmation` for match-checking) from **API payload types** (must match backend DTOs exactly, e.g. reset/change send `{ token, new_password }` / `{ password, new_password }` — no confirmation field). Backend ignores unknown JSON fields, but payload types must still mirror the backend.
- JSON field names are **snake_case** (backend Go json tags): `access_token`, `new_password`, `email_verified_at`, `profile_picture`.

### Forms (dashboard)
- Use the shared `useAppForm` wrapper (`src/components/form`). Server errors: `handleError(error, { VALIDATION: (e) => setFormErrors(formApi, e.details), ... })`.
- Error codes the backend emits and the app handles: `VALIDATION`, `AUTH_CREDENTIALS`, `AUTH_EXPIRED`, `AUTH_INVALID_SESSION`, `AUTH_INVALID_RECOV_TOKEN`, `AUTH_RECOVERY_THROTTLED` (`details.retry_after` is an ISO date), `RESOURCE_NOT_FOUND`, `USER_EMAIL_CONFLICT`, `REQ_UNAUTHORIZED`.

### Backend contract (golang-restapi)
- Repo: https://github.com/prawirdani/golang-restapi. All API endpoints under `/api` (no version prefix).
- When the backend changes request/response shapes or error codes, sync `packages/api` + `packages/schemas` (and form call sites) — see README "Backend Compatibility".

## Gotchas

- **Dashboard uses 2-space indent; packages use tabs.** Biome configs differ per package — run biome from the package dir (`./node_modules/.bin/biome` if the root wrapper fails).
- Pre-existing `tsc` failure (not caused by feature work) — 1: `vite.config.ts` rejects an unknown `babel` option (`TS2353`). Route params are typed `FileRouteTypes["to"]` throughout; `keyof FileRoutesByFullPath` no longer type-checks against router links.
- `reset-password.tsx` loader marks the link invalid on *any* loader error (network/5xx included) — behavior worth revisiting but deliberate for now.
- Auth store lives in `src/stores/auth-store.ts` (zustand). RBAC gatekeeper code is commented out there.
- Registration gating is **inverted from what the flag's name suggests**: `internal_mode: false` means a *public* deployment where self-registration is allowed; `true` means an internal deployment where signup is admin-only. Read `apps/dashboard/src/lib/health.ts` (`usePublicRegistration`) and the `beforeLoad` in `routes/auth/register/index.tsx` / `routes/auth/register/complete.tsx`. The client gate is presentation only — the backend owns enforcement.
- Adding a new `exports` subpath to a workspace package (`packages/*/package.json`) requires **restarting the dev server**. Vite caches the `exports` map, and a stale cache surfaces as an HTTP 500 on whichever module imports the new subpath — while `tsc` and `vite build` stay green, because a fresh process resolves it correctly. `pnpm dev` will fix it; don't chase the module itself.
- Reset-token GET (`/api/auth/password/recover/{token}`) is a one-time token; the TanStack Query cache can serve stale valid state if the URL is revisited after use.
