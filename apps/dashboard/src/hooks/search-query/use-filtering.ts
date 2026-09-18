import { useMemo } from "react"
import type { SearchQuery, SearchQueryNavigate } from "./types"

/**
 * The router hands the functional `search` updater the RAW parsed search, not
 * the validated one: absent array params arrive as `undefined`, and a
 * hand-edited URL can yield a string. Filtering is the only concern that reads
 * array params, so the normalizer lives here.
 */
function asArray<T = string>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

/** Filter mutators: every toggle and clear resets to page 1. */
export function useFiltering(
  search: SearchQuery,
  navigate: SearchQueryNavigate,
) {
  return useMemo(
    () => ({
      toggleFilter: (key: string, value: string, on: boolean) => {
        navigate({
          search: (prev) => {
            const current = asArray(prev[key] ?? search[key])
            return {
              ...prev,
              [key]: on
                ? [...current, value]
                : current.filter((entry) => entry !== value),
              page: 1,
            }
          },
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
