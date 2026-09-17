import { APIClient, AuditAPI, AuthAPI, UserAPI } from "@repo/api"
import { auditQueries as auditQ, userQueries as userQ } from "@repo/queries"
import { useAuthStore } from "@/stores/auth-store"

const IMAGE_BASE_URL = import.meta.env.VITE_IMAGE_URL.replace(/\/$/, "")

export const imageUrl = {
  profile: (path: string) =>
    `${IMAGE_BASE_URL}/profiles/${path.replace(/^\//, "")}`,
}

const apiClient = new APIClient({
  baseURL: import.meta.env.VITE_API_URL,
  refreshEndpoint: "/api/auth/refresh",
  onTokenRefreshFailed: () => {
    const store = useAuthStore.getState()
    store.setExpired()
  },
})

export { apiClient }

export const authAPI = new AuthAPI(apiClient)
export const userAPI = new UserAPI(apiClient)
export const auditAPI = new AuditAPI(apiClient)

export const userQueries = userQ(authAPI)
export const auditQueries = auditQ(auditAPI)
