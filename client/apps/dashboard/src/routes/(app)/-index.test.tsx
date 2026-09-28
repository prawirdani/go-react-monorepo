import { AUTH_KEY } from "@repo/queries"
import { AUDIT_SEARCH_DEFAULTS } from "@repo/schemas/audit"
import { afterEach, describe, expect, it, vi } from "vitest"
import { queryClient } from "@/lib/query-client"
import { hasNonDefaultAuditSearch, Route, STRIP_DEFAULTS } from "./index"

/**
 * The regressions this file guards, none of them visible from the panel:
 *
 * 1. the audit prefetch is declared on the dashboard route, so an ungated loader
 *    fires for visitors who cannot render the panel and the backend answers 403;
 * 2. the audit filters are part of this route's search, so a user without
 *    `audit.read` keeps a dead `?entity=…` in their URL.
 *
 * The URL rewrite itself is a router navigation and is not asserted here: a
 * headless `RouterProvider` never settles a navigation (the router matches and
 * renders, but `navigate` leaves `location.href` unchanged), so these tests
 * cover the gate and the two decisions the rewrite depends on.
 */
function runLoader(permissions: string[] | null) {
  if (permissions) queryClient.setQueryData([AUTH_KEY], { permissions })
  else queryClient.removeQueries({ queryKey: [AUTH_KEY] })

  // `can` reads the app's `queryClient` singleton, not the router context, so
  // the session has to be seeded there for the gate to be exercised at all.
  const prefetch = vi.spyOn(queryClient, "prefetchQuery")
  const loader = Route.options.loader as (args: {
    context: { queryClient: typeof queryClient }
    deps: Record<string, unknown>
  }) => unknown

  loader({ context: { queryClient }, deps: {} })

  return prefetch
}

afterEach(() => {
  vi.restoreAllMocks()
  queryClient.clear()
})

describe("dashboard index audit prefetch", () => {
  it("skips the request without audit.read", () => {
    expect(runLoader(["user.read"])).not.toHaveBeenCalled()
  })

  it("skips the request when the session is not cached", () => {
    expect(runLoader(null)).not.toHaveBeenCalled()
  })

  it("prefetches for an admin", () => {
    expect(runLoader(["audit.read"])).toHaveBeenCalledOnce()
  })
})

describe("dashboard index audit search params", () => {
  it("strips every param the route can serialize", () => {
    // The bug: the shared filter strip map covers filters only, so a navigation
    // back to defaults still serialized `?page=&limit=&sort=&order=`.
    expect(Object.keys(STRIP_DEFAULTS).sort()).toEqual(
      Object.keys(AUDIT_SEARCH_DEFAULTS).sort(),
    )
  })

  it("ignores a search already at its defaults", () => {
    expect(hasNonDefaultAuditSearch(AUDIT_SEARCH_DEFAULTS)).toBe(false)
  })

  it("treats an absent key as its default", () => {
    // The middleware drops default-valued keys from what it serializes, so a
    // missing key must not read as "changed" or the rewrite would never settle.
    const { entity: _entity, ...withoutEntity } = AUDIT_SEARCH_DEFAULTS
    expect(
      hasNonDefaultAuditSearch(withoutEntity as typeof AUDIT_SEARCH_DEFAULTS),
    ).toBe(false)
  })

  it("sees a filter from a shared link", () => {
    expect(
      hasNonDefaultAuditSearch({
        ...AUDIT_SEARCH_DEFAULTS,
        entity: ["user"],
      }),
    ).toBe(true)
  })

  it("sees a non-default base param", () => {
    expect(
      hasNonDefaultAuditSearch({ ...AUDIT_SEARCH_DEFAULTS, page: 2 }),
    ).toBe(true)
  })
})
