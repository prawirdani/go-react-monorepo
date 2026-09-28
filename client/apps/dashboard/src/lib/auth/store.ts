import type { APIErrorCodes } from "@repo/api/errors"
import { create } from "zustand"

// The presented session is dead — stop and re-authenticate. Covers an expired
// or absent session, and a token the backend has revoked or blacklisted
// (`AUTH_INVALID`).
export const REDIRECT_ERROR_CODES = new Set<APIErrorCodes>([
  "REQ_UNAUTHORIZED",
  "AUTH_EXPIRED",
  "AUTH_INVALID",
  "AUTH_INVALID_SESSION",
])

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
