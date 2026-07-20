import {
  type APIError,
  type APIErrorCodes,
  type ErrorDescriptor,
  type ErrorMap,
  parseAPIError,
} from "@repo/api/errors"
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

export const useErrorHandler = () => {
  const setExpired = useAuthStore((s) => s.setExpired)
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
      const description = e.message.charAt(0).toUpperCase() + e.message.slice(1)
      toast.error("Oops!", { description, duration: 6000 })
    },
    [setExpired],
  )
}
