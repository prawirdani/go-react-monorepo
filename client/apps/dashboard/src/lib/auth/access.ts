import { AUTH_KEY, type AuthSession } from "@repo/queries"
import type { Permission } from "@repo/schemas/permission"
import { useQuery } from "@tanstack/react-query"
import { redirect } from "@tanstack/react-router"
import { useAuthStore } from "@/lib/auth/store"
import { getSession } from "@/lib/data-access/queries"
import { queryClient } from "@/lib/query-client"

/**
 * Imperative permission check for non-render callers (router `beforeLoad`,
 * event handlers). Fails closed: an unpopulated cache denies. Client gate is
 * UX only — the backend enforces with 403.
 */
export function can(permission: Permission): boolean {
  return (
    queryClient
      .getQueryData<AuthSession>([AUTH_KEY])
      ?.permissions.includes(permission) ?? false
  )
}

/** Reactive `can` for render-time gating. */
export function useCan(permission: Permission): boolean {
  const { data } = useQuery(getSession)
  return data?.permissions.includes(permission) ?? false
}

/** Route↔permission pairs, named so nav and guards read one source. */
export const ACCESS = {
  users: "user.read",
} as const satisfies Record<string, Permission>

type Gate = { location: { href: string } }

/**
 * Session gate for the authenticated layout. Keys on `status`, not the session
 * cache: during the logout transition the cache is deliberately retained so the
 * layout can animate out, and a cache-based check would let the user back in.
 */
export function requireSession({ location }: Gate) {
  if (useAuthStore.getState().status !== "authenticated") {
    throw redirect({
      to: "/auth/login",
      search: { redirect: location.href },
    })
  }
}

/**
 * Permission gate. Denial is a surfaced 403, not a silent bounce: the user is
 * signed in, so they should learn the screen exists and they lack access.
 */
export function requirePermission(permission: Permission, { location }: Gate) {
  if (!can(permission)) {
    throw redirect({
      to: "/forbidden",
      search: { from: location.href },
    })
  }
}

/** Route-shaped form: `beforeLoad: guard(ACCESS.users)` */
export function guard(permission: Permission) {
  return (args: Gate) => requirePermission(permission, args)
}
