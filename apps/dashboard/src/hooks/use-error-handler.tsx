import { type APIError, parseAPIError } from "@repo/api/errors"
import toast from "@repo/ui/components/toast"
import { useCallback } from "react"
import { REDIRECT_ERROR_CODES } from "@/lib/auth"
import { useAuthStore } from "@/stores/auth-store"

// ---------- GLOBAL SINGLE-FLIGHT STATE ----------
let redirectLatch: Promise<void> | null = null

const toastGate = new Map<string, number>()
const TOAST_COOLDOWN_MS = 2000

// ---------- PUBLIC HOOK ----------

export const useErrorHandler = () => {
  const setExpired = useAuthStore((s) => s.setExpired)

  return useCallback(
    (error: unknown, override?: (e: APIError) => boolean) => {
      const e = parseAPIError(error)

      if (REDIRECT_ERROR_CODES.has(e.code)) {
        if (!redirectLatch) {
          redirectLatch = Promise.resolve().then(() => {
            // NOTE:trigger AuthStateWatcher for redirection
            setExpired()
          })
        }

        return
      }

      // override callback, stop if its handled
      if (override && override(e) === true) return

      // toast fallback
      const now = Date.now()
      const last = toastGate.get(e.code) ?? 0

      if (now - last < TOAST_COOLDOWN_MS) return

      toastGate.set(e.code, now)
      // TODO: Readable/prettified message?
      toast.error("Oops!", { description: e.message, duration: 6000 })
    },
    [setExpired],
  )
}
