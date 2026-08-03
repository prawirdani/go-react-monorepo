import { TanStackDevtools } from "@tanstack/react-devtools"
import { FormDevtoolsPanel } from "@tanstack/react-form-devtools"
import type { QueryClient } from "@tanstack/react-query"
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools"
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { AuthStateWatcher } from "@/components/auth-state-watcher"
import { InternalServerError, NotFound } from "@/components/route-errors"
import { authActions, useAuthStore } from "@/stores/auth-store"

type RouterContext = {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async () => {
    const authStatus = useAuthStore.getState().status
    if (authStatus === "initial") {
      try {
        await authActions.identifyUser()
      } catch (_) {}
    }
  },
  component: () => <RootComponent />,
  notFoundComponent: () => <NotFound />,
  errorComponent: InternalServerError,
})

function RootComponent() {
  return (
    <>
      <AuthStateWatcher />
      <Outlet />
      <TanStackDevtools
        config={{
          position: "bottom-right",
        }}
        plugins={[
          {
            name: "Router",
            render: <TanStackRouterDevtoolsPanel />,
          },
          {
            name: "Query",
            render: <ReactQueryDevtoolsPanel />,
          },
          {
            name: "Form",
            render: <FormDevtoolsPanel />,
          },
        ]}
      />
    </>
  )
}
