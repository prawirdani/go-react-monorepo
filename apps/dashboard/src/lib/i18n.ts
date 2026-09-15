import type { MessageKeys, Translator } from "@repo/i18n"
import type { Gender, Role } from "@repo/schemas/user"

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

export const ROLE_LABEL_KEYS = {
  admin: "roleOptions.admin",
  user: "roleOptions.user",
} as const satisfies Record<Role, MessageKeys<"app">>

/** Resolves a role enum to its translated label. */
export const RoleLabel = (t: Translator<"app">, role: Role) =>
  t(ROLE_LABEL_KEYS[role])
