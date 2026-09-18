import { useTranslations } from "@repo/i18n"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@repo/ui/components/sidebar"
import { Edit, LayoutDashboard, Settings, UserCog } from "@repo/ui/icons"
import type * as React from "react"
import { BrandLockup } from "@/components/layout/brand"
import {
  type NavItem,
  SidebarNavigations,
} from "@/components/layout/sidebar-nav"
import { ACCESS } from "@/lib/auth/access"

const navItems: NavItem[] = [
  {
    titleKey: "nav.dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    titleKey: "nav.users",
    href: "/users",
    icon: UserCog,
    perm: ACCESS.users,
  },
  {
    titleKey: "nav.example",
    icon: Edit,
    children: [
      { titleKey: "nav.exampleChild1", href: "/example" },
      { titleKey: "nav.exampleChild2", href: "/example" },
      { titleKey: "nav.exampleChild3", href: "/example" },
    ],
  },
  {
    titleKey: "nav.settings",
    href: "/settings",
    icon: Settings,
  },
] as const

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar
      collapsible="icon"
      {...props}
      className="z-20 border-sidebar-border"
    >
      <SidebarHeader className="h-14 shrink-0 justify-center border-b border-sidebar-border px-3 group-data-[collapsible=icon]:px-2">
        <BrandLockup className="group-data-[collapsible=icon]:hidden" />
        <BrandLockup
          compact
          className="hidden group-data-[collapsible=icon]:grid"
        />
      </SidebarHeader>
      <SidebarContent className="py-1">
        <SidebarNavigations items={navItems} />
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3 group-data-[collapsible=icon]:hidden">
        <AppVersion />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function AppVersion() {
  const t = useTranslations("app")
  // Vite only exposes VITE_-prefixed vars; the fallback keeps a missing .env
  // from rendering the literal string "undefined".
  const version = import.meta.env.VITE_VERSION || "dev"

  return (
    <div className="flex items-center justify-between gap-2">
      <p className="panel-label">{t("nav.versionLabel")}</p>
      <p className="font-mono text-xs text-muted-foreground">{version}</p>
    </div>
  )
}
