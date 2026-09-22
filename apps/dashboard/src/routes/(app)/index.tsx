import { type MessageKeys, useTranslations } from "@repo/i18n"
import {
  auditSearchQuerySchema,
  auditSearchQueryStripDefaults,
} from "@repo/schemas/audit"
import { createFileRoute, stripSearchParams } from "@tanstack/react-router"
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
import { useCan } from "@/lib/auth/access"
import { AuditPanel } from "./-audit-panel"

export const Route = createFileRoute("/(app)/")({
  validateSearch: auditSearchQuerySchema,
  // Keep the URL clean: empty filters/actor/dates are omitted rather than
  // serialized as `entity=[]` or `actor=`.
  search: {
    middlewares: [stripSearchParams(auditSearchQueryStripDefaults)],
  },
  component: Component,
})

// Sample figures are data, not copy — only the labels are translated.
const summary: { labelKey: MessageKeys<"app">; value: string; tone?: Tone }[] =
  [
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

const services: {
  nameKey: MessageKeys<"app">
  stateKey: MessageKeys<"app">
  tone: Tone
}[] = [
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

function SampleTag() {
  const t = useTranslations("app")
  return <StateBadge tone="warning">{t("dashboard.sampleTag")}</StateBadge>
}

function Component() {
  const t = useTranslations("app")
  const canReadAudit = useCan("audit.read")

  // Admin-only: omitted entirely without `audit.read`, so the grid reflows to
  // the two panels a non-admin may see.
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

        {canReadAudit && <AuditPanel className="lg:col-span-12" />}
      </PanelGrid>
    </Page>
  )
}
