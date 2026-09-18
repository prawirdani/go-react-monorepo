import { useMemo } from "react"
import type { SearchQuery, SearchQueryNavigate } from "./types"

/**
 * `toggleSort` pins `sort` to the given field, flips `order`, and resets to
 * page 1. `_search` is the type source for `S`: it binds the route's query so
 * `toggleSort` accepts the domain's literal sort union, not `string`.
 */
export function useSorting<S extends SearchQuery>(
  _search: S,
  navigate: SearchQueryNavigate,
) {
  return useMemo(
    () => ({
      toggleSort: (field: S["sort"]) => {
        navigate({
          search: (prev) => ({
            ...prev,
            sort: field,
            order: prev.order === "asc" ? "desc" : "asc",
            page: 1,
          }),
        })
      },
    }),
    [navigate],
  )
}
