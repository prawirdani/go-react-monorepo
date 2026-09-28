import type { SortOrder } from "@repo/schemas/search-query"
import { TableHead } from "@repo/ui/components/table"
import { ChevronDown, ChevronUp } from "@repo/ui/icons"
import { cn } from "@repo/ui/lib/utils"
import type { ReactNode } from "react"

/**
 * A sortable column head: `aria-sort` on the `<th>`, the toggle on a real
 * button (keyboard path included), and the direction chevron only while this
 * column is the active sort.
 */
export function SortableHead<T extends string>({
  field,
  activeSort,
  order,
  onSort,
  className,
  children,
}: {
  field: T
  activeSort: string
  order: SortOrder
  onSort: (field: T) => void
  className?: string
  children: ReactNode
}) {
  const active = activeSort === field

  return (
    <TableHead
      className={cn("px-3 panel-label", className)}
      aria-sort={
        active ? (order === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex cursor-pointer items-center gap-1 rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        {children}
        {active &&
          (order === "asc" ? (
            <ChevronUp aria-hidden="true" className="size-3.5" />
          ) : (
            <ChevronDown aria-hidden="true" className="size-3.5" />
          ))}
      </button>
    </TableHead>
  )
}
