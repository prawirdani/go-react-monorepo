import type { User } from "@repo/schemas/user"
import { create } from "zustand"

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
