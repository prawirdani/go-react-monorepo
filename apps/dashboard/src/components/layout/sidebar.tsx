import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@repo/ui/components/sidebar"
import { Edit, LayoutDashboard, Settings } from "@repo/ui/icons"
import type * as React from "react"
import {
  type NavItem,
  SidebarNavigations,
} from "@/components/layout/sidebar-nav"

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Example",
    icon: Edit,
    children: [
      { title: "Child 1", href: "/example" },
      { title: "Child 2", href: "/example" },
      { title: "Child 3", href: "/example" },
    ],
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
] as const

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props} className="z-20">
      <SidebarHeader className="truncate group-data-[collapsible=icon]:hidden text-center">
        Dashboard 666
      </SidebarHeader>
      <SidebarContent>
        <SidebarNavigations items={navItems} />
      </SidebarContent>
      <SidebarFooter></SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
