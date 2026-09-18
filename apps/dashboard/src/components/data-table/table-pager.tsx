import type { PaginationMeta } from "@repo/api"
import { useTranslations } from "@repo/i18n"
import { LIMIT_OPTIONS } from "@repo/schemas/search-query"
import { Button } from "@repo/ui/components/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import { ChevronLeft, ChevronRight } from "@repo/ui/icons"

/**
 * Domain-agnostic list footer: range, page size, page indicator, prev/next.
 * The "showing X–Y of Z" line is composed here from static labels plus numbers
 * (the catalog is arg-free by contract).
 */
export function TablePager({
  meta,
  isPlaceholderData,
  onPage,
  onLimit,
  limitOptions = LIMIT_OPTIONS,
}: {
  meta: PaginationMeta
  isPlaceholderData?: boolean
  onPage: (page: number) => void
  onLimit: (limit: number) => void
  limitOptions?: readonly number[]
}) {
  const t = useTranslations("common")

  const limitItems = limitOptions.map((limit) => ({
    value: String(limit),
    label: String(limit),
  }))
  const from = meta.total > 0 ? (meta.page - 1) * meta.limit + 1 : 0
  const to = Math.min(meta.page * meta.limit, meta.total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-2">
      <p className="font-mono text-xs text-muted-foreground">
        {t("searchQuery.showing")}{" "}
        <span className="text-foreground">
          {from}–{to}
        </span>{" "}
        {t("searchQuery.of")}{" "}
        <span className="text-foreground">{meta.total}</span>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            {t("searchQuery.rows")}
          </span>
          <Select
            items={limitItems}
            value={String(meta.limit)}
            onValueChange={(value) => onLimit(Number(value))}
          >
            <SelectTrigger
              size="sm"
              aria-label={t("searchQuery.rows")}
              className="font-mono text-xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="top" alignItemWithTrigger={false}>
              <SelectGroup>
                {limitItems.map((item) => (
                  <SelectItem
                    key={item.value}
                    value={item.value}
                    className="font-mono text-xs"
                  >
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          {t("searchQuery.page")} {meta.page}/{meta.total_pages}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            disabled={meta.page <= 1 || isPlaceholderData}
            onClick={() => onPage(meta.page - 1)}
            aria-label={t("searchQuery.prev")}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={meta.page >= meta.total_pages || isPlaceholderData}
            onClick={() => onPage(meta.page + 1)}
            aria-label={t("searchQuery.next")}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
