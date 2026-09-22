import { useFormatter, useTranslations } from "@repo/i18n"
import type { SortOrder } from "@repo/schemas/search-query"
import {
  type Gender,
  type Role,
  type User,
  userSearchQuerySchema,
  userSearchQueryStripDefaults,
} from "@repo/schemas/user"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/ui/components/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/avatar"
import { Button } from "@repo/ui/components/button"
import { Skeleton } from "@repo/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table"
import toast from "@repo/ui/components/toast"
import { ChevronDown, ChevronRight, ChevronUp, Trash } from "@repo/ui/icons"
import { cn } from "@repo/ui/lib/utils"
import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, stripSearchParams } from "@tanstack/react-router"
import { Fragment, useState } from "react"
import { FilterDropdown } from "@/components/data-table/filter-dropdown"
import { SortableHead } from "@/components/data-table/sortable-head"
import { TablePager } from "@/components/data-table/table-pager"
import { Page } from "@/components/layout/page"
import {
  Panel,
  PanelBody,
  PanelGrid,
  PanelHeader,
  PanelRow,
  PanelRows,
} from "@/components/layout/panel"
import { RoleBadge } from "@/components/layout/role-badge"
import { SessionList } from "@/components/session-list"
import type { SearchQueryNavigate } from "@/hooks/search-query/types"
import { useFiltering } from "@/hooks/search-query/use-filtering"
import { usePagination } from "@/hooks/search-query/use-pagination"
import { useSorting } from "@/hooks/search-query/use-sorting"
import { useErrorHandler } from "@/hooks/use-error-handler"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useCan } from "@/lib/auth/access"
import { imageUrl } from "@/lib/data-access/api"
import { deleteUser } from "@/lib/data-access/mutations"
import { getSession, listUser } from "@/lib/data-access/queries"
import { GENDER_LABEL_KEYS, ROLE_LABEL_KEYS } from "@/lib/i18n"
import { EditUserDialog } from "./-edit-user-dialog"
import { InviteUserDialog } from "./-invite-user-dialog"

export const Route = createFileRoute("/(app)/users/")({
  validateSearch: userSearchQuerySchema,
  // Keep the URL clean: an empty filter array is omitted entirely rather than
  // serialized as `role=[]`. The base params (page/limit/sort/order) stay.
  search: {
    middlewares: [stripSearchParams(userSearchQueryStripDefaults)],
  },
  loaderDeps: ({ search }) => search,
  // Fire-and-forget warmup, NOT a render gate: the component below owns its own
  // loading and error states, so the loader must not block the transition.
  // Nothing is returned on purpose — returning the promise would make the router
  // await it. `prefetchQuery` is used rather than `ensureQueryData` because the
  // latter rejects, and an unawaited rejection is an unhandled one.
  loader: ({ context, deps }) => {
    context.queryClient.prefetchQuery(listUser(deps))
  },
  component: RouteComponent,
})

// Derived from the label maps, so a new role/gender in the schema must grow a
// label key and therefore appears here.
const ROLE_VALUES = Object.keys(ROLE_LABEL_KEYS) as Role[]
const GENDER_VALUES = Object.keys(GENDER_LABEL_KEYS) as Gender[]

// Stable keys for the compact loading skeleton's attribute rows.
// Keys come from the row's own value, not the map index, so no index-key
// suppression is needed. The value doubles as parity, so it stays index-derived
// like every other striped list.
const SKELETON_ROWS = [0, 1, 2, 3, 4] as const

const SKELETON_ATTRS = ["role", "phone", "gender", "created"]

function RouteComponent() {
  const t = useTranslations("app")
  const tc = useTranslations("common")
  const format = useFormatter()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const canEdit = useCan("user.update")
  const canDelete = useCan("user.delete")
  const canInvite = useCan("auth.register-user")
  const canViewSessions = useCan("auth.view-user-sessions")
  const canRevokeSessions = useCan("auth.revoke-user-sessions")
  const session = useQuery(getSession).data
  const currentUser = session?.user
  const currentSessionId = session?.sessionId

  // One row open at a time. The session query only mounts while a row is open.
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const toggleExpanded = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id))

  // Every cell that can render: user, role, phone, gender, created,
  // plus the actions cell when edit or delete is allowed.
  const columnCount = 5 + (canEdit || canDelete ? 1 : 0)

  // The router's navigate is generic over this route's own search; the query
  // concerns only need the functional `search` updater. One documented cast,
  // shared by all three.
  const nav = navigate as SearchQueryNavigate
  const { setPage, setLimit } = usePagination(search, nav)
  const { toggleSort } = useSorting(search, nav)
  const { toggleFilter, clearFilters } = useFiltering(search, nav)

  const { data, isPending, isError, isPlaceholderData } = useQuery(
    listUser(search),
  )

  // One rendering at a time: below `lg` the table is not mounted at all, so its
  // `id={panelId}` targets never duplicate and `SessionList` never queries twice.
  const isCompact = useMediaQuery("(max-width: 1023px)")

  const users = data?.data ?? []
  const pagination = data?.meta.pagination

  const filterGroups = [
    {
      key: "role",
      label: t("users.table.role"),
      selected: search.role,
      options: ROLE_VALUES.map((role) => ({
        value: role,
        label: tc(ROLE_LABEL_KEYS[role]),
      })),
    },
    {
      key: "gender",
      label: t("users.table.gender"),
      selected: search.gender,
      options: GENDER_VALUES.map((gender) => ({
        value: gender,
        label: tc(GENDER_LABEL_KEYS[gender]),
      })),
    },
  ]
  const activeFilterCount = search.role.length + search.gender.length

  return (
    <Page
      title={t("users.title")}
      description={t("users.description")}
      breadcrumbs={[
        { name: t("dashboard.title"), href: "/" },
        { name: t("users.breadcrumb") },
      ]}
    >
      <PanelGrid>
        <Panel className="animate-panel-in">
          <PanelHeader
            title={t("users.title")}
            className="h-auto py-2"
            aside={
              <>
                {canInvite && <InviteUserDialog />}
                <FilterDropdown
                  groups={filterGroups}
                  activeCount={activeFilterCount}
                  onToggle={toggleFilter}
                  onClear={() => clearFilters(["role", "gender"])}
                />
              </>
            }
          />
          <PanelBody
            className="flex-1"
            aria-busy={isPlaceholderData || undefined}
          >
            {isPending ? (
              <UsersLoading compact={isCompact} />
            ) : isError ? (
              <p role="alert" className="px-3 py-4 text-sm text-destructive">
                {t("users.error")}
              </p>
            ) : users.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                {t("users.empty")}
              </p>
            ) : isCompact ? (
              <UserRecords
                users={users}
                expandedId={expandedId}
                onToggle={toggleExpanded}
                canEdit={canEdit}
                canDelete={canDelete}
                canViewSessions={canViewSessions}
                canRevokeSessions={canRevokeSessions}
                currentUser={currentUser}
                currentSessionId={currentSessionId}
                order={search.order}
                onToggleSort={toggleSort}
              />
            ) : (
              <Table
                className={cn(
                  isPlaceholderData && "opacity-60 transition-opacity",
                )}
              >
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-3 panel-label">
                      {t("users.table.user")}
                    </TableHead>
                    <TableHead className="px-3 panel-label">
                      {t("users.table.role")}
                    </TableHead>
                    <TableHead className="px-3 panel-label">
                      {t("users.table.phone")}
                    </TableHead>
                    <TableHead className="px-3 panel-label">
                      {t("users.table.gender")}
                    </TableHead>
                    <SortableHead
                      field="created_at"
                      activeSort={search.sort}
                      order={search.order}
                      onSort={toggleSort}
                    >
                      {t("users.table.created")}
                    </SortableHead>
                    {canEdit || canDelete ? (
                      <TableHead className="w-[104px] px-3 text-right">
                        <span className="sr-only">
                          {t("users.table.actions")}
                        </span>
                      </TableHead>
                    ) : (
                      <TableHead />
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user, index) => {
                    const isExpanded = expandedId === user.id
                    const isSelf = user.id === currentUser?.id
                    const panelId = `user-sessions-${user.id}`
                    // Bulk revoke on your own row would sign you out; offer it
                    // only for other people's accounts.
                    const canRevokeAll = canRevokeSessions && !isSelf

                    return (
                      <Fragment key={user.id}>
                        <TableRow
                          onClick={
                            canViewSessions
                              ? (e) => {
                                  // Ignore clicks on the row's own controls
                                  // (edit, delete, expander); outer row only.
                                  if (
                                    (e.target as HTMLElement).closest(
                                      "button, a",
                                    )
                                  ) {
                                    return
                                  }
                                  toggleExpanded(user.id)
                                }
                              : undefined
                          }
                          // Parity comes from the data index, not the DOM: the
                          // expanded sessions row is a sibling `<tr>`, so a
                          // selector-based stripe would shift on expand.
                          className={cn(
                            canViewSessions && "cursor-pointer",
                            index % 2 === 1 && "bg-muted/29",
                          )}
                        >
                          <TableCell className="px-3">
                            <div className="flex items-center gap-3">
                              {canViewSessions && (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-expanded={isExpanded}
                                  aria-controls={
                                    isExpanded ? panelId : undefined
                                  }
                                  aria-label={`${t("users.sessions.toggle")} — ${user.name}`}
                                  onClick={() => toggleExpanded(user.id)}
                                >
                                  <ChevronRight
                                    className={cn(
                                      "transition-transform",
                                      isExpanded && "rotate-90",
                                    )}
                                  />
                                </Button>
                              )}
                              <Avatar
                                className="size-8 shrink-0"
                                key={user.profile_picture || "fallback"}
                              >
                                {user.profile_picture && (
                                  <AvatarImage
                                    src={imageUrl.profile(user.profile_picture)}
                                    alt=""
                                    loading="lazy"
                                  />
                                )}
                                <AvatarFallback>
                                  {user.name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="truncate text-sm">{user.name}</p>
                                <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                                  {user.email}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="px-3">
                            <RoleBadge role={user.role} />
                          </TableCell>
                          <TableCell
                            data-mono
                            className="px-3 text-xs text-muted-foreground"
                          >
                            {user.phone ?? "—"}
                          </TableCell>
                          <TableCell className="px-3 text-sm text-muted-foreground">
                            {user.gender
                              ? tc(GENDER_LABEL_KEYS[user.gender])
                              : "—"}
                          </TableCell>
                          <TableCell
                            data-mono
                            className="px-3 text-xs text-muted-foreground"
                          >
                            {format.dateTime(new Date(user.created_at), {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </TableCell>
                          {(canEdit || canDelete) && !isSelf ? (
                            <TableCell className="px-3 text-right">
                              <div className="flex justify-end gap-1">
                                {canEdit && <EditUserDialog user={user} />}
                                {canDelete && <DeleteUserDialog user={user} />}
                              </div>
                            </TableCell>
                          ) : (
                            <TableCell />
                          )}
                        </TableRow>

                        {canViewSessions && isExpanded && (
                          <TableRow className="hover:bg-transparent">
                            <TableCell
                              colSpan={columnCount}
                              className="whitespace-normal bg-muted/30 p-0"
                            >
                              <div id={panelId}>
                                <p className="panel-label px-3 pt-3">
                                  {t("users.sessions.panel")}
                                </p>
                                <SessionList
                                  userId={user.id}
                                  canRevoke={canRevokeSessions}
                                  showRevokeAll={canRevokeAll}
                                  currentSessionId={currentSessionId}
                                  className="mt-2 border-t border-border"
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    )
                  })}
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
      </PanelGrid>
    </Page>
  )
}

/** Loading shape follows whichever rendering is mounted: table or stacked bays. */
function UsersLoading({ compact }: { compact: boolean }) {
  const t = useTranslations("app")
  const canEdit = useCan("user.update")
  const canDelete = useCan("user.delete")
  const canViewSessions = useCan("auth.view-user-sessions")
  const showActions = canEdit || canDelete

  return (
    <>
      <p role="status" className="sr-only">
        {t("users.loading")}
      </p>
      {compact ? (
        <ul className="divide-y divide-border">
          {SKELETON_ROWS.map((row) => (
            <li key={row} className={cn(row % 2 === 1 && "bg-muted/29")}>
              <div className="flex items-center gap-3 px-3 py-3">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
                {showActions && <Skeleton className="size-8 shrink-0" />}
              </div>
              <div className="flex flex-col gap-2 border-t border-border px-3 py-3">
                {SKELETON_ATTRS.map((attr) => (
                  <div
                    key={attr}
                    className="flex items-center justify-between gap-3"
                  >
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
              {canViewSessions && (
                <div className="border-t border-border px-3 py-2">
                  <Skeleton className="h-4 w-16" />
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-3 panel-label">
                {t("users.table.user")}
              </TableHead>
              <TableHead className="px-3 panel-label">
                {t("users.table.role")}
              </TableHead>
              <TableHead className="px-3 panel-label">
                {t("users.table.phone")}
              </TableHead>
              <TableHead className="px-3 panel-label">
                {t("users.table.gender")}
              </TableHead>
              <TableHead className="px-3 panel-label">
                {t("users.table.created")}
              </TableHead>
              {canEdit || canDelete ? (
                <TableHead className="w-[104px] px-3" />
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {SKELETON_ROWS.map((row) => (
              <TableRow
                key={row}
                className={cn(row % 2 === 1 && "bg-muted/29")}
              >
                <TableCell className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    {canViewSessions && (
                      <Skeleton className="size-7 shrink-0 rounded-sm" />
                    )}
                    <Skeleton className="size-8 shrink-0 rounded-full" />
                    <div className="flex flex-col gap-1">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-3 py-3">
                  <Skeleton className="h-5 w-14" />
                </TableCell>
                <TableCell className="px-3 py-3">
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell className="px-3 py-3">
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell className="px-3 py-3">
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                {canEdit || canDelete ? (
                  <TableCell className="flex justify-end px-3 py-3">
                    <Skeleton className="h-8 w-8" />
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}

/**
 * Below `lg`, one bay per user: identity, then attribute seams, then actions.
 * No card chrome — the panel is already a panel; a record is a bay on the rack.
 * Seams come from `PanelRows`; the single small-caps label is `.panel-label`.
 */
function UserRecords({
  users,
  expandedId,
  onToggle,
  canEdit,
  canDelete,
  canViewSessions,
  canRevokeSessions,
  currentUser,
  currentSessionId,
  order,
  onToggleSort,
}: {
  users: User[]
  expandedId: string | null
  onToggle: (id: string) => void
  canEdit: boolean
  canDelete: boolean
  canViewSessions: boolean
  canRevokeSessions: boolean
  currentUser: User | undefined
  currentSessionId: string | undefined
  order: SortOrder
  onToggleSort: (field: "created_at") => void
}) {
  const t = useTranslations("app")
  const tc = useTranslations("common")
  const format = useFormatter()
  const showActions = canEdit || canDelete
  // The list's only sortable field is created_at, so the label names the
  // ordering directly (newest/oldest) and is unambiguous in context.
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
        {users.map((user, index) => {
          const isExpanded = expandedId === user.id
          const isSelf = user.id === currentUser?.id
          const panelId = `user-sessions-${user.id}`
          // Bulk revoke on your own row would sign you out; offer it only for
          // other people's accounts.
          const canRevokeAll = canRevokeSessions && !isSelf

          return (
            // Index-derived parity, same mechanism as the tables.
            <li
              key={user.id}
              className={cn(
                "has-aria-expanded:bg-muted/50",
                index % 2 === 1 && "bg-muted/29",
              )}
            >
              <div className="flex items-center gap-3 px-3 py-3">
                <Avatar
                  className="size-8 shrink-0"
                  key={user.profile_picture || "fallback"}
                >
                  {user.profile_picture && (
                    <AvatarImage
                      src={imageUrl.profile(user.profile_picture)}
                      alt=""
                      loading="lazy"
                    />
                  )}
                  <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{user.name}</p>
                  <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                    {user.email}
                  </p>
                </div>
                {showActions && !isSelf && (
                  <div className="flex shrink-0 items-center gap-1">
                    {canEdit && <EditUserDialog user={user} />}
                    {canDelete && <DeleteUserDialog user={user} />}
                  </div>
                )}
              </div>

              <PanelRows className="border-t border-border">
                <PanelRow
                  label={
                    <span className="panel-label">{t("users.table.role")}</span>
                  }
                  value={<RoleBadge role={user.role} />}
                  mono={false}
                />
                <PanelRow
                  label={
                    <span className="panel-label">
                      {t("users.table.phone")}
                    </span>
                  }
                  value={user.phone ?? "—"}
                />
                <PanelRow
                  label={
                    <span className="panel-label">
                      {t("users.table.gender")}
                    </span>
                  }
                  value={user.gender ? tc(GENDER_LABEL_KEYS[user.gender]) : "—"}
                  mono={false}
                />
                <PanelRow
                  label={
                    <span className="panel-label">
                      {t("users.table.created")}
                    </span>
                  }
                  value={format.dateTime(new Date(user.created_at), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                />
              </PanelRows>

              {canViewSessions && (
                <button
                  type="button"
                  onClick={() => onToggle(user.id)}
                  aria-expanded={isExpanded}
                  aria-label={`${t("users.sessions.toggle")} — ${user.name}`}
                  aria-controls={isExpanded ? panelId : undefined}
                  className="flex w-full cursor-pointer items-center gap-2 border-t border-border px-3 py-2 text-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ChevronRight
                    aria-hidden="true"
                    className={cn(
                      "transition-transform",
                      isExpanded && "rotate-90",
                    )}
                  />
                  {t("users.sessions.toggle")}
                </button>
              )}

              {canViewSessions && isExpanded && (
                <div id={panelId} className="border-t border-border">
                  <p className="panel-label px-3 pt-3">
                    {t("users.sessions.panel")}
                  </p>
                  <SessionList
                    userId={user.id}
                    canRevoke={canRevokeSessions}
                    showRevokeAll={canRevokeAll}
                    currentSessionId={currentSessionId}
                    className="mt-2 border-t border-border"
                  />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}

function DeleteUserDialog({ user }: { user: User }) {
  const t = useTranslations("app")
  const tc = useTranslations("common")
  const handleError = useErrorHandler()

  const { mutateAsync, isPending } = useMutation(deleteUser)

  const handleDelete = async () =>
    mutateAsync(user.id, {
      onSuccess: () => toast.success(t("users.delete.success")),
      onError: (e) => handleError(e),
    })

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="destructive"
            size="icon-sm"
            aria-label={t("users.delete.action")}
          >
            <Trash />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("users.delete.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("users.delete.description")}{" "}
            <span className="font-mono text-xs text-foreground">
              {user.email}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending} variant="outline">
            {tc("actions.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            loading={isPending}
            variant="destructive"
            onClick={handleDelete}
          >
            {t("users.delete.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
