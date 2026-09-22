import { dayEndIso, dayStartIso } from "@repo/utils/date"
import { useMemo } from "react"
import type { SearchQuery, SearchQueryNavigate } from "./types"

/**
 * Date mutators.
 *
 * `date` carries a UTC datetime derived from the client's local day — never a
 * date-only value. The backend resolves `date`/`from`/`to` in UTC, so a
 * date-only `date=2026-09-01` would be read as the UTC day and shift the window
 * by the client's offset. A WIB (UTC+7) user picking 1 Sept instead sends
 * `date=2026-08-31T17:00:00.000Z` (their local midnight as a UTC instant). An
 * explicit `from`/`to` range stays a separate mode.
 *
 * The current values come from the VALIDATED query, not the router's raw
 * `prev`: the schema `.catch("")`s each date field, so they are always strings
 * even when the param is absent. Only `prev` is spread, to keep unrelated
 * params (role, gender, sort…) intact. Reading them lets us skip a redundant
 * navigation when the applied filter would not change.
 */
export function useDateFiltering(
  search: SearchQuery,
  navigate: SearchQueryNavigate,
) {
  const currentDate = search.date as string
  const currentFrom = search.from as string
  const currentTo = search.to as string

  return useMemo(
    () => ({
      /** A single local day, sent as the UTC instant its local midnight is. */
      setDate: (day: string) => {
        const date = dayStartIso(day)
        if (currentDate === date && !currentFrom && !currentTo) return
        navigate({
          search: (prev) => ({
            ...prev,
            date,
            from: "",
            to: "",
            page: 1,
          }),
        })
      },
      /** Explicit range: local day boundaries as UTC datetimes; `date` cleared. */
      setRange: (range: { from?: string; to?: string }) => {
        const from = range.from ? dayStartIso(range.from) : ""
        const to = range.to ? dayEndIso(range.to) : ""
        if (!currentDate && currentFrom === from && currentTo === to) return
        navigate({
          search: (prev) => ({
            ...prev,
            date: "",
            from,
            to,
            page: 1,
          }),
        })
      },
      clearDate: () => {
        if (!currentDate && !currentFrom && !currentTo) return
        navigate({
          search: (prev) => ({
            ...prev,
            date: "",
            from: "",
            to: "",
            page: 1,
          }),
        })
      },
    }),
    [navigate, currentDate, currentFrom, currentTo],
  )
}
