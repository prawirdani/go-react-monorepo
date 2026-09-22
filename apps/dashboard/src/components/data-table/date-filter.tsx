import type { Locale as AppLocale } from "@repo/i18n"
import { useLocale, useTranslations } from "@repo/i18n"
import { Button } from "@repo/ui/components/button"
import { Calendar } from "@repo/ui/components/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover"
import { Calendar as CalendarIcon } from "@repo/ui/icons"
import { enUS, id as idLocale } from "date-fns/locale"
import { useState } from "react"
import type { DateRange, DayPickerLocale } from "react-day-picker"

export type DateFilterValue = { date: string; from: string; to: string }

// date-fns locale per app locale, so the calendar's month/weekday names follow
// the active language instead of defaulting to English.
const DATE_FNS_LOCALES = {
  en: enUS,
  id: idLocale,
} satisfies Record<AppLocale, DayPickerLocale>

/** ISO datetime -> the local calendar day, for seeding the picker. */
function isoToDay(iso: string): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

/** "YYYY-MM-DD" -> a local-midnight Date (what react-day-picker selects). */
function dayToDate(day: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!match) return undefined
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

/** A selected Date -> the "YYYY-MM-DD" the data contract expects. */
function dateToDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

export function DateFilter({
  value,
  onSetDate,
  onSetRange,
  onClear,
}: {
  value: DateFilterValue
  onSetDate: (day: string) => void
  onSetRange: (range: { from?: string; to?: string }) => void
  onClear: () => void
}) {
  const t = useTranslations("common")
  const locale = useLocale()
  const dateFnsLocale = DATE_FNS_LOCALES[locale]

  const [open, setOpen] = useState(false)
  const [range, setRange] = useState<DateRange | undefined>(undefined)

  const active = Boolean(value.date || value.from || value.to)
  const canApply = Boolean(range?.from || range?.to)

  const handleOpenChange = (next: boolean) => {
    if (next) {
      // Seed from the applied filter so reopening shows what is in effect.
      if (value.date) {
        setRange({ from: dayToDate(isoToDay(value.date)) })
      } else if (value.from || value.to) {
        // `dayToDate("")` is undefined, so a from-only or to-only filter seeds
        // as the open end of the range instead of being dropped.
        setRange({
          from: dayToDate(isoToDay(value.from)),
          to: dayToDate(isoToDay(value.to)),
        })
      } else {
        setRange(undefined)
      }
    }
    setOpen(next)
  }

  const apply = () => {
    const from = range?.from
    const to = range?.to

    if (from && to) {
      onSetRange({ from: dateToDay(from), to: dateToDay(to) })
    } else if (from) {
      // A single picked day goes out as the `date` param — a UTC datetime of
      // that local day (see use-date-filtering).
      onSetDate(dateToDay(from))
    }

    setOpen(false)
  }

  const clear = () => {
    onClear()
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            <CalendarIcon />
            {t("searchQuery.date.trigger")}
            {active && (
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-primary"
              />
            )}
          </Button>
        }
      />

      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="range"
          selected={range}
          onSelect={(r) => {
            const sameDay =
              r?.from && r?.to && r.from.getTime() === r.to.getTime()

            setRange(
              r
                ? {
                    from: r.from,
                    to: sameDay ? undefined : r.to,
                  }
                : undefined,
            )
          }}
          locale={dateFnsLocale}
          disabled={(date) => date > new Date()}
        />
        <div className="flex justify-between gap-2 p-2">
          {active && (
            <Button
              className="flex-1"
              type="button"
              variant="ghost"
              onClick={clear}
            >
              {t("searchQuery.date.reset")}
            </Button>
          )}

          <Button
            className="flex-1"
            type="button"
            disabled={!canApply}
            onClick={apply}
          >
            {t("searchQuery.date.apply")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
