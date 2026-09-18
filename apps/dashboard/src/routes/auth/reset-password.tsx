import { useTranslations } from "@repo/i18n"
import { resetPasswordSchema } from "@repo/schemas/auth"
import { FieldGroup } from "@repo/ui/components/field"
import { Check, ClockX } from "@repo/ui/icons"
import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import z from "zod"
import { setFormErrors, useAppForm } from "@/components/form"
import { AuthPanel, AuthShell } from "@/components/layout/auth-shell"
import { useErrorHandler } from "@/hooks/use-error-handler"
import { authAPI } from "@/lib/data-access/api"

const search = z.object({
  token: z.string(),
})

export const Route = createFileRoute("/auth/reset-password")({
  validateSearch: search,
  beforeLoad: async ({ search }) => {
    if (!search.token) {
      throw redirect({ to: "/auth/login", replace: true })
    }
  },
  loaderDeps: ({ search }) => ({ token: search.token }),
  loader: async ({ deps: { token }, context }) => {
    let invalid = false
    try {
      const data = await context.queryClient.ensureQueryData({
        queryKey: ["reset-password-token", token],
        queryFn: () => authAPI.getPasswordRecoveryToken(token),
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
  const tc = useTranslations("common")

  const form = useAppForm({
    defaultValues: {
      token,
      new_password: "",
      new_password_confirmation: "",
    },
    validators: {
      onSubmit: resetPasswordSchema,
    },
    onSubmit: async ({ value, formApi }) => {
      try {
        await authAPI.resetPassword(value)
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
        title={t("auth.reset.title")}
        description={
          invalid
            ? t("auth.reset.invalidDescription")
            : t("auth.reset.description")
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
                        name="new_password"
                        children={(field) => (
                          <field.Container>
                            <field.Label
                              text={t("auth.reset.newPasswordLabel")}
                              required
                            />
                            <field.TextField
                              placeholder={t(
                                "auth.reset.newPasswordPlaceholder",
                              )}
                              type="password"
                            />
                            <field.Errors />
                          </field.Container>
                        )}
                      />
                      <form.AppField
                        name="new_password_confirmation"
                        children={(field) => (
                          <field.Container>
                            <field.Label
                              text={t("auth.reset.confirmLabel")}
                              required
                            />
                            <field.TextField
                              placeholder={t("auth.reset.confirmPlaceholder")}
                              type="password"
                            />
                            <field.Errors />
                          </field.Container>
                        )}
                      />
                    </FieldGroup>
                    <form.SubmitButton className="w-full">
                      {tc("actions.save")}
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
          {t("auth.reset.expired")}
        </p>
      </div>
      <p className="border-t border-border pt-3 text-sm text-muted-foreground">
        {t("auth.reset.requestAgainLead")}{" "}
        <Link to="/auth/forgot-password" className={linkClass}>
          {t("auth.reset.requestAgainLink")}
        </Link>{" "}
        {t("auth.reset.requestAgainTail")}
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
        {t("auth.reset.success")}{" "}
        <Link to="/auth/login" className={linkClass}>
          {t("auth.reset.successLink")}
        </Link>
        .
      </p>
    </div>
  )
}
