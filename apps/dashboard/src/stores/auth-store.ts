import type { APIErrorCodes } from "@repo/api/errors"
import type { LoginInput } from "@repo/schemas/auth"
import type { User } from "@repo/schemas/user"
import { create } from "zustand"
import { authAPI } from "@/lib/api"

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

type AuthState = {
  user: User | null
  status: AuthStateStatus

  setAuthenticating: () => void
  setAuthenticated: (user: User) => void
  setUnauthenticated: () => void
  setExpired: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  status: "initial",

  setAuthenticating: () => set({ status: "authenticating" }),
  setAuthenticated: (user) => set({ status: "authenticated", user }),
  setUnauthenticated: () => set({ status: "unauthenticated", user: null }), // TODO: Maybe preserve the user data to prevent the Header race condition on logout
  setExpired: () => set({ status: "expired", user: null }),
}))

export const authActions = {
  identifyUser: async () => {
    const { setAuthenticating, setAuthenticated, setUnauthenticated } =
      useAuthStore.getState()

    setAuthenticating()
    try {
      const user = await authAPI.identify()
      setAuthenticated(user)
    } catch (e) {
      setUnauthenticated()
      throw e
    }
  },

  invalidate: async () => {
    const { setAuthenticated, setUnauthenticated } = useAuthStore.getState()
    try {
      const user = await authAPI.identify()
      setAuthenticated(user)
    } catch (e) {
      setUnauthenticated()
      throw e
    }
  },

  login: async (input: LoginInput) => {
    await authAPI.login(input)
    await authActions.identifyUser()

    // NOTE: Uncomment if using RBAC with single login entrypoint for multiple app
    // Check permissions immediately after identifying
    // const { user, setUnauthenticated } = useAuthStore.getState()
    // if (user && !hasPermissionToAccess(user)) {
    //   // Wipe the cookies on the server
    //   await authAPI.logout()
    //   // Wipe the local state
    //   setUnauthenticated()
    //
    //   throw new ForbiddenAccessError()
    // }
  },

  logout: async () => {
    await authAPI.logout()
    useAuthStore.getState().setUnauthenticated()
  },
}

// export function hasPermissionToAccess(user: User): boolean {
//   return user.role === "admin"
// }
