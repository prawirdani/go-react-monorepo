// Tanstack form helper funcs
/** biome-ignore-all lint/suspicious/noExplicitAny: blame tanstack form types */

import type { ValidationErrorDetails } from "@repo/api/errors"
import { capitalizeFirst } from "@repo/utils/strings"
import type { AnyFormApi, DeepKeys, FormApi } from "@tanstack/react-form"

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
    fields = {
      [error.field]: { message: error.message },
    }
  } else if (isValidationDetails(error)) {
    fields = Object.fromEntries(
      Object.entries(error).map(([field, issues]) => [
        field,
        {
          message: (issues ?? []).map(capitalizeFirst),
        },
      ]),
    )
  } else {
    // FieldErrorMap<TData>
    fields = Object.fromEntries(
      Object.entries(error).map(([field, message]) => [
        field,
        {
          message: message as string,
        },
      ]),
    )
  }

  formApi.setErrorMap({
    onSubmit: { fields: fields as any },
  })
}

export function setFormRootError(formApi: AnyFormApi, message: string) {
  formApi.setErrorMap({
    onSubmit: {
      form: message,
      fields: {},
    },
  })
}

type SingularError<TData> = {
  field: DeepKeys<TData> // This provides the "name" | "options[0].name" type safety
  message: string
}
type FieldErrorMap<TData> = Partial<Record<DeepKeys<TData>, string>>

type FormError<TData> =
  | ValidationErrorDetails
  | SingularError<TData>
  | FieldErrorMap<TData>

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

function isValidationDetails(error: object): error is ValidationErrorDetails {
  return Object.values(error).every(
    (v) => Array.isArray(v) && v.every((x) => typeof x === "string"),
  )
}
