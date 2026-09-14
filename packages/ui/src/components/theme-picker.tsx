import { cn } from "@repo/ui/lib/utils"
import { useTheme } from "@repo/ui/providers/theme-provider"
import { DEFAULT_THEME, type ThemeId, themes } from "@repo/ui/themes"
import { IconCheck, IconMoon, IconSun } from "@tabler/icons-react"
import * as React from "react"
import { Button } from "./button"

type ThemeModeToggleProps = {
  className?: string
  /**
   * Opt in when the toggle sits inside a Base UI DropdownMenu, so the menu's
   * own key/pointer handling does not swallow the interaction. Escape is left
   * to bubble so the menu can still be dismissed.
   */
  containMenuEvents?: boolean
}

function resolveMode(mode: "dark" | "light" | "system"): "dark" | "light" {
  if (mode !== "system") return mode
  if (typeof window === "undefined") return "dark"
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

function containMenuKeys(event: React.KeyboardEvent) {
  if (event.key !== "Escape") event.stopPropagation()
}

function containMenuPointer(event: React.PointerEvent | React.MouseEvent) {
  event.stopPropagation()
}

/** The icon-swap mode toggle. Used directly in the header, and by the picker. */
export function ThemeModeToggle({
  className,
  containMenuEvents = false,
}: ThemeModeToggleProps) {
  const { mode, setMode } = useTheme()
  const resolvedMode = resolveMode(mode)

  const toggle = () => setMode(resolvedMode === "dark" ? "light" : "dark")

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn("w-full justify-start", className)}
      onKeyDown={containMenuEvents ? containMenuKeys : undefined}
      onPointerDown={containMenuEvents ? containMenuPointer : undefined}
      onClick={
        containMenuEvents
          ? (event) => {
              containMenuPointer(event)
              toggle()
            }
          : toggle
      }
    >
      <span aria-hidden="true" className="relative size-4 shrink-0">
        <IconSun className="absolute inset-0 size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
        <IconMoon className="absolute inset-0 size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      </span>
      {resolvedMode === "dark" ? "Mode Terang" : "Mode Gelap"}
    </Button>
  )
}

/**
 * Decorative palette preview. Carries the palette via `data-theme` and the
 * resolved mode via the `.dark` / `.light` class, then paints with ordinary
 * token utilities — no colour is duplicated in this file.
 */
function PaletteSwatch({ id, mode }: { id: ThemeId; mode: "dark" | "light" }) {
  return (
    <span
      aria-hidden="true"
      data-theme={id}
      className={cn(
        "pointer-events-none flex size-6 shrink-0 flex-col justify-end gap-px overflow-hidden rounded-sm border border-border bg-background p-0.5",
        mode,
      )}
    >
      <span className="h-2 w-full rounded-[1px] bg-card" />
      <span className="flex gap-px">
        <span className="h-2 flex-1 rounded-[1px] bg-primary" />
        <span className="h-2 flex-1 rounded-[1px] bg-muted-foreground" />
      </span>
    </span>
  )
}

/** Settings-only palette picker: mode toggle plus the visible palette list. */
export function ThemePicker({ className }: { className?: string }) {
  const { mode, theme, setTheme } = useTheme()
  const resolvedMode = resolveMode(mode)
  const selectedTheme = theme ?? DEFAULT_THEME
  const modeLabelId = React.useId()
  const themeLabelId = React.useId()

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-col gap-1.5">
        <span className="panel-label" id={modeLabelId}>
          Mode
        </span>
        <div role="group" aria-labelledby={modeLabelId}>
          <ThemeModeToggle className="w-full" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="panel-label" id={themeLabelId}>
          Tema
        </span>
        <div
          role="group"
          aria-labelledby={themeLabelId}
          className="flex flex-col gap-1"
        >
          {themes.map((option) => {
            const selected = option.id === selectedTheme
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setTheme(option.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left outline-none transition-colors duration-100 ease-console focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40",
                  selected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted",
                )}
              >
                <PaletteSwatch id={option.id} mode={resolvedMode} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium">{option.label}</span>
                  <span className="truncate text-muted-foreground text-xs">
                    {option.hint}
                  </span>
                </span>
                {selected && (
                  <IconCheck
                    aria-hidden="true"
                    className="ml-auto size-4 shrink-0 text-primary"
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
