import {
  type APIError,
  type APIErrorCodes,
  type ErrorDescriptor,
  type ErrorMap,
  parseAPIError,
} from "@repo/api/errors"
import { type MessageKeys, useFormatter, useTranslations } from "@repo/i18n"
import toast from "@repo/ui/components/toast"
import { useCallback } from "react"
import { REDIRECT_ERROR_CODES, useAuthStore } from "@/stores/auth-store"

// ---------- GLOBAL SINGLE-FLIGHT STATE ----------
let redirectLatch: Promise<void> | null = null

const toastGate = new Map<string, number>()
const TOAST_COOLDOWN_MS = 2000

type ErrorHandlers = {
  [K in APIErrorCodes]?: (e: ErrorDescriptor<K, ErrorMap[K]>) => void
}

/**
 * Server text cannot be translated client-side, so user-facing toasts are
 * keyed off the error code instead. An unmapped code falls back to a generic
 * localized message rather than leaking the backend string.
 */
const CODE_MESSAGES: Partial<Record<APIErrorCodes, MessageKeys<"app">>> = {
  VALIDATION: "errors.codes.validation",
  AUTH_CREDENTIALS: "errors.codes.credentials",
  AUTH_EXPIRED: "errors.codes.expired",
  AUTH_INVALID_SESSION: "errors.codes.invalidSession",
  AUTH_INVALID_RECOV_TOKEN: "errors.codes.invalidRecoveryToken",
  AUTH_INVALID_REGISTRATION_TOKEN: "errors.codes.invalidRecoveryToken",
  RESOURCE_NOT_FOUND: "errors.codes.notFound",
  USER_EMAIL_CONFLICT: "errors.codes.emailConflict",
  REQ_UNAUTHORIZED: "errors.codes.unauthorized",
  REQ_FORBIDDEN: "errors.codes.forbidden",
  NETWORK_ERROR: "errors.codes.network",
  SERVER_TIMEOUT: "errors.codes.timeout",
  INTERNAL: "errors.codes.internal",
  UNKNOWN_ERROR: "errors.generic",
}

export const useErrorHandler = () => {
  const setExpired = useAuthStore((s) => s.setExpired)
  const t = useTranslations("app")
  const formatter = useFormatter()

  return useCallback(
    (error: unknown, handlers?: ErrorHandlers) => {
      const e = parseAPIError(error)

      if (REDIRECT_ERROR_CODES.has(e.code)) {
        if (!redirectLatch) {
          redirectLatch = Promise.resolve().then(() => {
            setExpired()
          })
        }
        return
      }

      const handler = handlers?.[e.code] as ((e: APIError) => void) | undefined

      if (handler) {
        handler(e)
        return
      }

      const now = Date.now()
      const last = toastGate.get(e.code) ?? 0
      if (now - last < TOAST_COOLDOWN_MS) return
      toastGate.set(e.code, now)

      const description =
        e.code === "AUTH_RECOVERY_THROTTLED"
          ? `${t("errors.codes.recoveryThrottled")} ${formatter.dateTime(
              new Date(e.details.retry_after),
              {
                dateStyle: "short",
                timeStyle: "short",
              },
            )}`
          : t(CODE_MESSAGES[e.code] ?? "errors.generic")

      toast.error(t("errors.title"), { description, duration: 6000 })
    },
    [setExpired, t, formatter],
  )
}
