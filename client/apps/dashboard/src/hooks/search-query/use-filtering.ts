import { useMemo } from "react"
import type { SearchQueryNavigate } from "./types"

/**
 * Filter mutators: every change and clear resets to page 1.
 *
 * A filter is written as `undefined` when nothing is selected, which drops the
 * param from the URL — that is what "Semua" means on both sides: no filter for
 * that group. The router's raw `prev` is only spread; its absent params are
 * `undefined` and unsafe to read.
 */
export function useFiltering(navigate: SearchQueryNavigate) {
  return useMemo(
    () => ({
      // A multi group passes its whole selection; a radio group passes the one
      // chosen value. Either way, nothing selected means the param is dropped.
      setFilter: (key: string, value: string[] | string | undefined) => {
        const empty = Array.isArray(value) && value.length === 0
        navigate({
          search: (prev) => ({
            ...prev,
            [key]: empty ? undefined : value,
            page: 1,
          }),
        })
      },
      clearFilters: (keys: string[]) => {
        navigate({
          search: (prev) => ({
            ...prev,
            ...Object.fromEntries(keys.map((key) => [key, undefined])),
            page: 1,
          }),
        })
      },
    }),
    [navigate],
  )
}
