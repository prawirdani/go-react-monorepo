import { useTranslations } from "@repo/i18n"
import { Button } from "@repo/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import { ChevronDown, Filter } from "@repo/ui/icons"
import { Fragment, type ReactNode } from "react"

/** One labelled checkbox section of the filter menu. */
export type FilterGroup = {
  /** The search param this group writes; passed back through `onToggle`. */
  key: string
  label: ReactNode
  options: { value: string; label: ReactNode }[]
  selected: string[]
}

/**
 * Grouped checkbox filters. Every toggle rewrites the URL and resets to page 1
 * (that lives in `useFiltering`); this component only renders and reports.
 */
export function FilterDropdown({
  groups,
  activeCount,
  onToggle,
  onClear,
}: {
  groups: FilterGroup[]
  activeCount: number
  onToggle: (key: string, value: string, on: boolean) => void
  onClear: () => void
}) {
  const t = useTranslations("common")

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm">
            <Filter />
            {t("searchQuery.filter")}
            {activeCount > 0 && (
              <span className="font-mono text-xs">{activeCount}</span>
            )}
            <ChevronDown />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-52">
        {groups.map((group, index) => (
          <Fragment key={group.key}>
            {index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuGroup>
              <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
              {group.options.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.value}
                  checked={group.selected.includes(option.value)}
                  onCheckedChange={(checked) =>
                    onToggle(group.key, option.value, checked)
                  }
                >
                  {option.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          </Fragment>
        ))}

        {activeCount > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onClear}>
              {t("searchQuery.clear")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
