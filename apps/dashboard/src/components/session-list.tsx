import { useFormatter, useTranslations } from "@repo/i18n"
import type { SessionEntry } from "@repo/schemas/auth"
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
import { Button } from "@repo/ui/components/button"
import { Skeleton } from "@repo/ui/components/skeleton"
import toast from "@repo/ui/components/toast"
import { Logout } from "@repo/ui/icons"
import { cn } from "@repo/ui/lib/utils"
import { parseUA } from "@repo/utils/parser"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useErrorHandler } from "@/hooks/use-error-handler"
import { revokeSession, revokeUserSessions } from "@/lib/data-access/mutations"
import { listUserSessions } from "@/lib/data-access/queries"

interface SessionListProps {
  userId: string
  canRevoke: boolean
  showRevokeAll?: boolean
  className?: string
}

/**
 * Active sessions for one user. Self-contained (no Panel wrapper) so it can be
 * embedded inside a Panel by its callers. Copy lives under `common.sessions.*`.
 */
export function SessionList({
  userId,
  canRevoke,
  showRevokeAll = false,
  className,
}: SessionListProps) {
  const t = useTranslations("common")
  const { data, isPending, isError } = useQuery(listUserSessions(userId))

  if (isPending) return <SessionListLoading className={className} />

  if (isError) {
    return (
      <p
        role="alert"
        className={cn("px-3 py-4 text-sm text-destructive", className)}
      >
        {t("sessions.error")}
      </p>
    )
  }

  const sessions = data ?? []

  if (sessions.length === 0) {
    return (
      <p className={cn("px-3 py-4 text-sm text-muted-foreground", className)}>
        {t("sessions.empty")}
      </p>
    )
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {showRevokeAll && (
        <div className="flex justify-end border-b border-border px-3 py-2">
          <RevokeAllDialog userId={userId} />
        </div>
      )}
      <ul className="divide-y divide-border">
        {sessions.map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            canRevoke={canRevoke}
          />
        ))}
      </ul>
    </div>
  )
}

/** Browser + OS, with a fallback for UAs bowser cannot name. */
function describeDevice(raw: string, fallback: string) {
  const { browser, os } = parseUA(raw)
  const browserText = [browser.name, browser.version].filter(Boolean).join(" ")
  const osText = [os.name, os.version].filter(Boolean).join(" ")

  return {
    title: browserText || osText || fallback,
    subtitle: browserText && osText ? osText : null,
  }
}

function SessionRow({
  session,
  canRevoke,
}: {
  session: SessionEntry
  canRevoke: boolean
}) {
  const t = useTranslations("common")
  const format = useFormatter()
  const device = describeDevice(session.user_agent, t("sessions.unknownDevice"))

  return (
    <li className="flex items-start gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{device.title}</p>
        {device.subtitle && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {device.subtitle}
          </p>
        )}
        <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
          <span className="text-muted-foreground/60">
            {t("sessions.ipLabel")}
          </span>{" "}
          {session.ip_addr}
        </p>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <SessionMeta
            label={t("sessions.signedIn")}
            value={format.dateTime(new Date(session.created_at), {
              dateStyle: "short",
              timeStyle: "short",
            })}
          />
          <SessionMeta
            label={t("sessions.lastActive")}
            value={format.dateTime(new Date(session.accessed_at), {
              dateStyle: "short",
              timeStyle: "short",
            })}
          />
          <SessionMeta
            label={t("sessions.expires")}
            value={format.dateTime(new Date(session.expires_at), {
              dateStyle: "short",
              timeStyle: "short",
            })}
          />
        </p>
      </div>
      {canRevoke && <RevokeSessionDialog sessionId={session.id} />}
    </li>
  )
}

function SessionMeta({ label, value }: { label: string; value: string }) {
  return (
    <span className="whitespace-nowrap">
      {label}{" "}
      <span className="font-mono tabular-nums text-foreground/80">
        {value}
      </span>
    </span>
  )
}

function RevokeSessionDialog({ sessionId }: { sessionId: string }) {
  const t = useTranslations("common")
  const handleError = useErrorHandler()
  const { mutateAsync, isPending } = useMutation(revokeSession)

  const handleRevoke = async () =>
    mutateAsync(sessionId, {
      onSuccess: () => toast.success(t("sessions.revoked")),
      onError: (e) => handleError(e),
    })

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="destructive"
            size="icon-sm"
            title={t("sessions.revoke")}
            aria-label={t("sessions.revoke")}
          >
            <Logout />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("sessions.revokeConfirmTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("sessions.revokeConfirmDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending} variant="outline">
            {t("actions.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            loading={isPending}
            variant="destructive"
            onClick={handleRevoke}
          >
            {t("sessions.revoke")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function RevokeAllDialog({ userId }: { userId: string }) {
  const t = useTranslations("common")
  const handleError = useErrorHandler()
  const { mutateAsync, isPending } = useMutation(revokeUserSessions)

  const handleRevokeAll = async () =>
    mutateAsync(userId, {
      onSuccess: () => toast.success(t("sessions.revokedAll")),
      onError: (e) => handleError(e),
    })

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="outline" size="sm">
            {t("sessions.revokeAll")}
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("sessions.revokeAllConfirmTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("sessions.revokeAllConfirmDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending} variant="outline">
            {t("actions.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            loading={isPending}
            variant="destructive"
            onClick={handleRevokeAll}
          >
            {t("sessions.revokeAll")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Same loading shape as the users table's skeleton rows. */
function SessionListLoading({ className }: { className?: string }) {
  const t = useTranslations("common")

  return (
    <div className={cn("flex flex-col", className)}>
      <p role="status" className="sr-only">
        {t("sessions.loading")}
      </p>
      <div className="divide-y divide-border">
        {Array.from({ length: 3 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows
          <div key={i} className="flex items-start gap-3 px-3 py-2.5">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="size-8 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
