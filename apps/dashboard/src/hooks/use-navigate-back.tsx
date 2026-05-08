import { useCanGoBack, useRouter } from "@tanstack/react-router"
import type { FileRoutesByFullPath } from "@/routeTree.gen"

export function useNavigateBack(fallback: keyof FileRoutesByFullPath) {
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
