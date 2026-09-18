import type { APIErrorCodes } from "@repo/api/errors"
import { create } from "zustand"

export const REDIRECT_ERROR_CODES = new Set<APIErrorCodes>([
  "REQ_UNAUTHORIZED",
  "AUTH_EXPIRED",
  "AUTH_INVALID_SESSION",
])

/**
 * Thrown when a user authenticates successfully but lacks the required roles
 * for this specific application (e.g., non-admin attempting to access the Dashboard).
 * DESIGN RATIONALE:
 * Since the backend '/auth/login' is a shared entry point without role-gatekeeping,
 * we perform a "Gatekeeper" check in the client after identity is confirmed.
 * If access is denied, we intentionally call '/logout' to destroy the server session
 * (httpOnly cookies) and wipe local state.
 * SECURITY NOTE:
 * This is primarily for User Experience. Real security is still enforced by the
 * backend, which will reject unauthorized resource requests with a 403 even if
 * this client-side check is bypassed.
 */
export class ForbiddenAccessError extends Error {
  constructor() {
    super("Forbidden Access")
    // This fix ensures 'instanceof' works correctly across all environments
    Object.setPrototypeOf(this, ForbiddenAccessError.prototype)
  }
}

type AuthStateStatus =
  | "initial" // app start / hydrate
  | "unauthenticated" // logged out
  | "authenticating" // login in / identifying
  | "authenticated" // logged in
  | "expired"

/**
 * Session *lifecycle* only. Identity and permissions are server data and live
 * in `getSession` (`@/lib/data-access/queries`) — holding a second copy here is
 * how the two end up disagreeing (e.g. `expired` beside a live identity).
 */
type AuthState = {
  status: AuthStateStatus

  setAuthenticating: () => void
  setAuthenticated: () => void
  setUnauthenticated: () => void
  setExpired: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  status: "initial",

  setAuthenticating: () => set({ status: "authenticating" }),
  // Status-only transitions: identity is retained in the auth cache so the
  // authenticated layout can finish its exit animation. `clearSession` drops
  // it once the navigation off the layout has resolved.
  setAuthenticated: () => set({ status: "authenticated" }),
  setUnauthenticated: () => set({ status: "unauthenticated" }),
  setExpired: () => set({ status: "expired" }),
}))
