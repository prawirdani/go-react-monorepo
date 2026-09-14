import { useTranslations } from "@repo/i18n"
import { Button } from "@repo/ui/components/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Page } from "@/components/layout/page"
import {
  Panel,
  PanelBody,
  PanelGrid,
  PanelHeader,
  PanelNote,
  PanelRow,
  PanelRows,
  StateBadge,
  type Tone,
} from "@/components/layout/panel"
import type { MessageKey } from "@/components/layout/sidebar-nav"

export const Route = createFileRoute("/(app)/")({
  component: Component,
})

// Sample figures are data, not copy — only the labels are translated.
const summary: { labelKey: MessageKey; value: string; tone?: Tone }[] = [
  { labelKey: "dashboard.summary.entriesToday", value: "128" },
  {
    labelKey: "dashboard.summary.awaitingReview",
    value: "12",
    tone: "warning",
  },
  {
    labelKey: "dashboard.summary.failedProcessing",
    value: "3",
    tone: "destructive",
  },
  { labelKey: "dashboard.summary.lastSync", value: "09:41 WIB" },
]

const services: { nameKey: MessageKey; stateKey: MessageKey; tone: Tone }[] = [
  {
    nameKey: "dashboard.service.api",
    stateKey: "dashboard.serviceState.normal",
    tone: "success",
  },
  {
    nameKey: "dashboard.service.auth",
    stateKey: "dashboard.serviceState.normal",
    tone: "success",
  },
  {
    nameKey: "dashboard.service.storage",
    stateKey: "dashboard.serviceState.slow",
    tone: "warning",
  },
  {
    nameKey: "dashboard.service.taskQueue",
    stateKey: "dashboard.serviceState.disrupted",
    tone: "destructive",
  },
  {
    nameKey: "dashboard.service.backup",
    stateKey: "dashboard.serviceState.scheduled",
    tone: "info",
  },
]

const activity: {
  time: string
  actorKey: MessageKey
  actionKey: MessageKey
  stateKey: MessageKey
  tone: Tone
}[] = [
  {
    time: "09:41",
    actorKey: "dashboard.actor.operator",
    actionKey: "dashboard.activityAction.updateProfile",
    stateKey: "dashboard.activityState.done",
    tone: "success",
  },
  {
    time: "09:32",
    actorKey: "dashboard.actor.system",
    actionKey: "dashboard.activityAction.syncCatalog",
    stateKey: "dashboard.activityState.running",
    tone: "info",
  },
  {
    time: "09:20",
    actorKey: "dashboard.actor.admin",
    actionKey: "dashboard.activityAction.archiveEntry",
    stateKey: "dashboard.activityState.underReview",
    tone: "warning",
  },
  {
    time: "09:04",
    actorKey: "dashboard.actor.system",
    actionKey: "dashboard.activityAction.sendRecoveryEmail",
    stateKey: "dashboard.activityState.failed",
    tone: "destructive",
  },
]

function SampleTag() {
  const t = useTranslations("app")
  return <StateBadge tone="warning">{t("dashboard.sampleTag")}</StateBadge>
}

function Component() {
  const t = useTranslations("app")

  return (
    <Page title={t("dashboard.title")} description={t("dashboard.description")}>
      <PanelGrid className="lg:grid-cols-12">
        <Panel className="animate-panel-in lg:col-span-7">
          <PanelHeader
            title={t("dashboard.panels.summary")}
            aside={<SampleTag />}
          />
          <PanelBody className="flex-1">
            <PanelRows>
              {summary.map((row) => (
                <PanelRow
                  key={row.labelKey}
                  label={t(row.labelKey)}
                  value={row.value}
                  tone={row.tone}
                />
              ))}
            </PanelRows>
          </PanelBody>
          <PanelNote className="border-t border-border">
            {t("dashboard.summaryNote")}
          </PanelNote>
        </Panel>

        <Panel className="lg:col-span-5">
          <PanelHeader
            title={t("dashboard.panels.services")}
            aside={<SampleTag />}
          />
          <PanelBody className="flex-1">
            <ul className="divide-y divide-border">
              {services.map((service) => (
                <li
                  key={service.nameKey}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <span className="min-w-0 truncate text-sm">
                    {t(service.nameKey)}
                  </span>
                  <StateBadge tone={service.tone}>
                    {t(service.stateKey)}
                  </StateBadge>
                </li>
              ))}
            </ul>
          </PanelBody>
        </Panel>

        <Panel className="lg:col-span-5">
          <PanelHeader title={t("dashboard.panels.actions")} />
          <PanelBody className="flex-1 justify-between gap-5 p-3">
            <p className="max-w-[46ch] text-sm text-muted-foreground">
              {t("dashboard.actionsNote")}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button nativeButton={false} render={<Link to="/example" />}>
                {t("dashboard.openExample")}
              </Button>
              <Button
                variant="ghost"
                nativeButton={false}
                render={<Link to="/settings" />}
              >
                {t("dashboard.openSettings")}
              </Button>
            </div>
          </PanelBody>
        </Panel>

        <Panel className="lg:col-span-7">
          <PanelHeader
            title={t("dashboard.panels.activity")}
            aside={<SampleTag />}
          />
          <PanelBody className="flex-1">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[92px] px-3 panel-label">
                    {t("dashboard.table.time")}
                  </TableHead>
                  <TableHead className="px-3 panel-label">
                    {t("dashboard.table.actor")}
                  </TableHead>
                  <TableHead className="px-3 panel-label">
                    {t("dashboard.table.action")}
                  </TableHead>
                  <TableHead className="px-3 text-right panel-label">
                    {t("dashboard.table.state")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activity.map((entry) => (
                  <TableRow key={entry.time}>
                    <TableCell
                      data-mono
                      className="px-3 text-xs text-muted-foreground"
                    >
                      {entry.time}
                    </TableCell>
                    <TableCell className="px-3">{t(entry.actorKey)}</TableCell>
                    <TableCell className="px-3 text-muted-foreground">
                      {t(entry.actionKey)}
                    </TableCell>
                    <TableCell className="px-3 text-right">
                      <StateBadge tone={entry.tone}>
                        {t(entry.stateKey)}
                      </StateBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </PanelBody>
        </Panel>
      </PanelGrid>
    </Page>
  )
}
