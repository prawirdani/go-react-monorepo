import { useTranslations } from "@repo/i18n"
import toast from "@repo/ui/components/toast"
import { useNavigate } from "@tanstack/react-router"
import { useEffect, useRef } from "react"
import { authActions } from "@/lib/auth/session"
import { useAuthStore } from "@/lib/auth/store"

/**
 * The only redirect that lives outside the route tree: a session ends
 * mid-navigation, so no `beforeLoad` gets a chance to run. Mounted inside the
 * authenticated layout, so it exists only while there is an authed area to
 * leave — no pathname sniffing needed to avoid bouncing off `/auth/login`.
 */
export function SessionEndedWatcher() {
  const status = useAuthStore((s) => s.status)
  const navigate = useNavigate()
  const t = useTranslations("app")
  const hasHandled = useRef(false)

  useEffect(() => {
    if (status !== "expired" && status !== "unauthenticated") {
      hasHandled.current = false
      return
    }
    if (hasHandled.current) return
    hasHandled.current = true

    if (status === "expired") {
      toast.error(t("errors.sessionExpiredTitle"), {
        description: t("errors.sessionExpiredMessage"),
        duration: 8000, // 8s
        closeButton: true,
      })
    }

    // Leave the authenticated area first, then drop identity: the header and any
    // open dialog must stay mounted through the transition, otherwise they
    // blank a frame / lose their exit animation.
    navigate({ to: "/auth/login", replace: true }).then(() =>
      authActions.clearSession(),
    )
  }, [status, navigate, t])

  return null
}
