import { AUTH_KEY } from "@repo/queries"
import type { LoginInput } from "@repo/schemas/auth"
import { useAuthStore } from "@/lib/auth/store"
import { authAPI } from "@/lib/data-access/api"
import { getSession } from "@/lib/data-access/queries"
import { queryClient } from "@/lib/query-client"

/**
 * Session lifecycle actions. Imperative by nature: boot/login/logout bracket
 * the cookie's existence, and the 401 interceptor reports expiry from outside
 * React. Identity itself lives in `getSession` — these only populate or drop it.
 */
export const authActions = {
  /** Boot: fill the session cache, then reflect it in `status`. */
  boot: async () => {
    const { setAuthenticating, setAuthenticated, setUnauthenticated } =
      useAuthStore.getState()
    setAuthenticating()
    try {
      await queryClient.fetchQuery(getSession)
      setAuthenticated()
    } catch (e) {
      setUnauthenticated()
      throw e
    }
  },

  /** Cache before status — see the invariant above. */
  login: async (input: LoginInput) => {
    await authAPI.login(input)
    await queryClient.fetchQuery(getSession)
    useAuthStore.getState().setAuthenticated()
  },

  /**
   * Status only: identity is deliberately retained so the authenticated layout
   * can finish its exit animation. `clearSession` drops it afterwards.
   */
  logout: async () => {
    await authAPI.logout()
    useAuthStore.getState().setUnauthenticated()
  },

  /**
   * Drop cached identity — only after the navigation off the layout resolved,
   * otherwise the header blanks a frame mid-transition.
   */
  clearSession: () => {
    queryClient.removeQueries({ queryKey: [AUTH_KEY] })
    useAuthStore.getState().setUnauthenticated()
  },
}
