import { useFormatter, useTranslations } from "@repo/i18n"
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
import { Trash } from "@repo/ui/icons"
import { cn } from "@repo/ui/lib/utils"
import { useMutation, useQuery } from "@tanstack/react-query"
import {
  createFileRoute,
  redirect,
  stripSearchParams,
} from "@tanstack/react-router"
import { FilterDropdown } from "@/components/data-table/filter-dropdown"
import { SortableHead } from "@/components/data-table/sortable-head"
import { TablePager } from "@/components/data-table/table-pager"
import { Page } from "@/components/layout/page"
import {
  Panel,
  PanelBody,
  PanelGrid,
  PanelHeader,
  StateBadge,
} from "@/components/layout/panel"
import { RoleBadge } from "@/components/layout/role-badge"
import type { SearchQueryNavigate } from "@/hooks/search-query/types"
import { useFiltering } from "@/hooks/search-query/use-filtering"
import { usePagination } from "@/hooks/search-query/use-pagination"
import { useSorting } from "@/hooks/search-query/use-sorting"
import { useErrorHandler } from "@/hooks/use-error-handler"
import { imageUrl } from "@/lib/data-access/api"
import { deleteUser } from "@/lib/data-access/mutations"
import { listUser } from "@/lib/data-access/queries"
import { GENDER_LABEL_KEYS, ROLE_LABEL_KEYS } from "@/lib/i18n"
import { can, useAuthStore, useCan } from "@/stores/auth-store"

export const Route = createFileRoute("/(app)/users/")({
  validateSearch: userSearchQuerySchema,
  // Keep the URL clean: an empty filter array is omitted entirely rather than
  // serialized as `role=[]`. The base params (page/limit/sort/order) stay.
  search: {
    middlewares: [stripSearchParams(userSearchQueryStripDefaults)],
  },
  beforeLoad: () => {
    // Imperative gate: the client only hides what the backend already refuses.
    if (!can("user.read")) {
      throw redirect({ to: "/" })
    }
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    // Warms the cache for the render below, which owns its own loading state.
    await context.queryClient.ensureQueryData(listUser(deps))
  },
  component: RouteComponent,
})

// Derived from the label maps, so a new role/gender in the schema must grow a
// label key and therefore appears here.
const ROLE_VALUES = Object.keys(ROLE_LABEL_KEYS) as Role[]
const GENDER_VALUES = Object.keys(GENDER_LABEL_KEYS) as Gender[]

function RouteComponent() {
  const t = useTranslations("app")
  const tc = useTranslations("common")
  const format = useFormatter()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const canDelete = useCan("user.delete")
  const currentUser = useAuthStore((s) => s.user)

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
              <FilterDropdown
                groups={filterGroups}
                activeCount={activeFilterCount}
                onToggle={toggleFilter}
                onClear={() => clearFilters(["role", "gender"])}
              />
            }
          />
          <PanelBody
            className="flex-1"
            aria-busy={isPlaceholderData || undefined}
          >
            {isPending ? (
              <UsersLoading />
            ) : isError ? (
              <p role="alert" className="px-3 py-4 text-sm text-destructive">
                {t("users.error")}
              </p>
            ) : users.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                {t("users.empty")}
              </p>
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
                      {t("users.table.status")}
                    </TableHead>
                    <TableHead className="w-[150px] px-3 panel-label">
                      {t("users.table.phone")}
                    </TableHead>
                    <TableHead className="w-[130px] px-3 panel-label">
                      {t("users.table.gender")}
                    </TableHead>
                    <SortableHead
                      field="created_at"
                      activeSort={search.sort}
                      order={search.order}
                      onSort={toggleSort}
                      className="w-[130px]"
                    >
                      {t("users.table.created")}
                    </SortableHead>
                    {canDelete && (
                      <TableHead className="w-[72px] px-3 text-right">
                        <span className="sr-only">
                          {t("users.table.actions")}
                        </span>
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="px-3">
                        <div className="flex items-center gap-3">
                          <Avatar
                            className="size-8 shrink-0"
                            key={user.profile_picture || "fallback"}
                          >
                            {user.profile_picture && (
                              <AvatarImage
                                src={imageUrl.profile(user.profile_picture)}
                                alt=""
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
                      <TableCell className="px-3">
                        {user.email_verified_at ? (
                          <StateBadge tone="success">
                            {t("users.verified")}
                          </StateBadge>
                        ) : (
                          <StateBadge tone="destructive">
                            {t("users.unverified")}
                          </StateBadge>
                        )}
                      </TableCell>
                      <TableCell
                        data-mono
                        className="px-3 text-xs text-muted-foreground"
                      >
                        {user.phone ?? "—"}
                      </TableCell>
                      <TableCell className="px-3 text-sm text-muted-foreground">
                        {user.gender ? tc(GENDER_LABEL_KEYS[user.gender]) : "—"}
                      </TableCell>
                      <TableCell
                        data-mono
                        className="px-3 text-xs text-muted-foreground"
                      >
                        {format.dateTime(new Date(user.created_at), {
                          dateStyle: "short",
                        })}
                      </TableCell>
                      {canDelete && (
                        <TableCell className="px-3 text-right">
                          <DeleteUserDialog
                            user={user}
                            disabled={user.id === currentUser?.id}
                          />
                        </TableCell>
                      )}
                    </TableRow>
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
      </PanelGrid>
    </Page>
  )
}

/** Same loading shape as the example route's table, matching the row above. */
function UsersLoading() {
  const t = useTranslations("app")
  const canDelete = useCan("user.delete")

  return (
    <>
      <p role="status" className="sr-only">
        {t("users.loading")}
      </p>
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
              {t("users.table.status")}
            </TableHead>
            <TableHead className="w-[150px] px-3 panel-label">
              {t("users.table.phone")}
            </TableHead>
            <TableHead className="w-[130px] px-3 panel-label">
              {t("users.table.gender")}
            </TableHead>
            <TableHead className="w-[130px] px-3 panel-label">
              {t("users.table.created")}
            </TableHead>
            {canDelete && <TableHead className="w-[72px] px-3" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows
            <TableRow key={i}>
              <TableCell className="px-3 py-3">
                <div className="flex items-center gap-3">
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
                <Skeleton className="h-5 w-20" />
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
              {canDelete && (
                <TableCell className="flex justify-end px-3 py-3">
                  <Skeleton className="h-8 w-8" />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}

function DeleteUserDialog({
  user,
  disabled,
}: {
  user: User
  disabled: boolean
}) {
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
            disabled={disabled}
            title={disabled ? t("users.selfDeleteDisabled") : undefined}
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
