import { cn } from "@repo/ui/lib/utils"
import type * as React from "react"

/**
 * The world's structural unit: a graphite panel separated from its neighbours
 * by a 1px hairline seam. Panels tile on a shared seam grid — no shadows,
 * no floating cards.
 */
export function PanelGrid({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="panel-grid"
      className={cn(
        "grid min-w-0 grid-cols-1 gap-px overflow-hidden rounded-md border border-border bg-border",
        className,
      )}
      {...props}
    />
  )
}

export function Panel({
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="panel"
      className={cn(
        "flex min-w-0 flex-col bg-card text-card-foreground",
        className,
      )}
      {...props}
    />
  )
}

export function PanelHeader({
  title,
  aside,
  className,
  children,
  ...props
}: React.ComponentProps<"header"> & {
  title?: React.ReactNode
  aside?: React.ReactNode
}) {
  return (
    <header
      data-slot="panel-header"
      className={cn(
        "flex h-9 shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-3",
        className,
      )}
      {...props}
    >
      {title ? <h2 className="panel-label truncate">{title}</h2> : children}
      {aside && (
        <div className="flex min-w-0 flex-wrap items-center gap-2">{aside}</div>
      )}
    </header>
  )
}

export function PanelBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="panel-body"
      className={cn("flex min-w-0 flex-1 flex-col", className)}
      {...props}
    />
  )
}

export function PanelNote({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="panel-note"
      className={cn(
        "px-3 py-2 font-mono text-xs text-muted-foreground",
        className,
      )}
      {...props}
    />
  )
}

export type Tone = "default" | "info" | "success" | "warning" | "destructive"

const valueTone: Record<Tone, string> = {
  default: "text-foreground",
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
}

const badgeTone: Record<Tone, string> = {
  default: "border-border text-muted-foreground",
  info: "border-info/40 text-info",
  success: "border-success/40 text-success",
  warning: "border-warning/40 text-warning",
  destructive: "border-destructive/40 text-destructive",
}

const dotTone: Record<Tone, string> = {
  default: "bg-muted-foreground",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
}

/** Rows of labelled, measured values. Sits flush against the panel seams. */
export function PanelRows({ className, ...props }: React.ComponentProps<"dl">) {
  return (
    <dl
      data-slot="panel-rows"
      className={cn("divide-y divide-border", className)}
      {...props}
    />
  )
}

export function PanelRow({
  label,
  value,
  tone = "default",
  mono = true,
  className,
}: {
  label: React.ReactNode
  value: React.ReactNode
  tone?: Tone
  /** Mono is for figures, IDs and measured data — never for prose. */
  mono?: boolean
  className?: string
}) {
  return (
    <div
      data-slot="panel-row"
      className={cn(
        "grid grid-cols-[1fr_auto] items-baseline gap-3 px-3 py-2",
        className,
      )}
    >
      <dt className="min-w-0 truncate text-sm text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "text-sm",
          mono && "font-mono tabular-nums",
          valueTone[tone],
        )}
      >
        {value}
      </dd>
    </div>
  )
}

/** State is the only place saturation is spent. */
export function StateBadge({
  tone = "default",
  children,
  className,
}: {
  tone?: Tone
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      data-slot="state-badge"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 font-mono text-[length:var(--text-label-size)] leading-4 whitespace-nowrap",
        badgeTone[tone],
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5", dotTone[tone])} />
      {children}
    </span>
  )
}
