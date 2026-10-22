import { useTranslations } from "@repo/i18n"
import { Button } from "@repo/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import { ChevronDown, Filter, FilterOff } from "@repo/ui/icons"
import { Fragment, type ReactNode } from "react"

/** Radio value for "Semua"; local to the menu, never written to the URL. */
const ALL_VALUE = "__all"

/**
 * How a group takes its values: `multi` accepts any number of its options,
 * `radio` exactly one — or none, which is what "Semua" means for both.
 */
export type FilterMode = "multi" | "radio"

/**
 * One labelled section of the filter menu. `selected` is always an array: a
 * radio group holds at most one value, so the two modes share one contract and
 * one "no filter" representation (empty).
 */
export type FilterGroup = {
  /** The search param this group writes; passed back through `onChange`. */
  key: string
  label: ReactNode
  mode?: FilterMode
  options: { value: string; label: ReactNode }[]
  selected: string[]
}

/**
 * Grouped filter menu. Every group starts with "Semua" (no filter for that
 * group) and writes through `onChange`, which receives the whole next selection:
 * the empty array drops the param. Toggling the last un-checked option of a
 * multi group also lands on empty — checking everything means the same as
 * checking nothing. Page resets and URL writes live in `useFiltering`.
 */
export function FilterDropdown({
  groups,
  activeCount,
  onChange,
  onClear,
}: {
  groups: FilterGroup[]
  activeCount: number
  onChange: (key: string, values: string[]) => void
  onClear: () => void
}) {
  const t = useTranslations("common")

  const toggle = (group: FilterGroup, value: string, on: boolean) => {
    const next = on
      ? [...group.selected, value]
      : group.selected.filter((entry) => entry !== value)
    const coversAll =
      group.options.length > 0 &&
      group.options.every((option) => next.includes(option.value))
    onChange(group.key, coversAll ? [] : next)
  }

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
            {group.mode === "radio" ? (
              <DropdownMenuGroup>
                <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={group.selected[0] ?? ALL_VALUE}
                  onValueChange={(value) =>
                    onChange(group.key, value === ALL_VALUE ? [] : [value])
                  }
                >
                  <DropdownMenuRadioItem value={ALL_VALUE}>
                    {t("searchQuery.all")}
                  </DropdownMenuRadioItem>
                  {group.options.map((option) => (
                    <DropdownMenuRadioItem
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
            ) : (
              <DropdownMenuGroup>
                <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={group.selected.length === 0}
                  onCheckedChange={() => onChange(group.key, [])}
                >
                  {t("searchQuery.all")}
                </DropdownMenuCheckboxItem>
                {group.options.map((option) => (
                  <DropdownMenuCheckboxItem
                    key={option.value}
                    checked={group.selected.includes(option.value)}
                    onCheckedChange={(checked) =>
                      toggle(group, option.value, checked)
                    }
                  >
                    {option.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
            )}
          </Fragment>
        ))}

        {activeCount > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onClear}>
              <FilterOff />
              {t("searchQuery.clear")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
