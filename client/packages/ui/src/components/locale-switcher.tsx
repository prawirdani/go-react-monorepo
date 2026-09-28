import {
  LOCALES,
  type Locale,
  useLocale,
  useSetLocale,
  useTranslations,
} from "@repo/i18n"
import { cn } from "@repo/ui/lib/utils"
import * as React from "react"
import { NativeSelect, NativeSelectOption } from "./native-select"

const LOCALE_LABEL_KEYS = {
  en: "locale.en",
  id: "locale.id",
} as const

export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations("ui")
  const locale = useLocale()
  const setLocale = useSetLocale()
  const labelId = React.useId()

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="panel-label" id={labelId}>
        {t("locale.label")}
      </span>
      <NativeSelect
        size="sm"
        aria-labelledby={labelId}
        className="w-full"
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
      >
        {LOCALES.map((code) => (
          <NativeSelectOption key={code} value={code}>
            {t(LOCALE_LABEL_KEYS[code])}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  )
}
