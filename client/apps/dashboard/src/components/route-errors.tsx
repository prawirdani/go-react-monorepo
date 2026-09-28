import { useTranslations } from "@repo/i18n"
import { AUDIT_SEARCH_DEFAULTS } from "@repo/schemas/audit"
import { Button } from "@repo/ui/components/button"
import { LockAccessOff, MoodPuzzled, ServerOff } from "@repo/ui/icons"
import { cn } from "@repo/ui/lib/utils"
import { Link } from "@tanstack/react-router"
import { StateBlock } from "@/components/state-block"

export function Forbidden({
  from,
  className,
  fullPage = false,
}: {
  from?: string
  className?: string
  fullPage?: boolean
}) {
  const t = useTranslations("app")

  return (
    <div
      className={cn(
        "grid place-items-center bg-background p-6",
        fullPage ? "min-h-svh" : "h-full",
        className,
      )}
    >
      <StateBlock
        alert
        icon={LockAccessOff}
        heading={t("errors.forbidden.heading")}
        message={t("errors.forbidden.message")}
        action={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link to="/" search={AUDIT_SEARCH_DEFAULTS} />}
          >
            {t("errors.forbidden.action")}
          </Button>
        }
      >
        {from && (
          <p className="min-w-0 truncate font-mono text-xs text-muted-foreground">
            <span aria-hidden="true" className="text-muted-foreground/60">
              ~
            </span>
            {from}
          </p>
        )}
      </StateBlock>
    </div>
  )
}

export function NotFound({ fullPage = true }: { fullPage?: boolean }) {
  const t = useTranslations("app")

  return (
    <div
      className={cn(
        "grid place-items-center bg-background p-6",
        fullPage ? "min-h-svh" : "h-full",
      )}
    >
      <StateBlock
        alert
        icon={MoodPuzzled}
        heading={t("errors.notFound.heading")}
        message={t("errors.notFound.message")}
        action={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link to="/" search={AUDIT_SEARCH_DEFAULTS} />}
          >
            {t("errors.notFound.action")}
          </Button>
        }
      />
    </div>
  )
}

export function InternalServerError({ error: _ }: { error: unknown }) {
  const t = useTranslations("app")

  return (
    <div className="grid min-h-svh place-items-center bg-background p-6">
      <StateBlock
        alert
        icon={ServerOff}
        heading={t("errors.server.heading")}
        message={t("errors.server.message")}
        action={
          <Button variant="outline" onClick={() => window.location.reload()}>
            {t("errors.server.action")}
          </Button>
        }
      />
    </div>
  )
}
