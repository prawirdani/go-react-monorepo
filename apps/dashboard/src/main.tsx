import "./styles.css"

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
    // Global auto invalidation
    onSettled: (_data, _err, _var, _ctx, mutation) => {
      const invalidates = mutation.meta?.invalidatesQuery
      if (invalidates) {
        invalidates.map((key) =>
          queryClient.invalidateQueries({ queryKey: key }),
        )
      }
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
      <div className="fixed inset-0 z-50 grid place-items-center">
        <div className="absolute inset-0 bg-background/10 backdrop-blur-xs" />
        <Loader className="relative h-14 w-14 animate-spin" />
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
      <ThemeProvider>
        <App />
      </ThemeProvider>
      <Toaster
        expand={true}
        visibleToasts={10}
        closeButton={true}
        position="top-center"
      />
    </StrictMode>,
  )
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()
