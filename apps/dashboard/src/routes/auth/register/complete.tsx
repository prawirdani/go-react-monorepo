import { useTranslations } from "@repo/i18n"
import { completeRegistrationSchema } from "@repo/schemas/auth"
import { FieldGroup } from "@repo/ui/components/field"
import { Check, ClockX } from "@repo/ui/icons"
import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import z from "zod"
import { setFormErrors, useAppForm } from "@/components/form"
import { AuthPanel, AuthShell } from "@/components/layout/auth-shell"
import { useErrorHandler } from "@/hooks/use-error-handler"
import { authAPI } from "@/lib/api"
import { healthQuery } from "@/lib/health"

const search = z.object({
  token: z.string(),
})

export const Route = createFileRoute("/auth/register/complete")({
  validateSearch: search,
  beforeLoad: async ({ context, search }) => {
    if (!search.token) {
      throw redirect({ to: "/auth/login", replace: true })
    }

    // Same gate as /auth/register: the completion form is unreachable unless the
    // backend is running as a public deployment (`internal_mode: false`).
    let publicRegistration = false
    try {
      const health = await context.queryClient.ensureQueryData(healthQuery)
      publicRegistration = health.internal_mode === false
    } catch {
      publicRegistration = false
    }

    if (!publicRegistration) {
      throw redirect({ to: "/auth/login", replace: true })
    }
  },
  loaderDeps: ({ search }) => ({ token: search.token }),
  loader: async ({ deps: { token }, context }) => {
    let invalid = false
    try {
      const data = await context.queryClient.ensureQueryData({
        queryKey: ["registration-token", token],
        queryFn: () => authAPI.getRegistrationToken(token),
        retry: false,
      })

      const isExpired = data
        ? new Date(data.expires_at).getTime() <= Date.now()
        : false
      const isUsed = data ? data.used_at !== null : false
      invalid = isExpired || isUsed
    } catch (error) {
      invalid = true
      console.error(error)
    }

    return {
      token,
      invalid,
    }
  },
  component: RouteComponent,
})

const linkClass =
  "rounded-sm text-primary outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-ring"

function RouteComponent() {
  const { token, invalid } = Route.useLoaderData()
  const handleError = useErrorHandler()
  const t = useTranslations("app")

  const form = useAppForm({
    defaultValues: {
      token,
      password: "",
      password_confirmation: "",
    },
    validators: {
      onSubmit: completeRegistrationSchema,
    },
    onSubmit: async ({ value, formApi }) => {
      try {
        await authAPI.completeRegistration(value)
      } catch (error) {
        handleError(error, {
          VALIDATION: (e) => setFormErrors(formApi, e.details),
        })
      }
    },
  })

  return (
    <AuthShell>
      <AuthPanel
        title={t("auth.registerComplete.title")}
        description={
          invalid
            ? t("auth.registerComplete.invalidDescription")
            : t("auth.registerComplete.description")
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
                    <FieldGroup className="gap-5">
                      <form.AppField
                        name="password"
                        children={(field) => (
                          <field.Container>
                            <field.Label
                              text={t("auth.fields.password")}
                              required
                            />
                            <field.TextField
                              placeholder={t("auth.fields.passwordPlaceholder")}
                              type="password"
                              autoComplete="new-password"
                            />
                            <field.Errors />
                          </field.Container>
                        )}
                      />
                      <form.AppField
                        name="password_confirmation"
                        children={(field) => (
                          <field.Container>
                            <field.Label
                              text={t("auth.registerComplete.confirmLabel")}
                              required
                            />
                            <field.TextField
                              placeholder={t(
                                "auth.registerComplete.confirmPlaceholder",
                              )}
                              type="password"
                              autoComplete="new-password"
                            />
                            <field.Errors />
                          </field.Container>
                        )}
                      />
                    </FieldGroup>
                    <form.SubmitButton className="w-full">
                      {t("auth.registerComplete.submit")}
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
          {t("auth.registerComplete.invalidExpired")}
        </p>
      </div>
      <p className="border-t border-border pt-3 text-sm text-muted-foreground">
        {t("auth.registerComplete.invalidLead")}{" "}
        <Link to="/auth/login" className={linkClass}>
          {t("auth.registerComplete.invalidLink")}
        </Link>{" "}
        {t("auth.registerComplete.invalidTail")}
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
        {t("auth.registerComplete.success")}{" "}
        <Link to="/auth/login" className={linkClass}>
          {t("auth.login.title")}
        </Link>
        .
      </p>
    </div>
  )
}
