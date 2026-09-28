import { queryOptions, useQuery } from "@tanstack/react-query"
import { apiClient } from "./data-access/api"

/**
 * One cached health probe shared by every reader (routes and the login link),
 * so the flag is fetched once per session rather than per consumer.
 * `retry: false`: a failing health check must not retry-storm, and the flag is
 * static for the lifetime of a deployment.
 */
export const healthQuery = queryOptions({
  queryKey: ["healthz"],
  queryFn: () => apiClient.healthz(),
  retry: false,
  staleTime: 5 * 60 * 1000,
})

/**
 * Whether public self-registration is allowed.
 *
 * The backend reports `internal_mode`: a *public* deployment runs with
 * `internal_mode: false` and accepts self-registration, while an internal
 * deployment (`true`) keeps signup admin-only.
 *
 * Fail closed: a pending or errored probe reads as `false`, so a transient
 * health failure can never expose the public registration surface on an
 * internal deployment.
 */
export function usePublicRegistration(): boolean {
  const { data, isPending, isError } = useQuery(healthQuery)
  return !isPending && !isError && data?.internal_mode === false
}
