import "./styles.css"

import { I18nProvider } from "@repo/i18n"
import { Toaster } from "@repo/ui/components/sonner"
import { Loader } from "@repo/ui/icons"
import { ThemeProvider } from "@repo/ui/providers/theme-provider"
import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query"
import { createRouter, RouterProvider } from "@tanstack/react-router"
import { StrictMode } from "react"
import ReactDOM from "react-dom/client"
import reportWebVitals from "./reportWebVitals.ts"
// Import the generated route tree
import { routeTree } from "./routeTree.gen"

const queryClient = new QueryClient({
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

// Create a new router instance
const router = createRouter({
  routeTree,
  context: {
    queryClient: queryClient,
  },
  defaultPreload: "intent",
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
  defaultPendingMinMs: 0,
  defaultPendingComponent: () => {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-background/70">
        <Loader className="h-10 w-10 animate-spin text-primary" />
      </div>
    )
  },
})

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

// Render the app
const rootElement = document.getElementById("app")
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <I18nProvider>
        <ThemeProvider>
          <App />
          <Toaster
            expand={true}
            visibleToasts={10}
            closeButton={true}
            position="top-center"
          />
        </ThemeProvider>
      </I18nProvider>
    </StrictMode>,
  )
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()
