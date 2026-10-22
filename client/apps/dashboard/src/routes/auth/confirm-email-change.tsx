import { useTranslations } from "@repo/i18n"
import { confirmEmailChangeSchema } from "@repo/schemas/auth"
import { Check, ClockX } from "@repo/ui/icons"
import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import { useState } from "react"
import z from "zod"
import { setFormErrors, useAppForm } from "@/components/form"
import { AuthPanel, AuthShell } from "@/components/layout/auth-shell"
import { useErrorHandler } from "@/hooks/use-error-handler"
import { authAPI } from "@/lib/data-access/api"

const search = z.object({
  token: z.string(),
})

export const Route = createFileRoute("/auth/confirm-email-change")({
  validateSearch: search,
  beforeLoad: ({ search }) => {
    if (!search.token) {
      throw redirect({ to: "/auth/login", replace: true })
    }
  },
  component: RouteComponent,
  // No token-metadata endpoint exists for an email change, so there is nothing
  // to pre-validate here: the form renders at once and the first submit decides
  // whether the token is still good.
})

const linkClass =
  "rounded-sm text-primary outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-ring"

function RouteComponent() {
  const { token } = Route.useSearch()
  const [invalid, setInvalid] = useState(false)
  const handleError = useErrorHandler()
  const t = useTranslations("app")

  const form = useAppForm({
    defaultValues: {
      token,
    },
    validators: {
      onSubmit: confirmEmailChangeSchema,
    },
    onSubmit: async ({ value, formApi }) => {
      try {
        await authAPI.confirmEmailChange(value)
      } catch (error) {
        handleError(error, {
          VALIDATION: (e) => setFormErrors(formApi, e.details),
          AUTH_INVALID_EMAIL_CHANGE_TOKEN: () => setInvalid(true),
        })
      }
    },
  })

  return (
    <AuthShell>
      <AuthPanel
        title={t("auth.confirmEmailChange.title")}
        description={
          invalid
            ? t("auth.confirmEmailChange.invalidDescription")
            : t("auth.confirmEmailChange.description")
        }
      >
        {invalid ? (
          <InvalidContent />
        ) : (
          <form.Subscribe selector={(state) => state.isSubmitSuccessful}>
            {(success) =>
              success ? (
                <SuccessContent />
              ) : (
                <form.AppForm>
                  <form.Root className="flex flex-col gap-6">
                    <form.SubmitButton className="w-full">
                      {t("auth.confirmEmailChange.submit")}
                    </form.SubmitButton>
                  </form.Root>
                </form.AppForm>
              )
            }
          </form.Subscribe>
        )}
      </AuthPanel>
    </AuthShell>
  )
}

function InvalidContent() {
  const t = useTranslations("app")

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <ClockX className="mt-0.5 size-5 shrink-0 text-warning" />
        <p className="text-sm font-medium text-foreground">
          {t("auth.confirmEmailChange.expired")}
        </p>
      </div>
      <p className="border-t border-border pt-3 text-sm text-muted-foreground">
        {t("auth.confirmEmailChange.requestAgainLead")}{" "}
        <Link to="/profile" className={linkClass}>
          {t("auth.confirmEmailChange.requestAgainLink")}
        </Link>{" "}
        {t("auth.confirmEmailChange.requestAgainTail")}
      </p>
    </div>
  )
}

function SuccessContent() {
  const t = useTranslations("app")

  return (
    <div className="flex items-start gap-3">
      <Check className="mt-0.5 size-5 shrink-0 text-success" />
      <p className="text-sm text-muted-foreground">
        {t("auth.confirmEmailChange.success")}{" "}
        <Link to="/auth/login" className={linkClass}>
          {t("auth.confirmEmailChange.successLink")}
        </Link>
        .
      </p>
    </div>
  )
}
