import type { MessageKeys, Translator } from "@repo/i18n"
import type { Gender } from "@repo/schemas/user"

export const GENDER_LABEL_KEYS = {
  M: "genderOptions.m",
  F: "genderOptions.f",
  O: "genderOptions.o",
} as const satisfies Record<Gender, MessageKeys<"common">>

export const GenderOptions = (tc: Translator<"common">) =>
  (Object.keys(GENDER_LABEL_KEYS) as Gender[]).map((value) => ({
    value,
    label: tc(GENDER_LABEL_KEYS[value]),
  }))
