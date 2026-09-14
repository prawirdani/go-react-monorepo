import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible"
import { ChevronRight, type TablerIcon } from "@repo/ui/icons"
import { cn } from "@repo/ui/lib/utils"
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

/**
 * Nav rows read as panel actions, not menu pills: square, flat, and marked
 * with the single accent only while the route is current.
 */
const navItemClass = cn(
  "group/nav flex h-9 min-w-0 items-center gap-2.5 rounded-sm px-2.5 text-sm text-sidebar-foreground/75 outline-none transition-colors",
  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
  "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
  "data-[status=active]:bg-primary/10 data-[status=active]:font-medium data-[status=active]:text-primary",
  "aria-[current=page]:bg-primary/10 aria-[current=page]:font-medium aria-[current=page]:text-primary",
  "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
)

export function SidebarNavigations({ items }: { items: NavItem[] }) {
  const location = useLocation({
    select: (loc) => loc.pathname,
  })

  return (
    <div className="flex min-w-0 flex-col px-2 py-1 group-data-[collapsible=icon]:px-1.5">
      <p className="panel-label px-2 pb-2 pt-1 group-data-[collapsible=icon]:hidden">
        Navigasi
      </p>
      <ul className="flex min-w-0 flex-col gap-px">
        {items.map((item) => {
          if (item.children) {
            const isParentActive = item.children.some(
              (child) => child.href === location,
            )

            return (
              <Collapsible
                key={item.title}
                className="group/collapsible"
                render={<li className="relative min-w-0" />}
              >
                <CollapsibleTrigger
                  className={cn(
                    navItemClass,
                    "w-full data-[active=true]:bg-primary/10 data-[active=true]:font-medium data-[active=true]:text-primary",
                  )}
                  data-active={isParentActive ? "true" : undefined}
                  title={item.title}
                  aria-label={item.title}
                >
                  <item.icon className="size-4 shrink-0" />
                  <span className="truncate group-data-[collapsible=icon]:hidden">
                    {item.title}
                  </span>
                  <ChevronRight className="ml-auto size-3.5 shrink-0 transition-transform duration-150 ease-console group-data-open/collapsible:rotate-90 group-data-[collapsible=icon]:hidden" />
                </CollapsibleTrigger>
                <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
                  <ul className="ml-3.5 mt-px flex min-w-0 flex-col gap-px border-l border-sidebar-border pl-2.5">
                    {item.children?.map((subItem) => (
                      <li key={subItem.title} className="min-w-0">
                        <Link
                          to={subItem.href}
                          className={cn(
                            "flex h-7 min-w-0 items-center rounded-sm px-2 text-sm text-sidebar-foreground/70 outline-none transition-colors",
                            "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                            "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                            "data-[status=active]:font-medium data-[status=active]:text-primary",
                            "aria-[current=page]:font-medium aria-[current=page]:text-primary",
                          )}
                        >
                          <span className="truncate">{subItem.title}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            )
          }

          return (
            <li key={item.title} className="min-w-0">
              <Link
                to={item.href}
                className={navItemClass}
                title={item.title}
                aria-label={item.title}
              >
                <item.icon className="size-4 shrink-0" />
                <span className="truncate group-data-[collapsible=icon]:hidden">
                  {item.title}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
