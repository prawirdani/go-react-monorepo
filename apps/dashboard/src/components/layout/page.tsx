import { useTranslations } from "@repo/i18n"
import { cn } from "@repo/ui/lib/utils"
import { Link } from "@tanstack/react-router"
import { type ComponentPropsWithoutRef, Fragment } from "react"
import type { FileRoutesByFullPath } from "@/routeTree.gen"

export function PageContainer({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn("flex min-w-0 flex-1 flex-col gap-4 p-3 md:p-5", className)}
      {...props}
    >
      {children}
    </div>
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
    <div
      className={cn("flex min-w-0 flex-1 flex-col gap-4", className)}
      {...rest}
    >
      <header className="flex flex-col gap-2 border-b border-border pb-3">
        {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
        <h1 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
          {title}
        </h1>
        {description && (
          <p className="max-w-[70ch] text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </header>
      {children}
    </div>
  )
}

type BreadcrumbItem = {
  name: string
  href?: keyof FileRoutesByFullPath
}

function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const t = useTranslations("ui")

  return (
    <nav aria-label={t("breadcrumb.label")}>
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        {items.map((item, idx) => (
          <Fragment key={item.name}>
            <li className="min-w-0">
              {item.href ? (
                <Link
                  to={item.href}
                  className="rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {item.name}
                </Link>
              ) : (
                <span aria-current="page" className="text-foreground/80">
                  {item.name}
                </span>
              )}
            </li>
            {idx !== items.length - 1 && (
              <li aria-hidden="true" className="text-muted-foreground/50">
                /
              </li>
            )}
          </Fragment>
        ))}
      </ol>
    </nav>
  )
}
