import type { TablerIcon } from "@repo/ui/icons"
import { cn } from "@repo/ui/lib/utils"
import type { ReactNode } from "react"

type StateBlockTone = "neutral" | "destructive"

interface StateBlockProps {
  icon: TablerIcon
  message: string
  heading?: string
  tone?: StateBlockTone
  /**
   * Force the `role="alert"` announcement. Defaults to the error tone. The
   * full-page route errors are error states whose illustration is deliberately
   * neutral, so they opt back in explicitly rather than turning red.
   */
  alert?: boolean
  action?: ReactNode
  children?: ReactNode
  className?: string
}

/**
 * The app's one state-block anatomy: a centred column, a `size-9` icon at
 * `strokeWidth={1.5}`, an optional `.panel-label` heading, a muted message, and
 * an optional action.
 *
 * Fill-free by design — the container decides the surface (Fill-Free Block
 * Rule). Neutral by default: only the error tone spends saturation, because
 * only error is a state (State-Only Rule).
 */
export function StateBlock({
  icon: Icon,
  message,
  heading,
  tone = "neutral",
  alert,
  action,
  children,
  className,
}: StateBlockProps) {
  const destructive = tone === "destructive"

  return (
    <div
      role={(alert ?? destructive) ? "alert" : undefined}
      className={cn(
        "flex w-full flex-col items-center gap-4 text-center",
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "size-9",
          destructive ? "text-destructive" : "text-muted-foreground",
        )}
        strokeWidth={1.5}
      />
      {heading && <h1 className="panel-label">{heading}</h1>}
      <p
        className={cn(
          "text-sm",
          destructive ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {message}
      </p>
      {children}
      {action}
    </div>
  )
}
