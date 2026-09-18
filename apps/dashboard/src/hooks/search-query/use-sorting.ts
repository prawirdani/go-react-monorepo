import { useMemo } from "react"
import type { SearchQuery, SearchQueryNavigate } from "./types"

/**
 * `toggleSort` pins `sort` to the given field, flips `order`, and resets to
 * page 1. `order` comes from the validated query — the raw `prev` may omit it,
 * which would leave the toggle hinging on `undefined === "asc"`.
 */
export function useSorting<S extends SearchQuery>(
  search: S,
  navigate: SearchQueryNavigate,
) {
  const order = search.order

  return useMemo(
    () => ({
      toggleSort: (field: S["sort"]) => {
        navigate({
          search: (prev) => ({
            ...prev,
            sort: field,
            order: order === "asc" ? "desc" : "asc",
            page: 1,
          }),
        })
      },
    }),
    [navigate, order],
  )
}
