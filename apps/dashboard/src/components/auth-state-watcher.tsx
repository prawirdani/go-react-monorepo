import toast from "@repo/ui/components/toast"
import { useRouter } from "@tanstack/react-router"
import { useEffect, useRef } from "react"
import { useAuthStore } from "@/stores/auth-store"

export function AuthStateWatcher() {
  const status = useAuthStore((s) => s.status)
  const router = useRouter()
  const hasHandled = useRef(false) // track if we already handled expiration

  useEffect(() => {
    if (status === "expired" && !hasHandled.current) {
      router.navigate({ to: "/login", replace: true })
      toast.error("Sesi Kedaluwarsa", {
        description:
          "Sesi Anda telah berakhir. Silakan login kembali untuk melanjutkan.",
        duration: 8000, // 8s
        closeButton: true,
      })
    } else if (status !== "expired") {
      hasHandled.current = false
    }
  }, [status, router])

  return null
}
