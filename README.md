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
- **Theming:** CSS custom-property tokens in `@repo/ui/globals.css` — three palettes × light/dark, switched at runtime
- **i18n:** use-intl v4 (`@repo/i18n`) — Bahasa Indonesia + English with compile-time-checked keys
- **Fonts:** self-hosted variable fonts via `@fontsource-variable` (one UI + one mono face per palette)
- **Linting/formatting:** Biome (per-package configs)

## Structure

```
apps/
  dashboard/          # Vite + React app (the only app)
    src/
      components/     # shared UI + form components
      hooks/          # useErrorHandler etc.
      lib/api.ts      # APIClient + typed API instances + imageUrl
      lib/i18n.ts     # typed catalog accessors (MessageKeys / Translator)
      routes/         # TanStack Router file routes (login, (app), auth/...)
      stores/         # zustand auth store
packages/
  api/                # @repo/api      fetch wrapper + AuthAPI/UserAPI + error types
  config/             # @repo/config   shared tsconfig/biome configs
  i18n/               # @repo/i18n     locales, typed catalogs, I18nProvider, check:messages
  queries/            # @repo/queries  TanStack Query queryOptions wrappers
  schemas/            # @repo/schemas  zod schemas + TS types (request/response)
  ui/                 # @repo/ui       design tokens, shared components, icons, providers
  utils/              # @repo/utils    helpers (date, strings, ...)
```

Alongside the workspace, three documents carry durable context — read `PRODUCT.md` and `DESIGN.md` before changing product behaviour or UI:

```
PRODUCT.md            # product truth: audience, purpose, constraints, principles
DESIGN.md             # the visual system: tokens, named rules, per-component specs
.impeccable/          # design-token sidecar for tooling
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
pnpm build          # turbo run build (runs check:messages first)
pnpm dev            # turbo run dev
pnpm lint           # biome lint
pnpm format         # biome format
pnpm check:write    # biome check --write
pnpm check:messages # validate catalogs: ICU syntax + locale key parity
pnpm audit:messages # report catalog smells: unused / duplicate / untranslated keys
```

## Authentication & Session Model

The template is built around a **cookie-based** auth flow — no tokens are stored in `localStorage`:

- Login/refresh set `httpOnly` cookies (`access_token`, `refresh_token`).
- `APIClient` always sends `credentials: "include"` and transparently refreshes on `401` (single-flight, retries once).
- A refresh failure marks the session expired and redirects to `/auth/login`.
- Auth session lifecycle lives in `apps/dashboard/src/lib/auth/store.ts` (zustand, `status` only); identity and permissions live in `getSession` (`authQueries`) and `/auth/me` populates the current user.

### Registration

Signup is a two-step, email-driven flow gated by a **deployment flag** rather than build-time config:

1. `POST /api/auth/register` with `{ name, email }` → the backend emails a link.
2. That link opens `/auth/register/complete?token=…`, where the user chooses a password.

The gate comes from the health probe (`GET /api/healthz` → `{ internal_mode, status }`):

| `internal_mode` | Deployment | UI |
| --- | --- | --- |
| `false` | Public — self-registration is open | Register link and both forms render |
| `true` | Internal — signup is admin-only | The surface is hidden and both routes redirect to `/auth/login` |

**Mind the polarity: `false` means public.** The gate is also **presentation only** — the backend must reject `POST /api/auth/register` when `internal_mode` is `true`, since the client can only hide the affordance. It fails closed: a pending or failed health probe hides the surface. See `apps/dashboard/src/lib/health.ts`.

The completion route validates its token exactly the way `reset-password` does — `expires_at` and `used_at`, with any loader error (network or 5xx included) counting as invalid.

## Design System

The UI is one committed visual world — **Graphite Console** — not stock component-library defaults. Depth comes from 1px hairline seams and three measured ground steps instead of shadow; saturation is spent only on state; monospace is reserved for data. `DESIGN.md` is the full rulebook (north star, named rules, component specs) — read it before adding UI.

**Tokens are the front door.** Every colour, radius, and font resolves through `packages/ui/src/globals.css`, so a clone re-skins the world by editing that one file.

**Three palettes, each with a light and a dark rendition:**

| Palette | `data-theme` | Typeface (UI · mono) | `--radius` | Primary mode |
| --- | --- | --- | --- | --- |
| Graphite | `graphite` | Archivo · Spline Sans Mono | `0.25rem` | dark |
| Ledger | `ledger` | Libre Franklin · Azeret Mono | `0.5rem` | light |
| Ember | `ember` | Chivo · Chivo Mono | `0.375rem` | dark |

**Selector contract.** `<html>` carries two independent attributes: a mode class (`.dark` / `.light`) and `data-theme="<id>"`. Themed blocks are written `[data-theme="x"].dark` / `.light` — specificity `(0,2,0)`, so they beat the bare mode class. An unknown or absent id degrades to Graphite, which is why the pre-hydration script in `index.html` applies the stored id verbatim with no whitelist.

**Switching.** Mode lives in the header avatar dropdown (`ThemeModeToggle`); the palette list lives in **Settings → Tampilan** (`ThemePicker`, with swatches and hints). Persisted to `vite-ui-theme` and `vite-ui-theme-palette`.

**Adding a palette:** write exactly two token blocks (`[data-theme="x"].dark` and `.light`) plus one entry in `packages/ui/src/themes.ts`. Each block must re-specify **every** themeable token — a block that inherits a colour breaks nested previews. Only `--ease-console`, `--text-label-size`, and `--tracking-label` are global.

Contrast is verified to WCAG AA across all six palette × mode combinations. Decorative seams are deliberately low-contrast and exempt from 1.4.11; the control boundary (`--input`) is not.

## Internationalization

Two locales ship: **`id` (default)** and **`en`**. Switch in **Settings → Tampilan** (`LocaleSwitcher`), persisted to `vite-ui-locale`, with `<html lang>` kept in sync — including pre-hydration, so there is no flash.

**Catalogs** live in `packages/i18n/src/messages/<locale>/<namespace>.ts`, namespaced `common`, `validation`, `ui`, and `app`. `en` is the source of truth (`as const`) and each `id` catalog is typed from it, so **a missing or misspelled Indonesian key is a compile error**.

```tsx
import { useTranslations, useFormatter } from "@repo/i18n"

const t = useTranslations("app")
t("nav.dashboard")            // keys are compile-checked
const format = useFormatter() // locale-aware Intl numbers/dates
```

For non-React code (stores, toast helpers) use `getTranslator(locale)`.

When a key is only known at runtime, use the exported accessors rather than re-deriving them from the hook's return type:

```ts
import type { MessageKeys, Translator } from "@repo/i18n"

const CODE_MESSAGES: Partial<Record<ErrorCode, MessageKeys<"app">>> = { … } // leaf-key union for a namespace
const buildOptions = (tc: Translator<"common">) => …                        // a namespace-bound translator
```

`MessageKeys<N>` is the union of leaf keys in namespace `N` (objects never qualify), and `Translator<N>` is the translator bound to `N`.

**Guard:** `pnpm check:messages` validates ICU syntax for every message and asserts identical key sets across locales. Vite has no build-time ICU validation — a malformed plural silently renders the key path at runtime — so this is the only guard. It is wired into the pipeline (`build` depends on it), so a malformed plural or a one-sided key fails the build instead of shipping.

**Hygiene:** `pnpm audit:messages` reports what shouldn't fail a build — keys nothing references, text duplicated across keys, and strings identical in every locale. It scans `packages/schemas` too, because validation keys are emitted from there; an app-only scan would report every `validation.*` key as dead. Run it when adding or removing screens.

**Validation messages are keys, not copy.** `packages/schemas` emits `validation.*` keys (a locale-agnostic global error map keys generic zod issues too), and the UI resolves them at the display layer:

```ts
t.has(value) ? t(value) : value   // known keys translate; raw server text passes through
```

The same discriminator keeps untranslatable backend messages from breaking: error **codes** are mapped to catalog keys for toasts, so raw server text is never shown to a user.

**Adding a locale:** add `<locale>/{app,common,ui,validation}.ts` typed from `en`, register it in `packages/i18n/src/config.ts` (`LOCALES`), and add it to the pre-hydration list in `apps/dashboard/index.html`.

**Known constraint — keep message leaves free of ICU arguments and tags.** Several call sites type a runtime key as `MessageKeys<"app">` and pass it to `t()` with a single argument; a message that requires `values` makes every one of those calls a type error. Compose multi-part sentences in the template instead. A `// NOTE:` at the top of `en/app.ts` records this.

The catalogs and types are platform-independent; `I18nProvider` is web-only (it reads `localStorage` and sets `<html lang>`), so a non-web app supplies its own provider and reuses everything else.

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
- **Pre-existing `tsc` failure** (not caused by feature work) — 1: `vite.config.ts` rejects an unknown `babel` option.
