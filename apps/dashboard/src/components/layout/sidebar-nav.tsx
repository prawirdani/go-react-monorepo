import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible"
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@repo/ui/components/sidebar"
import { ChevronRight, type TablerIcon } from "@repo/ui/icons"
import { Link, useLocation } from "@tanstack/react-router"
import type { FileRoutesByFullPath } from "@/routeTree.gen"

export type NavItem = {
  title: string
  icon: TablerIcon
} & (
  | {
      // Leaf node: has URL, no children
      href: keyof FileRoutesByFullPath
      children?: never
    }
  | {
      // Parent node: has children, no URL
      children: { title: string; href: keyof FileRoutesByFullPath }[]
    }
)

export function SidebarNavigations({ items }: { items: NavItem[] }) {
  const location = useLocation({
    select: (loc) => loc.pathname,
  })

  return (
    <SidebarGroup className="gap-0.5 group-data-[collapsible=icon]:gap-1.5">
      {items.map((item) => {
        if (item.children) {
          const isParentActive = item.children.some(
            (child) => child.href === location,
          )

          return (
            <SidebarMenu key={item.title}>
              <Collapsible
                className="group/collapsible"
                render={<SidebarMenuItem />}
              >
                <SidebarMenuButton
                  className="!py-6"
                  isActive={isParentActive}
                  render={<CollapsibleTrigger />}
                >
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                  <ChevronRight className="ml-auto transition-transform duration-100 group-data-open/collapsible:rotate-90" />
                </SidebarMenuButton>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.children?.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton
                          className="!py-4 hover:cursor-pointer"
                          isActive={subItem.href === location}
                          render={
                            <Link className="truncate" to={subItem.href}>
                              <span>{subItem.title}</span>
                            </Link>
                          }
                        ></SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </Collapsible>
            </SidebarMenu>
          )
        }

        return (
          <SidebarMenu key={item.title}>
            <SidebarMenuItem>
              <Link to={item.href}>
                <SidebarMenuButton
                  className="!py-6"
                  tooltip={item.title}
                  isActive={item.href === location}
                >
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          </SidebarMenu>
        )
      })}
    </SidebarGroup>
  )
}
