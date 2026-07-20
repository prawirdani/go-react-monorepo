// Tanstack form helper funcs
/** biome-ignore-all lint/suspicious/noExplicitAny: blame tanstack form types */

import type { ErrValidation } from "@repo/api/errors"
import { capitalizeFirst } from "@repo/utils/strings"
import type { AnyFieldApi, DeepKeys, FormApi } from "@tanstack/react-form"

export const isFieldInvalid = (field: AnyFieldApi) => {
  return field.state.meta.isTouched && field.state.meta.errors.length > 0
}

type BulkErrors = ReturnType<typeof buildErrorMap>

type SingularError<TData> = {
  field: DeepKeys<TData> // This provides the "name" | "options[0].name" type safety
  message: string
}
type FieldErrorMap<TData> = Partial<Record<DeepKeys<TData>, string>>

type FormError<TData> = BulkErrors | SingularError<TData> | FieldErrorMap<TData>

function isSingularError<TData>(
  error: FormError<TData>,
): error is SingularError<TData> {
  return (
    typeof error === "object" &&
    error !== null &&
    "field" in error &&
    "message" in error &&
    typeof (error as any).message === "string" &&
    Object.keys(error).length === 2
  )
}

function isFieldErrorMap<TData>(error: object): error is FieldErrorMap<TData> {
  // every value is a plain string -> flat map, not the {message} shape buildErrorMap produces
  return Object.values(error).every((v) => typeof v === "string")
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
  let fields: Record<string, { message: string | string[] }>

  if (isSingularError(error)) {
    fields = { [error.field]: { message: error.message } }
  } else if (isFieldErrorMap<TData>(error)) {
    fields = Object.fromEntries(
      Object.entries(error).map(([field, message]) => [
        field,
        { message: message as string },
      ]),
    )
  } else {
    fields = error as BulkErrors
  }

  formApi.setErrorMap({
    onSubmit: { fields: fields as any },
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
