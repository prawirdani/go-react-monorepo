import { APIClient, AuthAPI } from "@repo/api"
import { useAuthStore } from "@/stores/auth-store"

const apiClient = new APIClient({
  baseURL: import.meta.env.VITE_API_URL,
  refreshEndpoint: "/api/auth/refresh",
  onTokenRefreshFailed: () => {
    const store = useAuthStore.getState()
    store.setExpired()
  },
})

export const authAPI = new AuthAPI(apiClient)
