import { MutationCache, QueryClient } from "@tanstack/react-query"

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    // Global auto invalidation. Success only: a failed mutation changed
    // nothing, so refetching its targets is wasted work.
    onSuccess: async (_data, _variables, _onMutateResult, mutation) => {
      const invalidates = mutation.meta?.invalidatesQuery
      if (!invalidates) return
      await Promise.all(
        invalidates.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      )
    },
  }),
})
