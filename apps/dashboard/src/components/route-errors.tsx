import { useTranslations } from "@repo/i18n"
import { Button } from "@repo/ui/components/button"
import { MoodPuzzled, ServerOff } from "@repo/ui/icons"
import { cn } from "@repo/ui/lib/utils"
import { Link } from "@tanstack/react-router"

export function NotFound({ fullPage = true }: { fullPage?: boolean }) {
  const t = useTranslations("app")

  return (
    <div
      className={cn(
        "grid place-items-center bg-background p-6",
        fullPage ? "min-h-svh" : "h-full",
      )}
    >
      <div
        role="alert"
        className="flex w-full max-w-xs flex-col items-center gap-4 text-center"
      >
        <MoodPuzzled
          className="size-9 text-muted-foreground"
          strokeWidth={1.5}
        />
        <h1 className="panel-label">{t("errors.notFound.heading")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("errors.notFound.message")}
        </p>
        <Button variant="outline" nativeButton={false} render={<Link to="/" />}>
          {t("errors.notFound.action")}
        </Button>
      </div>
    </div>
  )
}

export function InternalServerError({ error: _ }: { error: unknown }) {
  const t = useTranslations("app")

  return (
    <div className="grid min-h-svh place-items-center bg-background p-6">
      <div
        role="alert"
        className="flex w-full max-w-xs flex-col items-center gap-4 text-center"
      >
        <ServerOff className="size-9 text-muted-foreground" strokeWidth={1.5} />
        <h1 className="panel-label">{t("errors.server.heading")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("errors.server.message")}
        </p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          {t("errors.server.action")}
        </Button>
      </div>
    </div>
  )
}
