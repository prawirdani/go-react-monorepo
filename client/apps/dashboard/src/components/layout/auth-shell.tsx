import { useTranslations } from "@repo/i18n"
import { cn } from "@repo/ui/lib/utils"
import type { ReactNode } from "react"
import { BrandLockup } from "@/components/layout/brand"
import { Panel, PanelBody, StateBadge } from "@/components/layout/panel"

/**
 * Auth is one focused panel standing on the same graphite ground as the
 * console — a quiet orientation rail on the left, the panel centred on the
 * work surface.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const t = useTranslations("app")
  const isProduction = import.meta.env.PROD

  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-[minmax(0,20rem)_1fr] xl:grid-cols-[minmax(0,24rem)_1fr]">
      <aside className="hidden flex-col justify-between border-r border-border bg-sidebar p-6 lg:flex">
        <BrandLockup />

        <div className="flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-sidebar-foreground/80">
            {t("auth.rail.intro")}
          </p>
          <ul className="flex list-disc flex-col gap-2 pl-4 text-xs text-muted-foreground marker:text-muted-foreground/50">
            <li>{t("auth.rail.access1")}</li>
            <li>{t("auth.rail.access2")}</li>
          </ul>
          <p className="text-xs text-muted-foreground">
            {t("auth.rail.contact")}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-sidebar-border pt-3">
          <p className="panel-label">{t("auth.rail.environment")}</p>
          <StateBadge>
            {isProduction
              ? t("auth.rail.environmentProd")
              : t("auth.rail.environmentDev")}
          </StateBadge>
        </div>
      </aside>
      <main className="flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  )
}

/**
 * The panel is the page for auth screens, so its header carries the h1.
 * Standalone card: it owns its seam and card radius, unlike the square panels
 * tiled inside a PanelGrid.
 */
export function AuthPanel({
  title,
  description,
  aside,
  className,
  children,
}: {
  title: string
  description?: string
  aside?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <Panel
      className={cn(
        "animate-panel-in overflow-hidden rounded-md border border-border",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="mt-1 max-w-[46ch] text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </header>
      <PanelBody className="p-4">{children}</PanelBody>
    </Panel>
  )
}
