import { useTranslations } from "@repo/i18n"
import { LocaleSwitcher } from "@repo/ui/components/locale-switcher"
import { ThemePicker } from "@repo/ui/components/theme-picker"
import { createFileRoute } from "@tanstack/react-router"
import { Page } from "@/components/layout/page"
import {
  Panel,
  PanelBody,
  PanelGrid,
  PanelHeader,
} from "@/components/layout/panel"

export const Route = createFileRoute("/(app)/settings/")({
  component: RouteComponent,
})

function RouteComponent() {
  const t = useTranslations("app")

  return (
    <Page title={t("settings.title")} description={t("settings.description")}>
      <PanelGrid>
        <Panel className="animate-panel-in">
          <PanelHeader title={t("settings.appearance.panel")} />
          <PanelBody className="flex-1">
            <div className="flex flex-col gap-4 px-3 py-3">
              <div className="min-w-0">
                <p className="text-sm text-foreground">
                  {t("settings.appearance.label")}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("settings.appearance.hint")}
                </p>
              </div>
              <ThemePicker className="w-full" />
              <LocaleSwitcher className="w-full" />
            </div>
          </PanelBody>
        </Panel>
      </PanelGrid>
    </Page>
  )
}
