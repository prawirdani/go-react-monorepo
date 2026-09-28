import { useMemo } from "react"
import type { SearchQuery, SearchQueryNavigate } from "./types"

/**
 * Paging mutators: `setLimit` resets to page 1, `setPage` does not.
 * `_search` keeps the signature uniform across the three concerns — paging never
 * reads the query, it only rewrites two of its params.
 */
export function usePagination(
  _search: SearchQuery,
  navigate: SearchQueryNavigate,
) {
  return useMemo(
    () => ({
      setPage: (page: number) => {
        navigate({ search: (prev) => ({ ...prev, page }) })
      },
      setLimit: (limit: number) => {
        navigate({ search: (prev) => ({ ...prev, limit, page: 1 }) })
      },
    }),
    [navigate],
  )
}
