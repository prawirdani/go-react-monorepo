import { type MessageKeys, useTranslations } from "@repo/i18n"
import {
  AUDIT_SEARCH_DEFAULTS,
  type AuditSearchQuery,
  auditSearchQuerySchema,
  auditSearchQueryStripDefaults,
} from "@repo/schemas/audit"
import { Badge } from "@repo/ui/components/badge"
import { createFileRoute, stripSearchParams } from "@tanstack/react-router"
import { useEffect } from "react"
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
import { can, useCan } from "@/lib/auth/access"
import { auditEntries } from "@/lib/data-access/queries"
import { AuditPanel } from "./-audit-panel"

/**
 * Every one of this route's params at its default.
 *
 * `auditSearchQueryStripDefaults` covers only the filters, so the base params
 * survived every navigation — clearing a non-admin's dead audit filters still
 * left `?page=1&limit=10&sort=created_at&order=desc` behind. A param holding
 * its default belongs in neither the URL nor a shared link.
 */
export const STRIP_DEFAULTS = {
  ...auditSearchQueryStripDefaults,
  page: AUDIT_SEARCH_DEFAULTS.page,
  limit: AUDIT_SEARCH_DEFAULTS.limit,
  sort: AUDIT_SEARCH_DEFAULTS.sort,
  order: AUDIT_SEARCH_DEFAULTS.order,
} as const

export const Route = createFileRoute("/(app)/")({
  validateSearch: auditSearchQuerySchema,
  // Keep the URL clean: empty filters/actor/dates are omitted rather than
  // serialized as `entity=[]` or `actor=`, and so are default base params.
  search: {
    middlewares: [stripSearchParams(STRIP_DEFAULTS)],
  },
  loaderDeps: ({ search }) => search,
  // Fire-and-forget warmup, not a render gate: the audit panel owns its own
  // loading/error states. Nothing returned, so the router does not await it;
  // `prefetchQuery` cannot reject where an unawaited `ensureQueryData` would.
  loader: ({ context, deps }) => {
    // Gated on `audit.read` — the panel is this route's only consumer, but a
    // loader runs before render and `defaultPreload: "intent"` fires it on
    // hover, so an ungated prefetch had every non-admin pulling a 403'd audit
    // page on each dashboard visit.
    if (!can("audit.read")) return
    context.queryClient.prefetchQuery(auditEntries(deps))
  },
  component: Component,
})

/** Schema keys, so the params a non-admin must drop are never hand-listed. */
const AUDIT_SEARCH_KEYS = Object.keys(
  AUDIT_SEARCH_DEFAULTS,
) as (keyof AuditSearchQuery)[]

/**
 * True when the URL carries an audit search value that is not its default.
 *
 * `??` treats an absent key as its default: the search middleware removes
 * default-valued keys from what it serializes, and a predicate that read one of
 * those as "changed" would navigate on every render, forever.
 */
export function hasNonDefaultAuditSearch(search: AuditSearchQuery): boolean {
  return AUDIT_SEARCH_KEYS.some((key) => {
    const current = search[key] ?? AUDIT_SEARCH_DEFAULTS[key]
    return (
      JSON.stringify(current) !== JSON.stringify(AUDIT_SEARCH_DEFAULTS[key])
    )
  })
}

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
  return <Badge variant="outline">{t("dashboard.sampleTag")}</Badge>
}

function Component() {
  const t = useTranslations("app")
  const canReadAudit = useCan("audit.read")
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  // The audit filters live on this route, but a user without `audit.read` never
  // sees their panel — so a shared, restored, or permission-lost URL would keep
  // `?entity=user&page=3` forever and mean nothing. Clear them once the session
  // says so.
  //
  // Not done in `validateSearch`: that runs during match resolution, while the
  // session cache is only guaranteed populated by the root's `beforeLoad`, so a
  // pending identity would read as "no permission" and wipe a real admin's
  // filters. By effect time `status === "authenticated"` implies the cache is
  // warm (see `authActions` — cache before status), so `can` is exact here.
  useEffect(() => {
    if (can("audit.read")) return
    if (!hasNonDefaultAuditSearch(search)) return
    navigate({ to: "/", search: AUDIT_SEARCH_DEFAULTS, replace: true })
  }, [search, navigate])

  // Admin-only: omitted entirely without `audit.read`, so the grid reflows to
  // the two panels a non-admin may see.
  return (
    <Page title={t("dashboard.title")} description={t("dashboard.description")}>
      <PanelGrid className="lg:grid-cols-12 animate-panel-in">
        <Panel className="lg:col-span-7">
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
            <PanelRows>
              {services.map((service) => (
                <PanelRow
                  key={service.nameKey}
                  label={t(service.nameKey)}
                  value={
                    <StateBadge tone={service.tone}>
                      {t(service.stateKey)}
                    </StateBadge>
                  }
                  mono={false}
                />
              ))}
            </PanelRows>
          </PanelBody>
        </Panel>

        {canReadAudit && <AuditPanel className="lg:col-span-12" />}
      </PanelGrid>
    </Page>
  )
}
