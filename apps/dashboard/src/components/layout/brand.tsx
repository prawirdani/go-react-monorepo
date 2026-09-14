import { useTranslations } from "@repo/i18n"
import { cn } from "@repo/ui/lib/utils"

/**
 * Typographic brand lockup — no logo file. A mono mark plate plus a tracked
 * small-caps wordmark. `compact` drops the wordmark for the icon rail.
 */
export function BrandLockup({
  compact = false,
  className,
}: {
  compact?: boolean
  className?: string
}) {
  const t = useTranslations("app")

  if (compact) {
    return (
      <span
        role="img"
        aria-label={t("brand.name")}
        className={cn(
          "grid size-7 place-items-center rounded-sm border border-sidebar-border bg-background font-mono text-xs font-semibold text-primary select-none",
          className,
        )}
      >
        K
      </span>
    )
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <span
        aria-hidden="true"
        className="grid size-7 shrink-0 place-items-center rounded-sm border border-sidebar-border bg-background font-mono text-xs font-semibold text-primary select-none"
      >
        K
      </span>
      <span className="min-w-0 leading-none">
        <span className="panel-label block text-sidebar-foreground">
          {t("brand.name")}
        </span>
        <span className="mt-1 block truncate font-mono text-xs text-muted-foreground">
          {t("brand.subtitle")}
        </span>
      </span>
    </div>
  )
}
