import { useTranslations } from "@repo/i18n"
import toast from "@repo/ui/components/toast"
import { useRouter } from "@tanstack/react-router"
import { useEffect, useRef } from "react"
import { useAuthStore } from "@/stores/auth-store"

export function AuthStateWatcher() {
  const status = useAuthStore((s) => s.status)
  const router = useRouter()
  const t = useTranslations("app")
  const hasHandled = useRef(false) // track if we already handled expiration

  // `t` is stable per locale; keeping it out of deps preserves the original
  // single-fire behaviour when the store status changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: translator identity is locale-stable
  useEffect(() => {
    if (status === "expired" && !hasHandled.current) {
      router.navigate({ to: "/auth/login", replace: true })
      toast.error(t("errors.sessionExpiredTitle"), {
        description: t("errors.sessionExpiredMessage"),
        duration: 8000, // 8s
        closeButton: true,
      })
    } else if (status !== "expired") {
      hasHandled.current = false
    }
  }, [status, router])

  return null
}
