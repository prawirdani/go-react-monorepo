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
  PanelRow,
  PanelRows,
} from "@/components/layout/panel"

export const Route = createFileRoute("/(app)/settings/")({
  component: RouteComponent,
})

function RouteComponent() {
  const t = useTranslations("app")

  return (
    <Page title={t("settings.title")} description={t("settings.description")}>
      <PanelGrid className="lg:grid-cols-12">
        <Panel className="animate-panel-in lg:col-span-7">
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

        <Panel className="lg:col-span-5 col-span-12">
          <PanelHeader title={t("settings.about.panel")} />
          <PanelBody className="flex-1">
            <PanelRows>
              <PanelRow
                label={t("settings.about.languageLabel")}
                value={t("settings.about.languageValue")}
                mono={false}
              />
              <PanelRow
                label={t("settings.about.authLabel")}
                value={t("settings.about.authValue")}
              />
              <PanelRow
                label={t("settings.about.apiLabel")}
                value={t("settings.about.apiValue")}
              />
              <PanelRow
                label={t("settings.about.defaultModeLabel")}
                value={t("settings.about.defaultModeValue")}
                mono={false}
              />
            </PanelRows>
          </PanelBody>
        </Panel>
      </PanelGrid>
    </Page>
  )
}
