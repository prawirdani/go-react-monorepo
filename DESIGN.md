---
name: Graphite Console
description: A dark-first internal-tool console shipping three palettes (Graphite, Ledger, Ember), each in light and dark, where depth comes from 1px hairline seams and measured ground steps, and colour is spent only on state.
colors:
  ground: "oklch(0.185 0.004 260)"
  panel: "oklch(0.215 0.004 260)"
  raised: "oklch(0.25 0.005 260)"
  rail: "oklch(0.145 0.004 260)"
  ink: "oklch(0.93 0.003 260)"
  ink-dim: "oklch(0.7 0.008 260)"
  seam: "oklch(1 0 0 / 12%)"
  field-edge: "oklch(0.56 0.006 260)"
  scrim: "oklch(0 0 0)"
  keyword-blue: "oklch(0.72 0.14 248)"
  keyword-ink: "oklch(0.16 0.02 250)"
  string-green: "oklch(0.76 0.15 155)"
  value-amber: "oklch(0.82 0.14 80)"
  error-red: "oklch(0.7 0.19 25)"
  comment-violet: "oklch(0.74 0.13 305)"
typography:
  title:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.14em"
  data:
    fontFamily: "Spline Sans Mono Variable, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "0.15rem"
  md: "0.2rem"
  lg: "0.25rem"
  xl: "0.35rem"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
components:
  button-primary:
    backgroundColor: "{colors.keyword-blue}"
    textColor: "{colors.keyword-ink}"
    rounded: "{rounded.md}"
    height: "2.25rem"
    padding: "0 0.625rem"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "2.25rem"
    padding: "0 0.625rem"
  input:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "2.25rem"
    padding: "0 0.625rem"
  panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  state-badge:
    backgroundColor: "transparent"
    textColor: "{colors.ink-dim}"
    rounded: "{rounded.sm}"
    padding: "0.125rem 0.375rem"
---

# Design System: Graphite Console

## Overview

**Creative North Star: "The Instrument Rack"**

An internal tool is equipment, not a brochure. The interface is built as a rack of bays: flat graphite modules bolted to a shared seam grid, each with a small-caps nameplate, each showing measured values. Nothing floats, nothing glows, nothing is decorated. What a border does here is structural — a 1px seam is the edge of a bay, and a lighter graphite step is one more unit of elevation.

The system is dark-first because that is the working condition it was chosen for: a console that sits open all day beside an editor, read for state at a glance rather than savoured. Its light mode is the same rack under daylight — a cool engineering surface, never cream — with the same seams and the same restraint.

The rack ships in three palettes. **Graphite** is the canonical one described throughout this document. **Ledger** re-clothes it as cool paper with ink rules and soft corners; **Ember** warms it to near-black steel with an ember accent. What changes between them is palette, typeface, and corner radius — and nothing else. The seams, the elevation order, the state vocabulary, and the mono-for-data rule are the world's constants. See **Themes**.

Colour is the system's most disciplined decision. Saturation is reserved exclusively for state, and it is drawn from the colours a developer already reads fluently in syntax: keyword blue, string green, value amber, error red, comment violet. A user learns the vocabulary once, in code, and it carries into the interface. The primary accent appears on a single control per view; everything else earns its colour by meaning something.

**Key Characteristics:**

- Depth from 1px hairline seams and three measured ground steps — never from shadow
- Saturation spent only on state, using syntax-derived semantics
- Hard, instrument-panel geometry; corner radius is a per-palette decision (0.25 / 0.5 / 0.375rem)
- Monospace reserved for figures, IDs, and measurement — never as a technical costume
- Panel headers as tracked small caps; body in a compact grotesk
- Three palettes — Graphite, Ledger, Ember — each shipping light and dark; only palette, typeface, and radius vary

## Colors

A graphite ladder with a faint cool cast, interrupted only by five syntax-derived state inks. The values below are **Graphite's**; Ledger and Ember define their own equivalents under the same token names, keeping the same state vocabulary and the same AA guarantees. See **Themes** for the per-palette values.

### Primary

- **Keyword Blue** (oklch(0.72 0.14 248)): The single accent. The default/filled button, the active nav row, the focus ring, and links. In light theme it darkens to (oklch(0.5 0.16 252)) so white text clears AA.

### Neutral

- **Rail Graphite** (oklch(0.145 0.004 260)): The sidebar — one step deeper than the ground, so the shell recedes.
- **Ground Graphite** (oklch(0.185 0.004 260)): The working surface behind every panel.
- **Panel Graphite** (oklch(0.215 0.004 260)): The panel surface itself — one measured step above ground.
- **Raised Graphite** (oklch(0.25 0.005 260)): Floating surfaces (dialogs, popovers, menus, tooltips) — the third and final step.
- **Specimen Ink** (oklch(0.93 0.003 260)): Body and heading text.
- **Dim Ink** (oklch(0.7 0.008 260)): Labels, secondary text, small-caps nameplates. Verified at 6.98:1 on ground in dark and 5.99:1 in light.
- **Hairline Seam** (oklch(1 0 0 / 12%)): Decorative panel dividers. Deliberately low-contrast — it is texture, not a control boundary.
- **Field Edge** (oklch(0.56 0.006 260)): The only border that must be *found*. Opaque, solved to 3.24:1 / 3.05:1 against ground and panel in dark, and well above that in light, so every input, select, textarea, and combobox boundary meets WCAG 1.4.11.

**Ladder depth.** The neutral rungs sit close together: `--muted` is only ≈0.05 L from `--card` in every palette and both modes. Any neutral treatment — banding, hover, an expanded wash — therefore has to be *budgeted* inside that shallow span rather than picked freely. The measured range from the faintest usable stripe (≈0.011 L) to the hover weight (≈0.028 L) is the entire budget.

### Secondary

- **String Green** (oklch(0.76 0.15 155)): Success and healthy state only.
- **Value Amber** (oklch(0.82 0.14 80)): Warning and degraded state only.
- **Error Red** (oklch(0.7 0.19 25)): Destructive and failure state only.
- **Comment Violet** (oklch(0.74 0.13 305)): Attention and auxiliary state only.

### Named Rules

**The State-Only Rule.** Saturation exists to mean something. A colour that does not encode state does not appear. If a screen needs emphasis and has no state to report, the answer is weight, scale, or a seam — not hue.

**The One Accent Rule.** The primary accent fills at most one control per view region. Its scarcity is what makes the primary action unambiguous.

**The Banding Rule.** Alternating row or record banding is a reading aid, never a signal: it is drawn from the neutral family (`--muted`), never a state hue, and must sit strictly below the hover and expanded weights so those still read as the stronger states. Banding is spent from the shallow neutral budget described under **Neutral**, so a stripe cannot be made arbitrarily heavier by raising its alpha — see **Elevation & Depth** for how a single alpha lands differently on each surface.

## Typography

Each palette carries its own typeface pair. The pair switches through `--font-ui` / `--font-mono`, which `font-sans` / `font-mono` resolve against — never by editing a component.

| Palette | UI | Data |
|---|---|---|
| **Graphite** | Archivo Variable (`@fontsource-variable/archivo`) | Spline Sans Mono Variable (`@fontsource-variable/spline-sans-mono`) |
| **Ledger** | Libre Franklin Variable (`@fontsource-variable/libre-franklin`) | Azeret Mono Variable (`@fontsource-variable/azeret-mono`) |
| **Ember** | Chivo Variable (`@fontsource-variable/chivo`) | Chivo Mono Variable (`@fontsource-variable/chivo-mono`) |

**Character:** Technical workhorse pairings, deliberately under-expressive — the system's character comes from geometry and restraint, not letterform personality. Graphite is the compact industrial default; Ledger's Franklin carries real small caps and tabular figures (a bookkeeping workhorse, deliberately not a serif); Ember's Chivo superfamily gives the warm palette one coherent voice. All are self-hosted via `@fontsource-variable`, and each family is fetched only when its palette is actually applied.

### Hierarchy

- **Title** (600, 1.125rem → 1.25rem at `md`, `-0.025em`): Page titles only. One per screen, sitting flush over a seam.
- **Body** (400, 0.875rem): All UI text, form labels, table cells, prose.
- **Label** (600, 0.6875rem, `0.14em`, uppercase): Every panel nameplate, table column head, and section marker — and the per-field labels of the small-screen record view, where a table's column heads move inline — all via the single `.panel-label` class.
- **Data** (400, 0.875rem mono, `tabular-nums`): Figures, timestamps, IDs, paths. Applied by opting a cell in with `data-mono`, not by defaulting a container to mono.

### Named Rules

**The Mono-Means-Data Rule.** Monospace is applied to figures, identifiers, timestamps, and measured values — and to nothing else. Prose in a monospace face is a costume, and this system does not wear it. In the table primitive this is enforced structurally: cells are sans by default and opt in with `data-mono`.

**The One Label Rule.** There is exactly one small-caps label treatment. It lives in `.panel-label` and consumes `--text-label-size` / `--tracking-label`; primitives consume the same tokens. Two label treatments is a bug.

## Layout

The spatial model is a **seam grid**. Panels sit edge to edge inside a `PanelGrid` whose container is itself the seam colour, with a 1px `gap` — so the seams between bays are the container showing through, never a border drawn on each panel. This keeps a tiled surface perfectly aligned at any panel count and means a new panel needs no border of its own.

Panels declare responsive priority and collapse to a single stack on narrow screens; the desktop arrangement is intentionally asymmetric (7/5 then 5/7 on a 12-column grid) so the surface reads as a working arrangement rather than a marketing grid of equal tiles.

Density is tight and deliberately uneven: container padding is `0.75rem` rising to `1.25rem` at `md`; row rhythm is `0.5rem` vertical within a panel; panel headers are a fixed `2.25rem` strip — except the **control-bearing variant**, where a header carries controls rather than only a nameplate: that resolves to `h-auto py-2` and measures 49px, rising to 70px and 110px as its toolbar wraps to two and three rows; page headers carry a seam beneath and `0.75rem` of breathing room. Page descriptions cap at `70ch`.

## Elevation & Depth

**This system has no shadows.** Depth is conveyed by exactly two means: three measured graphite ground steps (ground → panel → raised) and 1px hairline seams. A panel is one step above the ground; a floating surface is two. Nothing is ever lifted with a shadow, and no scrim, gradient, or blur substitutes for a step.

Because there is no shadow vocabulary, elevation is a strict ordering rather than a set of tricks: `ground < panel < raised`. A surface that needs to read as higher must take the next step up, and there is no fourth step.

### Named Rules

**The No-Shadow Rule.** If an element looks like it needs a shadow to separate from its background, the ground step is wrong. Fix the step, not the shadow. Zero-offset halos and offset drop shadows are both decoration here.

**The One Step Rule.** A surface takes one step of elevation, never two. Nested elevation is how card-inside-card layouts happen; panels contain seams and content, not lifted panels.

**The Fill-Free Block Rule.** A detail block that may sit on either a panel or a banded record — the audit payload is the reference case — carries no fill of its own: a fill that reads correctly on one surface inverts on the other, because `--card` under a dark band is recessed while under a light band it is raised, and raised is card-inside-card. Its division therefore comes from **borders between its own children** (`divide-y`), never from a container fill. That distinction is load-bearing: a `gap-px` container painted `bg-border` is a *fill*, and it only reads as seams while every child is opaque. Pair a transparent child with it and the whole block collapses into one solid plate.

**The Compound Rule.** An alpha tint is not a fixed value; it composites over whatever lies behind it. One `bg-muted/N` therefore yields a different delta per surface — measured ≈0.016 L directly on card, but ≈0.011 L over a parent already tinted at `--muted/30`. A shared list mounted on surfaces of differing tint (the session list mounts on card, inside a banded record, and inside an expanded wash) cannot carry a single band weight; when you pick one, say which surface it was chosen for. **Accepted exception:** where a banded list sits on an expanded surface, the stripe composites to ≈0.028 L — the hover weight. The Banding Rule's ordering therefore holds everywhere *except* on an expanded surface, where band and hover converge by design: expansion feedback is a functional signal, and the wash it composites over is already a deliberate state.

## Shapes

Hard instrument geometry, with the corner sharpened or softened per palette. The radius is a single `--radius` token; `sm` / `md` / `lg` derive from it (`× 0.6 / × 0.8 / × 1`) and everything above `lg` is capped at `× 1.4`, so no container can round into a pill.

| Palette | `--radius` | `sm` / `md` / `lg` | Feel |
|---|---|---|---|
| **Graphite** | `0.25rem` | 0.15 / 0.2 / 0.25rem | Hard, instrument-panel |
| **Ledger** | `0.5rem` | 0.3 / 0.4 / 0.5rem | Soft, paper-like |
| **Ember** | `0.375rem` | 0.225 / 0.3 / 0.375rem | Softer than Graphite, warmer |

Buttons, inputs, panels, badges, and menus sit in the `sm`–`md` band in every palette.

Two round exceptions exist in all three palettes, because they are physical affordances rather than containers: the switch track and the avatar. Everything else is a rectangle with a seam.

Borders come in exactly two weights of meaning: **seams** (decorative dividers, on `--border`) and **control boundaries** (discoverable edges, on `--input`, opaque and contrast-solved). Confusing the two is the most common way to break this system.

## Components

### Buttons

- **Shape:** hard-edged rectangle, `rounded-md` (0.2rem), height `2.25rem` at default size.
- **Primary:** filled Keyword Blue with dark ink. One per view region.
- **Outline / Secondary / Ghost:** structural variants; outline carries the opaque control boundary, ghost is background-only.
- **Destructive:** quiet by doctrine — `border-destructive/40` with transparent fill and red text. It does not become a solid red button at rest; it only gains focus weight. Place it apart from its neighbours so it cannot be hit by accident.
- **Hover / Focus / Active:** 100ms transition on background/border/colour; focus is a 2px ring at `ring-ring/40` plus a border shift to the accent; press translates 1px down.

### Chips

- **Style:** `StateBadge` — `rounded-sm`, hairline border tinted at 40% of the state hue, transparent fill, mono 11px label, and a `0.375rem` state dot.
- **State:** tone is the only variable (`default`, `info`, `success`, `warning`, `destructive`). The dot carries the hue so the text stays legible; the badge never becomes a solid colour block.
- **Which chip:** `StateBadge` is for values that *mean* a state, and is what the reference app uses. The package also ships a generic `Badge` (variants `default`, `secondary`, `destructive`, `outline`, `ghost`, `link`) for non-semantic tags — counts, categories, versions. Use `StateBadge` when the value is state; use `Badge` when it is a label. Both draw their type size from the same label token, and there is no third chip.

### Cards / Containers

- **Corner Style:** `rounded-md` (0.2rem).
- **Background:** Panel Graphite on Ground Graphite; Raised Graphite for floating surfaces.
- **Shadow Strategy:** none — see Elevation & Depth.
- **Border:** none on the panel itself. The seam belongs to the `PanelGrid` container, which is the seam colour with a 1px gap. Panel headers carry a `border-b` seam; stacked rows use `divide-y`.
- **Internal Padding:** `0.75rem` horizontal on panel headers and rows; `PanelHeader` is a fixed `2.25rem` strip, taller for the control-bearing variant (see **Layout**).

### Inputs / Fields

- **Style:** `rounded-md`, `0.875rem` text, opaque Field Edge border, fill one notch lighter than the surface (`bg-muted/40`).
- **Focus:** border shifts to the accent plus a 2px accent ring at 40%.
- **Error / Disabled:** invalid shifts the border to Error Red with a red ring at 25%; disabled drops to 50% opacity with pointer events off.

### Navigation

The sidebar is a permanent rail one step deeper than the ground, closed by a seam. Rows are square, full-bleed, and hand-built rather than primitive-styled: active state is a 10% accent wash with accent text, driven by `aria-current`. Nested items hang from a 1px hairline connector, which is the seam language applied to hierarchy. Group markers use the single small-caps label treatment. Collapsing to the icon rail shrinks the typographic lockup to a mark plate.

### Theme picker

Palette selection lives on the Settings page, not in the header — switching palettes is rare, while flipping mode is frequent, so the header keeps the frequent control and drops the rare one. Two pieces expose the system: **`ThemeModeToggle`**, a single ghost button that flips light ⇄ dark from the *resolved* mode (so a stored `system` still toggles correctly) and the only theme control in the avatar dropdown; and **`ThemePicker`**, the Settings-only surface that pairs that toggle with a visible palette list — rows of swatch, label, and hint, with the selected row checked.

Mode and palette are independent axes: every palette ships both a light and a dark rendition, and both persist (`vite-ui-theme`, `vite-ui-theme-palette`). `system` remains the stored default for a first-time visitor; it is simply not selectable from the toggle.

The swatch is painted entirely from tokens: it carries `data-theme` plus the current mode class, so it previews each palette in the mode you are currently in. The per-palette token blocks stay self-contained, fonts included, which is what makes that possible.

## Do's and Don'ts

### Do:

- **Do** separate surfaces with a 1px seam and the next graphite step; build seams into the grid container with `gap-px`, not onto each panel. A `gap-px` container must be painted with the seam colour **and** every child must be opaque — otherwise the "seams" turn into one solid plate.
- **Do** spend colour only on state, drawing from the syntax vocabulary (blue keyword, green string, amber value, red error, violet comment).
- **Do** use `.panel-label` for every nameplate and column head; it is the one small-caps treatment.
- **Do** opt figures, IDs, and timestamps into mono with `data-mono`, and add `tabular-nums` where columns must align.
- **Do** keep the control boundary (`--input`) opaque and distinct from the decorative seam (`--border`) — one must be found, the other must not compete.
- **Do** isolate destructive actions and leave them quiet until focused.
- **Do** resolve every colour, radius, and font through the token blocks in `packages/ui/src/globals.css`; a clone must be able to re-skin the world by editing that one file.
- **Do** add a palette by writing exactly two token blocks (`[data-theme="x"].dark` and `.light`) plus one entry in `packages/ui/src/themes.ts` — nothing else. A new `exports` subpath needs a dev-server restart before the app can resolve it.

### Don't:

- **Don't** add a shadow, gradient, or decorative blur. There is no shadow vocabulary; fix the ground step instead.
- **Don't** invent a radius outside the palette's `--radius` scale, and don't round a container into a pill — the cap is `--radius × 1.4` by construction.
- **Don't** let a palette change the seam grammar, the elevation order, the state vocabulary, or the mono-for-data rule. A palette varies colour, typeface, and radius only.
- **Don't** use monospace for prose, labels, or decorative "technical" flavour.
- **Don't** tint a large surface with a state colour; state lives in dots, borders, and text, not in panels.
- **Don't** nest lifted surfaces — one step of elevation per surface, and no card inside a card.
- **Don't** add a second small-caps label treatment or a second state-chip implementation; extend the existing one.
- **Don't** reintroduce a same-size card grid as a page structure — panels are asymmetric and priority-ordered.

## Themes

Three palettes, each in light and dark, all behind identical token names. A theme is a complete token block per mode; no component knows which one is active.

**Selector contract.** `<html>` carries two independent attributes: a **mode class** (`.dark` / `.light`, set by the provider and by the pre-hydration script) and **`data-theme="<id>"`**. The mode class also carries the Graphite fallback via `:root`, so a missing or unknown palette id degrades safely to Graphite in either mode instead of rendering unstyled — which is why the inline script applies the stored id verbatim, with no whitelist.

| Palette | `data-theme` | Primary mode | Typeface | `--radius` | Accent hue |
|---|---|---|---|---|---|
| **Graphite** | `graphite` | dark | Archivo · Spline Sans Mono | `0.25rem` | 248 (cool blue) |
| **Ledger** | `ledger` | light | Libre Franklin · Azeret Mono | `0.5rem` | 255 (ink blue) |
| **Ember** | `ember` | dark | Chivo · Chivo Mono | `0.375rem` | 58 (ember) |

Each palette defines both modes regardless of which one is primary; "primary mode" only names the rendition the palette was designed around. Ledger's light is its natural state, and its dark is the same ledger under a dim lamp.

**Specificity.** Themed selectors are `[data-theme="x"].dark` / `.light` at `(0,2,0)`, which beats a bare mode class at `(0,1,0)`. That is exactly what lets a nested element carry its own `data-theme` plus mode class and resolve its own palette while the host runs a different one.

**State hue separation.** Primary, warning, and destructive must remain mutually distinguishable. Graphite and Ledger separate them by more than 130°; Ember, whose accent is orange, sits at 40° from warning and 40° from destructive — the tightest margin in the system. If Ember's accent moves, re-check both gaps.

### Named Rules

**The Self-Contained Palette Rule.** Every palette+mode block re-specifies every themeable token. A block that silently inherits a colour from another palette is a bug: it breaks nested previews and any future `data-theme` scoping. `--ease-console`, `--text-label-size`, and `--tracking-label` are deliberately global and inherited.

**The Two-Axis Rule.** Mode and palette are independent. No palette is "the dark one" or "the light one" — every palette ships both, so a new palette defines two blocks, never one.
