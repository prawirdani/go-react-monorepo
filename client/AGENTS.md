# AGENTS.md

> The **client half** of a merged repo. The API it talks to is the Go module at
> the repository root — see the root `AGENTS.md` for layout, the `make client:*`
> targets, and the contract rule (shape or error-code changes ship client and API
> in one commit).

Guidance for AI agents and humans working in this repo.

## Commands

```bash
pnpm install                # workspace install (pnpm 12)
pnpm dev                    # run dashboard on $VITE_PORT (default 3001)
pnpm build                  # turbo build (vite build && tsc per app)
pnpm lint / format / check:write   # biome
pnpm --filter @repo/api exec tsc --noEmit     # typecheck a package
pnpm --filter dashboard exec tsc --noEmit     # typecheck the app
```

## Layout

- `apps/dashboard` — Vite + React 19 app. Routes are TanStack Router file routes (`src/routes/**`), generated tree in `src/routeTree.gen.ts` (rebuilt by the router plugin on dev).
- `packages/api` — `APIClient` (fetch wrapper + 401 refresh interceptor), `AuthAPI`/`UserAPI`, error types (`errors.ts`).
- `packages/schemas` — zod schemas and TS types for API request/response shapes.
- `packages/queries` — `queryOptions`/`mutationOptions` factories for TanStack Query, plus the `mutation.meta` augmentation (`tanstack-query.d.ts`).
- `packages/ui` — shared UI components (base-ui/shadcn style), icons, toast.
- `packages/utils`, `packages/config` — helpers and shared tsconfig/biome configs.

## Conventions

### API layer (`packages/api`)
- All endpoints go through `APIClient` with the configured `baseURL` from `VITE_API_URL`. **Never hardcode URLs** — a hardcoded `http://localhost:8080` was removed from `recoverPassword`; don't reintroduce.
- Client always sends `credentials: "include"`; auth is **httpOnly-cookie based**. Do not store tokens in localStorage. `tokenProvider`/`TokenPair` are currently unused scaffolding — wire them only if switching to header-based auth.
- Backend error envelope is **wrapped**: `{ error: { message, details, code } }`. `parseAPIError` also parses the legacy flat `{ message, details, code }` form. `VALIDATION` details are unwrapped to the `{ field: string[] }` map inside `parseAPIError` — callers pass `e.details` straight into `setFormErrors`.
- Response success envelope: `{ data, message }`.

### Schemas (`packages/schemas`)
- **Form schemas** and **API payload types** are the same objects: payload types are inferred from the form schemas, so they include the confirmation fields (`password_confirmation`, `new_password_confirmation`) and the three call sites (`reset-password`, `register/complete`, `profile/-change-password-form`) send the full form. The backend ignores unknown JSON fields, so the extra keys are harmless.
- JSON field names are **snake_case** (backend Go json tags): `access_token`, `new_password`, `email_verified_at`, `profile_picture`.

### Data access (dashboard)
- Wire data through `src/lib/data-access/`: `api.ts` (API singletons + `imageUrl`), `queries.ts`, `mutations.ts`. Components import factories from there — never construct an API or reach for a raw instance.
- Factories live in `@repo/queries` and take API instances as args (`authQueries(authAPI)`, `userQueries(userAPI)`, `userMutations(userAPI)`) so the package stays app-agnostic.
- **Ownership**: `getSession` (`authQueries`, key `["auth"]`) owns identity + permissions (`{ user, permissions }`); `lib/auth/store.ts` owns session lifecycle only; `lib/auth/access.ts` owns `can`/`useCan`, `ACCESS`, and the route guards.
- **Auto-invalidation**: a mutation's `meta.invalidatesQuery` is an array of query keys; the `MutationCache` in `lib/query-client.ts` invalidates them on **success**. Target the data that actually changed — and account for shared render dependencies. Every user mutation invalidates both `["auth"]` (session identity) and `["users"]`, because the admin list rows render avatar/name/phone/gender, so a profile edit is visible there too.
- The augmentation that types `mutation.meta` lives in `packages/queries/tanstack-query.d.ts` and is referenced from `packages/queries/src/index.ts`, so consumers inherit it via the package entry — don't re-add it to an app `tsconfig.include`.
- **Auth is the deliberate exception**: `authAPI` is called raw from `routes/auth/**`, `lib/auth/session.ts`, and `lib/auth/store.ts`. Session lifecycle (login/logout/identify/refresh) is imperative and not cache-driven — don't wrap it in query factories.

### Forms (dashboard)
- Use the shared `useAppForm` wrapper (`src/components/form`). Server errors: `handleError(error, { VALIDATION: (e) => setFormErrors(formApi, e.details), ... })`.
- Error codes the backend emits and the app handles: `VALIDATION`, `AUTH_CREDENTIALS`, `AUTH_EXPIRED`, `AUTH_INVALID_SESSION`, `AUTH_INVALID_RECOV_TOKEN`, `AUTH_RECOVERY_THROTTLED` (`details.retry_after` is an ISO date), `RESOURCE_NOT_FOUND`, `USER_EMAIL_CONFLICT`, `REQ_UNAUTHORIZED`, `RBAC_UNAUTHORIZED_PERM`.

### Backend contract (go-react-monorepo)
- Repo: https://github.com/prawirdani/go-react-monorepo. All API endpoints under `/api` (no version prefix).
- When the backend changes request/response shapes or error codes, sync `packages/api` + `packages/schemas` (and form call sites) — see README "Backend Compatibility".

## Gotchas

- **Dashboard uses 2-space indent; packages use tabs.** Biome configs differ per package — run biome from the package dir (`./node_modules/.bin/biome` if the root wrapper fails).
- Pre-existing `tsc` failure (not caused by feature work) — 1: `vite.config.ts` rejects an unknown `babel` option (`TS2353`). Route params are typed `FileRouteTypes["to"]` throughout; `keyof FileRoutesByFullPath` no longer type-checks against router links.
- `reset-password.tsx` loader marks the link invalid on *any* loader error (network/5xx included) — behavior worth revisiting but deliberate for now.
- Auth store lives in `src/lib/auth/store.ts` (zustand) and holds **session lifecycle only** (`status`); identity and permissions live in `getSession`. RBAC gatekeeper code is commented out there.
- Registration gating is **inverted from what the flag's name suggests**: `internal_mode: false` means a *public* deployment where self-registration is allowed; `true` means an internal deployment where signup is admin-only. That gate applies only to the **public self-signup route** (`routes/auth/register/index.tsx`, via `lib/health.ts`'s `usePublicRegistration`). `routes/auth/register/complete.tsx` is deliberately **not** gated — it serves admin invites, which an internal deployment still issues, and its token is the authorization. The client gate is presentation only — the backend owns enforcement.
- Adding a new `exports` subpath to a workspace package (`packages/*/package.json`) requires **restarting the dev server**. Vite caches the `exports` map, and a stale cache surfaces as an HTTP 500 on whichever module imports the new subpath — while `tsc` and `vite build` stay green, because a fresh process resolves it correctly. `pnpm dev` will fix it; don't chase the module itself.
- Reset-token GET (`/api/auth/password/recover/{token}`) is a one-time token; the TanStack Query cache can serve stale valid state if the URL is revisited after use.
- Biome suppression comments (`// biome-ignore …`) must sit on the line **directly above** the diagnostic. Letting the formatter expand an element to multiple lines — e.g. adding a second attribute that pushes it past the width limit — moves the diagnostic away from the comment, which then fails as *both* an unused suppression and the original rule. Don't build a pattern whose correctness depends on an element staying on one line: prefer removing the need for the rule (for skeleton rows, key off the row's own value rather than the map index) over suppressing it.
