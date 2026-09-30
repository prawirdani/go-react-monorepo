import { APIClient, AuditAPI, AuthAPI, UserAPI } from "@repo/api"
import { useAuthStore } from "@/lib/auth/store"

// `?? ""` is load-bearing. Vite inlines `import.meta.env.VITE_*` at build time,
// and the image build has no .env (it is dockerignored), so an unset variable
// arrives as `undefined` rather than `""`. Empty is the documented same-origin
// value (see example.env); `.replace` on undefined throws at module scope and
// takes the whole chunk down with it.
const IMAGE_BASE_URL = (import.meta.env.VITE_IMAGE_URL ?? "").replace(/\/$/, "")

export const imageUrl = {
  profile: (path: string) =>
    `${IMAGE_BASE_URL}/profiles/${path.replace(/^\//, "")}`,
}

const apiClient = new APIClient({
  baseURL: import.meta.env.VITE_API_URL ?? "",
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
