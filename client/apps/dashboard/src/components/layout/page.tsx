import { useTranslations } from "@repo/i18n"
import { cn } from "@repo/ui/lib/utils"
import { Link } from "@tanstack/react-router"
import { type ComponentPropsWithoutRef, Fragment } from "react"
import type { FileRouteTypes } from "@/routeTree.gen"

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
          // A rem measure, not `ch`: `ch` is the width of the face's zero, so the
          // line length drifted with the palette's typeface (Geist's zero is ~16%
          // wider than Archivo's, which pushed this from ~86 to ~93 characters).
          // 30rem keeps every palette's description inside the 65-75 band.
          <p className="max-w-[30rem] text-sm text-muted-foreground">
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
  href?: FileRouteTypes["to"]
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
