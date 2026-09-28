import { useCanGoBack, useRouter } from "@tanstack/react-router"
import type { FileRouteTypes } from "@/routeTree.gen"

export function useNavigateBack(fallback: FileRouteTypes["to"]) {
  const router = useRouter()
  const canGoBack = useCanGoBack()

  const navigateBack = () => {
    if (canGoBack) {
      router.history.back()
    } else {
      router.navigate({ to: fallback })
    }
  }

  return navigateBack
}
