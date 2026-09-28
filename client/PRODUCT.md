# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: a small product team (1–5 devs) scaffolding an internal business/admin tool — ops dashboards, CRMs, back-office consoles, data-entry apps. They are the ones who clone the repo, and they are often working alongside an AI coding agent that will extend the same UI.

Secondary: the operators and staff who use the resulting internal tool daily, for hours at a time, usually desktop-first with incidental mobile use.

## Product Purpose

An opinionated React monorepo starter that hands a team a running admin application on day one — authentication flows, form layer, API client, query layer, and a shared UI package — instead of a pile of choices. Success means a team ships their internal tool without ever feeling like they forked a tutorial, and without the default look reading as boilerplate.

## Positioning

Two things a neighboring starter does not ship together: an integrated cookie-auth + typed API + form + query stack that already works end to end, and a UI system with a committed visual identity driven entirely by one token block — so the default is distinctive rather than the stock component-library look every generated project converges on.

## Operating Context

- pnpm workspace with Turborepo; each app builds with Vite + React 19.
- `apps/dashboard` is the reference app: TanStack Router file routes under `src/routes/**`, TanStack Query for server state, zod for validation, zustand for the auth store.
- `packages/ui` holds all primitives (base-ui + shadcn conventions, Tailwind v4 css-first, tabler icons); `packages/api`, `packages/schemas`, `packages/queries`, `packages/utils`, `packages/config` are the supporting layers.
- Backend is `golang-restapi` at `https://github.com/prawirdani/golang-restapi`. Auth is httpOnly-cookie based; the error envelope is flat (`{ message, details, code }`) and JSON fields are snake_case.
- UI copy in the reference app is Indonesian. Real copy, not decoration — preserve it.
- Biome formats per package (2-space in the dashboard app, tabs in packages).
- Internal tools are scanned, not read: users return to the same screens repeatedly to check state and complete short tasks.

## Capabilities and Constraints

Shipped surfaces in the reference app: login, forgot-password, reset-password (one-time token), profile (update user, change password, profile picture), settings, and an example route; plus the app shell (sidebar with nested nav, header, breadcrumbs, theme toggle, toasts).

Confirmed constraints:

- **Token-swappable:** the entire visual world must live in CSS custom properties (plus font/token imports) so a cloned project can re-skin by editing one token block. Components may not hardcode palette, radius, or type values that the token block cannot reach.
- **Preserve behavior:** route tree, auth logic, form behavior, API contract, and error handling stay intact. Markup, layout, and composition inside screens are open.
- **Accessibility:** WCAG 2.1 AA — contrast, focus visibility, keyboard operation, reduced-motion, and semantics.
- **Backend contract:** no hardcoded URLs; snake_case payloads; flat error envelope with `parseAPIError`.

## Brand Commitments

No logo, palette, or typeface exists yet — `apps/dashboard/src/logo.svg` is a placeholder. The binding commitment is negative-to-positive: the default UI must not read as stock shadcn or as generic generated output. Distinctiveness of the shipped default is the point of this template.

## Evidence on Hand

- Real: Indonesian UI copy, working auth/profile/settings flows, the full primitive set in `packages/ui`.
- Synthetic scaffolding that must stay replacement-ready and must never harden into a claim: `apps/dashboard/src/routes/(app)/index.tsx` placeholder cards, the sidebar title `Dashboard 666`, the generic placeholder logo.
- Absent, and must not be fabricated: customers, testimonials, benchmarks, pricing, or any commercial claim.

## Product Principles

1. Operate before express: expression may never cost scanability, state clarity, or a familiar affordance.
2. One front door for the world: palette, type, radius, and depth resolve through tokens that a clone can swap in one place.
3. The default is the product: whoever clones this ships the shipped look unedited, so the shipped look must already be committed.
4. Behavior is not a styling surface: retheming never silently changes auth, data, or error semantics.
5. Dense where it earns it, quiet where it doesn't: repetition-heavy admin screens get rhythm and hierarchy, not decoration.

## Accessibility & Inclusion

WCAG 2.1 AA. Dark and light themes both ship and both must meet contrast requirements. Motion respects `prefers-reduced-motion`. Keyboard-only operation covers the shell, forms, dialogs, and menus.
