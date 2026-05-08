// Tanstack form helper funcs
/** biome-ignore-all lint/suspicious/noExplicitAny: blame tanstack form types */

import type { ErrValidation } from "@repo/api/errors"
import { capitalizeFirst } from "@repo/utils/strings"
import type { AnyFieldApi, DeepKeys, FormApi } from "@tanstack/react-form"

export const isFieldInvalid = (field: AnyFieldApi) => {
  return field.state.meta.isTouched && field.state.meta.errors.length > 0
}

// 1. Keep your BulkErrors based on buildErrorMap
type BulkErrors = ReturnType<typeof buildErrorMap>

// 2. Make SingularError generic so 'field' is checked against the form data
type SingularError<TData> = {
  field: DeepKeys<TData> // This provides the "name" | "options[0].name" type safety
  message: string
}

// 3. The Union type also becomes generic
type FormError<TData> = BulkErrors | SingularError<TData>

function isSingularError<TData>(
  error: FormError<TData>,
): error is SingularError<TData> {
  return typeof error === "object" && error !== null && "field" in error
}

export type FormApiWithFields<TData> = FormApi<
  TData,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any
>

export const setFormErrors = <TData>(
  formApi: FormApiWithFields<TData>,
  error: FormError<TData>,
) => {
  const fields = isSingularError(error)
    ? { [error.field]: { message: error.message } }
    : error

  formApi.setErrorMap({
    onSubmit: {
      fields: fields as any,
    },
  })
}

/**
 * Formats API validation errors for TanStack Form.
 * Usage: formApi.setErrorMap({ onSubmit: { fields: buildErrorMap(details) } })
 */
export function buildErrorMap<T extends Record<string, unknown>>(
  details: ErrValidation<T>["details"],
) {
  const fields = Object.fromEntries(
    Object.entries(details).map(([field, issues]) => [
      field,
      { message: issues?.map((issue) => capitalizeFirst(issue)) },
    ]),
  ) as Record<keyof T, { message: string[] }>

  return fields
}
