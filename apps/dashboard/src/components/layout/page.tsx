import {
  Breadcrumb,
  BreadcrumbItem as BreadcrumbItemComp,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@repo/ui/components/breadcrumb"
import { cn } from "@repo/ui/lib/utils"
import { Link } from "@tanstack/react-router"
import { type ComponentPropsWithoutRef, Fragment } from "react"
import type { FileRoutesByFullPath } from "@/routeTree.gen"

export function PageContainer({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"main">) {
  return (
    <main
      className={cn("flex-1 flex flex-col min-w-0 p-4 md:p-8", className)}
      {...props}
    >
      {children}
    </main>
  )
}

type PageProps = ComponentPropsWithoutRef<"div"> & {
  title: string
  description?: string
  breadcrumbs?: BreadcrumbItem[]
}

export function Page(props: PageProps) {
  const { title, description, breadcrumbs, className, children, ...rest } =
    props

  return (
    <div className={cn("flex-1 flex flex-col gap-4", className)} {...rest}>
      <div className="mb-4 lg:mb-6">
        {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
        <h1 className="scroll-m-20 font-bold tracking-tight text-xl md:text-2xl lg:text-3xl leading-8 lg:leading-10">
          {title}
        </h1>
        {description && (
          <span className="text-sm lg:text-base">{description}</span>
        )}
      </div>
      {children}
    </div>
  )
}

type BreadcrumbItem = {
  name: string
  href?: keyof FileRoutesByFullPath
}

function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <Breadcrumb className="mb-2">
      <BreadcrumbList className="!gap-1.5">
        {items.map((item, idx) => (
          <Fragment key={item.name}>
            <BreadcrumbItemComp>
              {item.href ? (
                <BreadcrumbLink
                  render={<Link to={item.href}>{item.name}</Link>}
                />
              ) : (
                <BreadcrumbPage>{item.name}</BreadcrumbPage>
              )}
            </BreadcrumbItemComp>
            {idx !== items.length - 1 && <BreadcrumbSeparator />}
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
