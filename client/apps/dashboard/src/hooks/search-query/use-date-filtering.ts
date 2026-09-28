import { isValidTimeZone } from "@repo/schemas/search-query"
import { useMemo } from "react"
import type { SearchQuery, SearchQueryNavigate } from "./types"

/** The caller's IANA zone, or "" when the platform will not name one. */
function detectTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    return isValidTimeZone(tz) ? tz : ""
  } catch {
    return ""
  }
}

/**
 * Date mutators.
 *
 * A picked day travels as a bare calendar day (`YYYY-MM-DD`) plus the IANA zone
 * it was picked in. The server, not the client, resolves the offsets — it reads
 * the bounds in `tz`, falling back to UTC when the zone is absent or unknown.
 * `date` is the single-day shortcut and wins over an explicit `from`/`to` range.
 *
 * The current values come from the VALIDATED query, not the router's raw
 * `prev`: the schema `.catch("")`s each date field, so they are always strings
 * even when the param is absent. Only `prev` is spread, to keep unrelated
 * params (role, gender, sort…) intact. Reading them lets us skip a redundant
 * navigation when the applied filter would not change — including a change of
 * zone, which would otherwise leave a stale `tz` in place.
 */
export function useDateFiltering(
  search: SearchQuery,
  navigate: SearchQueryNavigate,
) {
  const currentDate = search.date as string
  const currentFrom = search.from as string
  const currentTo = search.to as string
  const currentTz = search.tz as string
  const tz = useMemo(detectTimeZone, [])

  return useMemo(
    () => ({
      /** A single picked day, sent verbatim; the server reads it in `tz`. */
      setDate: (day: string) => {
        if (
          currentDate === day &&
          !currentFrom &&
          !currentTo &&
          currentTz === tz
        )
          return
        navigate({
          search: (prev) => ({
            ...prev,
            date: day,
            from: "",
            to: "",
            tz,
            page: 1,
          }),
        })
      },
      /** Explicit range of bare days; `date` cleared. */
      setRange: (range: { from?: string; to?: string }) => {
        const from = range.from ?? ""
        const to = range.to ?? ""
        if (
          !currentDate &&
          currentFrom === from &&
          currentTo === to &&
          currentTz === tz
        )
          return
        navigate({
          search: (prev) => ({
            ...prev,
            date: "",
            from,
            to,
            tz,
            page: 1,
          }),
        })
      },
      clearDate: () => {
        if (!currentDate && !currentFrom && !currentTo && !currentTz) return
        navigate({
          search: (prev) => ({
            ...prev,
            date: "",
            from: "",
            to: "",
            tz: "",
            page: 1,
          }),
        })
      },
    }),
    [navigate, currentDate, currentFrom, currentTo, currentTz, tz],
  )
}
