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
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Inbox,
} from "@repo/ui/icons"
import { cn } from "@repo/ui/lib/utils"
import { useQuery } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import { Fragment, useEffect, useState } from "react"
import { DateFilter } from "@/components/data-table/date-filter"
import { FilterDropdown } from "@/components/data-table/filter-dropdown"
import { SortableHead } from "@/components/data-table/sortable-head"
import { TablePager } from "@/components/data-table/table-pager"
import {
  Panel,
  PanelBody,
  PanelHeader,
  PanelRow,
  PanelRows,
} from "@/components/layout/panel"
import { StateBlock } from "@/components/state-block"
import type { SearchQueryNavigate } from "@/hooks/search-query/types"
import { useDateFiltering } from "@/hooks/search-query/use-date-filtering"
import { useFiltering } from "@/hooks/search-query/use-filtering"
import { usePagination } from "@/hooks/search-query/use-pagination"
import { useSorting } from "@/hooks/search-query/use-sorting"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { useMediaQuery } from "@/hooks/use-media-query"
import { auditEntries } from "@/lib/data-access/queries"

// Reached without importing the route module (that would be a cycle).
const routeApi = getRouteApi("/(app)/")

const ENTITY_LABEL_KEYS = {
  session: "dashboard.audit.entityOptions.session",
  user: "dashboard.audit.entityOptions.user",
  registration_token: "dashboard.audit.entityOptions.registrationToken",
} as const satisfies Record<AuditEntity, MessageKeys<"app">>

// Keys come from the row's own value, not the map index, so no index-key
// suppression is needed. The value doubles as parity, so it stays index-derived
// like every other striped list.
const SKELETON_ROWS = [0, 1, 2, 3, 4] as const

// Stable keys for the compact loading skeleton's attribute rows.
const SKELETON_ATTRS = ["actor", "entity"]

/**
 * Live audit log. Owns its own query and loading state — the home route has no
 * loader for it, so the dashboard never blocks on the audit request.
 */
export function AuditPanel({ className }: { className?: string }) {
  const t = useTranslations("app")
  const tc = useTranslations("common")
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

  // One rendering at a time: below `lg` the table is not mounted at all, so its
  // `id={panelId}` payload targets never duplicate.
  const isCompact = useMediaQuery("(max-width: 1023px)")

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
        className="h-auto py-2 flex"
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
              className="h-8 rounded-sm w-full sm:w-64"
            />
          </>
        }
      />
      <PanelBody className="flex-1" aria-busy={isPlaceholderData || undefined}>
        {isPending ? (
          <AuditLoading
            compact={isCompact}
            sort={search.sort}
            order={search.order}
            onSort={toggleSort}
          />
        ) : isError ? (
          <StateBlock
            tone="destructive"
            icon={AlertTriangle}
            message={t("dashboard.audit.error")}
            className="px-3 py-8"
          />
        ) : entries.length === 0 ? (
          <StateBlock
            icon={Inbox}
            message={t("dashboard.audit.empty")}
            className="px-3 py-8"
            action={
              search.entity.length > 0 ? (
                <Button
                  variant="outline"
                  onClick={() => clearFilters(["entity"])}
                >
                  {tc("searchQuery.clear")}
                </Button>
              ) : undefined
            }
          />
        ) : isCompact ? (
          <AuditRecords
            entries={entries}
            expandedId={expandedId}
            onToggle={toggleExpanded}
            order={search.order}
            onToggleSort={toggleSort}
          />
        ) : (
          <Table
            className={
              isPlaceholderData ? "opacity-60 transition-opacity" : undefined
            }
          >
            <AuditHeader
              sort={search.sort}
              order={search.order}
              onSort={toggleSort}
            />
            <TableBody>
              {entries.map((entry, index) => (
                <AuditRow
                  key={entry.id}
                  entry={entry}
                  expanded={expandedId === entry.id}
                  onToggle={() => toggleExpanded(entry.id)}
                  striped={index % 2 === 1}
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
  striped,
}: {
  entry: AuditEntry
  expanded: boolean
  onToggle: () => void
  striped: boolean
}) {
  const t = useTranslations("app")
  const format = useFormatter()
  const panelId = `audit-entry-${entry.id}`

  // `entity` is a plain string on the wire (the enum only types the search
  // param), so look the localized label up defensively and fall back to the raw
  // value — an audit log must never render a blank cell for a new entity.
  const entityKey = ENTITY_LABEL_KEYS[entry.entity as AuditEntity] as
    | MessageKeys<"app">
    | undefined

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
        // Parity comes from the data index, not the DOM: the expanded payload
        // row is a sibling `<tr>`, so a selector-based stripe would shift on
        // expand.
        className={cn(hasPayload && "cursor-pointer", striped && "bg-muted/29")}
      >
        <TableCell data-mono className="px-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            {hasPayload && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-expanded={expanded}
                aria-controls={expanded ? panelId : undefined}
                aria-label={`${t("dashboard.audit.payload")} — ${entry.action}`}
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
                dateStyle: "short",
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
          <span>{entityKey ? t(entityKey) : entry.entity}</span>
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
              className="divide-y divide-border overflow-hidden rounded-sm border border-border"
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

/**
 * Below `lg`, one bay per entry: action + timestamp, then attribute seams, then
 * a payload trigger. Seams only — a bay, not a card.
 */
function AuditRecords({
  entries,
  expandedId,
  onToggle,
  order,
  onToggleSort,
}: {
  entries: AuditEntry[]
  expandedId: number | null
  onToggle: (id: number) => void
  order: SortOrder
  onToggleSort: (field: "created_at") => void
}) {
  const t = useTranslations("app")
  const tc = useTranslations("common")
  const format = useFormatter()
  // created_at is the list's only sortable field, so the label names the
  // ordering directly and is unambiguous in context.
  const sortLabel =
    order === "asc"
      ? tc("searchQuery.sortOldest")
      : tc("searchQuery.sortNewest")

  return (
    <>
      <div className="flex justify-end border-b border-border px-3 py-2">
        <button
          type="button"
          onClick={() => onToggleSort("created_at")}
          title={sortLabel}
          className="inline-flex cursor-pointer items-center gap-1 rounded-sm text-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          {sortLabel}
          {order === "asc" ? (
            <ChevronUp aria-hidden="true" className="size-3.5" />
          ) : (
            <ChevronDown aria-hidden="true" className="size-3.5" />
          )}
        </button>
      </div>
      <ul className="divide-y divide-border">
        {entries.map((entry, index) => {
          const isExpanded = expandedId === entry.id
          const panelId = `audit-entry-${entry.id}`
          const hasPayload =
            entry.prev !== null || entry.next !== null || entry.meta !== null
          // Defensive lookup, same as the table: never render a blank entity.
          const entityKey = ENTITY_LABEL_KEYS[entry.entity as AuditEntity] as
            | MessageKeys<"app">
            | undefined

          return (
            // Index-derived parity, same mechanism as the tables.
            <li
              key={entry.id}
              className={cn(
                "has-aria-expanded:bg-muted/50",
                index % 2 === 1 && "bg-muted/29",
              )}
            >
              <div className="px-3 py-3">
                <p className="text-sm">{entry.action}</p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {format.dateTime(new Date(entry.created_at), {
                    dateStyle: "short",
                    timeStyle: "medium",
                  })}
                </p>
              </div>

              <PanelRows className="border-t border-border">
                <PanelRow
                  label={
                    <span className="panel-label">
                      {t("dashboard.table.actor")}
                    </span>
                  }
                  value={
                    entry.actor?.name ?? (
                      <span className="text-muted-foreground">
                        {t("dashboard.audit.system")}
                      </span>
                    )
                  }
                  mono={false}
                />
                <PanelRow
                  className="flex items-center justify-between"
                  label={
                    <span className="panel-label">
                      {t("dashboard.table.entity")}
                    </span>
                  }
                  value={
                    <span className="flex min-w-0 flex-col">
                      <span className="text-end">
                        {entityKey ? t(entityKey) : entry.entity}
                      </span>
                      <span className="break-all font-mono text-xs text-muted-foreground">
                        {entry.entity_id}
                      </span>
                    </span>
                  }
                  mono={false}
                />
              </PanelRows>

              {hasPayload && (
                <button
                  type="button"
                  onClick={() => onToggle(entry.id)}
                  aria-expanded={isExpanded}
                  aria-label={`${t("dashboard.audit.payload")} — ${entry.action}`}
                  aria-controls={isExpanded ? panelId : undefined}
                  className="flex w-full cursor-pointer items-center gap-2 border-t border-border px-3 py-2 text-xs outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ChevronRight
                    aria-hidden="true"
                    className={cn(
                      "transition-transform h-6",
                      isExpanded && "rotate-90",
                    )}
                  />
                  {t("dashboard.audit.payload")}
                </button>
              )}

              {hasPayload && isExpanded && (
                <div id={panelId} className="border-t border-border p-3">
                  <div className="divide-y divide-border overflow-hidden rounded-sm border border-border">
                    <PayloadBlock label="prev" value={entry.prev} />
                    <PayloadBlock label="next" value={entry.next} />
                    <PayloadBlock
                      label={t("dashboard.audit.context")}
                      value={entry.meta}
                    />
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </>
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
    // No fill of its own: the block sits flush on whatever surface contains it
    // (the table's card, or a tinted bay in the records view). Division is by
    // the seam grid around it, not by a nested surface.
    <div className="min-w-0">
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

/** Loading shape follows whichever rendering is mounted: table or stacked bays. */
function AuditLoading({
  compact,
  sort,
  order,
  onSort,
}: {
  compact: boolean
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
      {compact ? (
        <ul className="divide-y divide-border">
          {SKELETON_ROWS.map((row) => (
            <li key={row} className={cn(row % 2 === 1 && "bg-muted/29")}>
              <div className="flex flex-col gap-1 px-3 py-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <div className="flex flex-col gap-2 border-t border-border px-3 py-3">
                {SKELETON_ATTRS.map((attr) => (
                  <div
                    key={attr}
                    className="flex items-center justify-between gap-3"
                  >
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
              <div className="border-t border-border px-3 py-2">
                <Skeleton className="h-4 w-16" />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Table>
          <AuditHeader sort={sort} order={order} onSort={onSort} />
          <TableBody>
            {SKELETON_ROWS.map((row) => (
              <TableRow
                key={row}
                className={cn(row % 2 === 1 && "bg-muted/29")}
              >
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
      )}
    </>
  )
}
