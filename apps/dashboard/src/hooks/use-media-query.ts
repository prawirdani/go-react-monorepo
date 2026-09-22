import { useEffect, useState } from "react"

/**
 * Tracks a media query. Reads it synchronously in the state initializer so a
 * client-only SPA paints the correct branch on the very first render — no flash
 * of the wide layout before the listener swaps it.
 *
 * Dashboard-local on purpose: it has one call site, and adding a new `@repo/ui`
 * exports subpath would require a dev-server restart (see AGENTS.md).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    // Resync once: the query may have changed between render and effect.
    onChange()
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [query])

  return matches
}
