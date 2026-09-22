import { type MessageKeys, useFormatter, useTranslations } from "@repo/i18n"
import {
  AUDIT_ENTITIES,
  type AuditEntity,
  type AuditEntry,
} from "@repo/schemas/audit"
import type { SortOrder } from "@repo/schemas/search-query"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { Skeleton } from "@repo/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table"
import { ChevronRight } from "@repo/ui/icons"
import { cn } from "@repo/ui/lib/utils"
import { useQuery } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import { Fragment, useEffect, useState } from "react"
import { DateFilter } from "@/components/data-table/date-filter"
import { FilterDropdown } from "@/components/data-table/filter-dropdown"
import { SortableHead } from "@/components/data-table/sortable-head"
import { TablePager } from "@/components/data-table/table-pager"
import { Panel, PanelBody, PanelHeader } from "@/components/layout/panel"
import type { SearchQueryNavigate } from "@/hooks/search-query/types"
import { useDateFiltering } from "@/hooks/search-query/use-date-filtering"
import { useFiltering } from "@/hooks/search-query/use-filtering"
import { usePagination } from "@/hooks/search-query/use-pagination"
import { useSorting } from "@/hooks/search-query/use-sorting"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { auditEntries } from "@/lib/data-access/queries"

// Reached without importing the route module (that would be a cycle).
const routeApi = getRouteApi("/(app)/")

const ENTITY_LABEL_KEYS = {
  session: "dashboard.audit.entityOptions.session",
  user: "dashboard.audit.entityOptions.user",
  registration_token: "dashboard.audit.entityOptions.registrationToken",
} as const satisfies Record<AuditEntity, MessageKeys<"app">>

/**
 * Live audit log. Owns its own query and loading state — the home route has no
 * loader for it, so the dashboard never blocks on the audit request.
 */
export function AuditPanel({ className }: { className?: string }) {
  const t = useTranslations("app")
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()

  // The router's navigate is generic over this route's search; the query
  // concerns need only the functional `search` updater. One documented cast.
  const nav = navigate as SearchQueryNavigate
  const { setPage, setLimit } = usePagination(search, nav)
  const { toggleSort } = useSorting(search, nav)
  const { toggleFilter, clearFilters } = useFiltering(search, nav)
  const { setDate, setRange, clearDate } = useDateFiltering(search, nav)

  const { data, isPending, isError, isPlaceholderData } = useQuery(
    auditEntries(search),
  )

  const entries = data?.data ?? []
  const pagination = data?.meta.pagination

  // One entry open at a time, matching the users table.
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const toggleExpanded = (id: number) =>
    setExpandedId((prev) => (prev === id ? null : id))

  // Actor search: the input is local, the URL is written after a debounce.
  // Seed from the URL so a reload/back reflects the applied filter.
  const [actorInput, setActorInput] = useState(search.actor)
  const debouncedActor = useDebouncedValue(actorInput, 300)

  useEffect(() => {
    setActorInput(search.actor)
  }, [search.actor])

  useEffect(() => {
    // Skip a no-op write when the URL already holds the debounced value.
    if (debouncedActor === search.actor) return
    nav({ search: (prev) => ({ ...prev, actor: debouncedActor, page: 1 }) })
  }, [debouncedActor, search.actor, nav])

  const entityGroup = {
    key: "entity",
    label: t("dashboard.table.entity"),
    selected: search.entity,
    options: AUDIT_ENTITIES.map((entity) => ({
      value: entity,
      label: t(ENTITY_LABEL_KEYS[entity]),
    })),
  }

  return (
    <Panel className={className}>
      <PanelHeader
        title={t("dashboard.panels.audit")}
        className="h-auto py-2"
        aside={
          <>
            <FilterDropdown
              groups={[entityGroup]}
              activeCount={search.entity.length}
              onToggle={toggleFilter}
              onClear={() => clearFilters(["entity"])}
            />
            <DateFilter
              value={{
                date: search.date,
                from: search.from,
                to: search.to,
              }}
              onSetDate={setDate}
              onSetRange={setRange}
              onClear={clearDate}
            />
            <Input
              value={actorInput}
              onChange={(e) => setActorInput(e.target.value)}
              placeholder={t("dashboard.audit.actorPlaceholder")}
              aria-label={t("dashboard.audit.actorSearch")}
              className="h-8 w-80 rounded-sm"
            />
          </>
        }
      />
      <PanelBody className="flex-1" aria-busy={isPlaceholderData || undefined}>
        {isPending ? (
          <AuditLoading
            sort={search.sort}
            order={search.order}
            onSort={toggleSort}
          />
        ) : isError ? (
          <p role="alert" className="px-3 py-4 text-sm text-destructive">
            {t("dashboard.audit.error")}
          </p>
        ) : entries.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            {t("dashboard.audit.empty")}
          </p>
        ) : (
          <Table
            className={cn(
              "md:table-fixed",
              isPlaceholderData ? "opacity-60 transition-opacity" : undefined,
            )}
          >
            <AuditHeader
              sort={search.sort}
              order={search.order}
              onSort={toggleSort}
            />
            <TableBody>
              {entries.map((entry) => (
                <AuditRow
                  key={entry.id}
                  entry={entry}
                  expanded={expandedId === entry.id}
                  onToggle={() => toggleExpanded(entry.id)}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </PanelBody>

      {pagination && pagination.total > 0 && (
        <TablePager
          meta={pagination}
          isPlaceholderData={isPlaceholderData}
          onPage={setPage}
          onLimit={setLimit}
        />
      )}
    </Panel>
  )
}

function AuditHeader({
  sort,
  order,
  onSort,
}: {
  sort: string
  order: SortOrder
  onSort: (field: "created_at") => void
}) {
  const t = useTranslations("app")

  return (
    <TableHeader>
      <TableRow className="hover:bg-transparent">
        <SortableHead
          field="created_at"
          activeSort={sort}
          order={order}
          onSort={onSort}
        >
          {t("dashboard.table.time")}
        </SortableHead>
        <TableHead className="px-3 panel-label">
          {t("dashboard.table.actor")}
        </TableHead>
        <TableHead className="px-3 panel-label">
          {t("dashboard.table.action")}
        </TableHead>
        <TableHead className="px-3 panel-label text-end">
          {t("dashboard.table.entity")}
        </TableHead>
      </TableRow>
    </TableHeader>
  )
}

function AuditRow({
  entry,
  expanded,
  onToggle,
}: {
  entry: AuditEntry
  expanded: boolean
  onToggle: () => void
}) {
  const t = useTranslations("app")
  const format = useFormatter()
  const panelId = `audit-entry-${entry.id}`

  const hasPayload =
    entry.prev !== null || entry.next !== null || entry.meta !== null

  return (
    <Fragment>
      <TableRow
        onClick={
          hasPayload
            ? (e) => {
                // Ignore clicks on the row's own controls; outer row only.
                if ((e.target as HTMLElement).closest("button, a")) return
                onToggle()
              }
            : undefined
        }
        className={cn(hasPayload && "cursor-pointer")}
      >
        <TableCell data-mono className="px-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            {hasPayload && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-expanded={expanded}
                aria-controls={panelId}
                aria-label={t("dashboard.audit.payload")}
                onClick={onToggle}
              >
                <ChevronRight
                  className={cn(
                    "transition-transform",
                    expanded && "rotate-90",
                  )}
                />
              </Button>
            )}
            <span>
              {format.dateTime(new Date(entry.created_at), {
                dateStyle: "long",
                timeStyle: "medium",
              })}
            </span>
          </div>
        </TableCell>
        <TableCell className="px-3 text-sm">
          {entry.actor?.name ?? (
            <span className="text-muted-foreground">
              {t("dashboard.audit.system")}
            </span>
          )}
        </TableCell>
        <TableCell className="px-3">{entry.action}</TableCell>
        <TableCell className="px-3 text-end">
          <span>{entry.entity}</span>
          <span className="ml-2 font-mono text-xs text-muted-foreground">
            {entry.entity_id}
          </span>
        </TableCell>
      </TableRow>
      {hasPayload && expanded && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={4} className="whitespace-normal px-3 pb-3">
            <div
              id={panelId}
              className="grid gap-px overflow-hidden rounded-sm border border-border bg-border"
            >
              <PayloadBlock label="prev" value={entry.prev} />
              <PayloadBlock label="next" value={entry.next} />
              <PayloadBlock
                label={t("dashboard.audit.context")}
                value={entry.meta}
              />
            </div>
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  )
}

/** Raw JSON, as JSON: one full-width mono block per payload, stacked. */
function PayloadBlock({
  label,
  value,
}: {
  label: string
  value: AuditEntry["prev"] | AuditEntry["meta"]
}) {
  return (
    <div className="min-w-0 bg-card">
      <p className="panel-label border-b border-border px-2 py-1">{label}</p>
      {value === null ? (
        <p className="px-2 py-1.5 font-mono text-xs text-muted-foreground">—</p>
      ) : (
        <pre className="max-h-56 overflow-auto px-2 py-1.5 font-mono text-xs leading-relaxed">
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </div>
  )
}

/** Same loading shape as the loaded table. */
function AuditLoading({
  sort,
  order,
  onSort,
}: {
  sort: string
  order: SortOrder
  onSort: (field: "created_at") => void
}) {
  const t = useTranslations("app")

  return (
    <>
      <p role="status" className="sr-only">
        {t("dashboard.audit.loading")}
      </p>
      <Table>
        <AuditHeader sort={sort} order={order} onSort={onSort} />
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows
            <TableRow key={i}>
              <TableCell className="px-3 py-4">
                <Skeleton className="h-4 w-2/3" />
              </TableCell>
              <TableCell className="px-3 py-4">
                <Skeleton className="h-4 w-1/2" />
              </TableCell>
              <TableCell className="px-3 py-4">
                <Skeleton className="h-4 w-3/4" />
              </TableCell>
              <TableCell className="px-3 py-4">
                <Skeleton className="h-4 w-2/3" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}
