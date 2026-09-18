import { useMemo } from "react"
import type { SearchQuery, SearchQueryNavigate } from "./types"

/**
 * Filter mutators: every toggle and clear resets to page 1.
 *
 * The current selection is read from the VALIDATED query — the schema
 * `.catch([])`s every filter, so it is always an array. The router's raw `prev`
 * is unsafe to read for arrays (an absent param arrives `undefined`); it is
 * only spread.
 */
export function useFiltering(
  search: SearchQuery,
  navigate: SearchQueryNavigate,
) {
  return useMemo(
    () => ({
      toggleFilter: (key: string, value: string, on: boolean) => {
        const current = search[key] as string[]
        navigate({
          search: (prev) => ({
            ...prev,
            [key]: on
              ? [...current, value]
              : current.filter((entry) => entry !== value),
            page: 1,
          }),
        })
      },
      clearFilters: (keys: string[]) => {
        navigate({
          search: (prev) => ({
            ...prev,
            ...Object.fromEntries(keys.map((key) => [key, []])),
            page: 1,
          }),
        })
      },
    }),
    [navigate, search],
  )
}
