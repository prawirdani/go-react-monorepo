import {
  SIDEBAR_COOKIE_NAME,
  SidebarInset,
  SidebarProvider,
} from "@repo/ui/components/sidebar"
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { AppHeader } from "@/components/layout/header"
import { PageContainer } from "@/components/layout/page"
import { AppSidebar } from "@/components/layout/sidebar"
import { getCookie } from "@/lib/cookie"
import { useAuthStore } from "@/stores/auth-store"

export const Route = createFileRoute("/(app)")({
  beforeLoad: async ({ location }) => {
    const auth = useAuthStore.getState()
    if (auth.status !== "authenticated") {
      throw redirect({
        to: "/auth/login",
        search: {
          redirect: location.href,
        },
      })
    }
  },
  loader: () => {
    return {
      openSidebar: getCookie(SIDEBAR_COOKIE_NAME) !== "false",
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { openSidebar } = Route.useLoaderData()
  // The instrument frame: rail + header persist across navigation; the routed
  // screen only swaps the panels inside the work ground.
  return (
    <SidebarProvider defaultOpen={openSidebar}>
      <AppSidebar />
      <SidebarInset className="bg-background">
        <AppHeader />
        <PageContainer>
          <Outlet />
        </PageContainer>
      </SidebarInset>
    </SidebarProvider>
  )
}
