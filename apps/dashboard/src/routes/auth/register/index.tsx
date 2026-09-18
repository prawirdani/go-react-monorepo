import { useTranslations } from "@repo/i18n"
import { registerSchema } from "@repo/schemas/auth"
import { FieldGroup } from "@repo/ui/components/field"
import { AlertTriangle, Check } from "@repo/ui/icons"
import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import { setFormErrors, setFormRootError, useAppForm } from "@/components/form"
import { RootError } from "@/components/form/fields"
import { AuthPanel, AuthShell } from "@/components/layout/auth-shell"
import { useErrorHandler } from "@/hooks/use-error-handler"
import { authAPI } from "@/lib/data-access/api"
import { healthQuery } from "@/lib/health"
import { useAuthStore } from "@/stores/auth-store"

export const Route = createFileRoute("/auth/register/")({
  beforeLoad: async ({ context }) => {
    const auth = useAuthStore.getState()
    if (auth.user) {
      throw redirect({ to: "/", replace: true })
    }

    // Public self-registration is allowed only on a public deployment, i.e.
    // while the backend reports `internal_mode: false`. Fail closed: a pending
    // or failed probe hides the route entirely.
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
  component: RouteComponent,
})

const linkClass =
  "rounded-sm text-primary text-sm outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-ring"

function RouteComponent() {
  const t = useTranslations("app")

  return (
    <AuthShell>
      <AuthPanel
        title={t("auth.register.title")}
        description={t("auth.register.description")}
      >
        <RegisterForm />
      </AuthPanel>
    </AuthShell>
  )
}

function RegisterForm() {
  const handleError = useErrorHandler()
  const t = useTranslations("app")

  const form = useAppForm({
    defaultValues: {
      name: "",
      email: "",
    },
    validators: {
      onSubmit: registerSchema,
    },
    onSubmit: async ({ value, formApi }) => {
      try {
        await authAPI.register(value, { noAuth: true })
      } catch (error) {
        handleError(error, {
          VALIDATION: (e) => setFormErrors(formApi, e.details),
          USER_EMAIL_CONFLICT: () => {
            setFormRootError(formApi, t("auth.register.emailConflict"))
          },
        })
      }
    },
  })

  return (
    <form.Subscribe selector={(state) => state.isSubmitSuccessful}>
      {(success) =>
        success ? (
          <SentContent />
        ) : (
          <form.AppForm>
            <form.Root className="flex flex-col gap-6">
              <FieldGroup className="gap-5">
                <form.AppField
                  name="name"
                  children={(field) => (
                    <field.Container>
                      <field.Label
                        text={t("auth.register.nameLabel")}
                        required
                      />
                      <field.TextField
                        placeholder={t("auth.register.namePlaceholder")}
                        autoComplete="name"
                      />
                      <field.Errors />
                    </field.Container>
                  )}
                />

                <form.AppField
                  name="email"
                  children={(field) => (
                    <field.Container>
                      <field.Label text={t("auth.fields.email")} required />
                      <field.TextField
                        placeholder={t("auth.fields.emailPlaceholder")}
                        autoComplete="on"
                      />
                      <field.Errors />
                    </field.Container>
                  )}
                />
              </FieldGroup>

              <RootError>
                {(error) => (
                  <div
                    role="alert"
                    className="flex items-center gap-2 rounded-sm border border-destructive/40 bg-destructive/10 p-2.5"
                  >
                    <AlertTriangle className="size-4 shrink-0 text-destructive" />
                    <span className="text-sm text-destructive">{error}</span>
                  </div>
                )}
              </RootError>

              <form.SubmitButton className="w-full">
                {t("auth.register.submit")}
              </form.SubmitButton>
            </form.Root>
          </form.AppForm>
        )
      }
    </form.Subscribe>
  )
}

function SentContent() {
  const t = useTranslations("app")

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Check className="mt-0.5 size-5 shrink-0 text-success" />
        <p className="text-sm text-muted-foreground">
          {t("auth.register.sentMessage")}
        </p>
      </div>
      <p className="border-t border-border pt-3 text-sm text-muted-foreground">
        {t("auth.register.sentBack")}{" "}
        <Link to="/auth/login" className={linkClass}>
          {t("auth.login.title")}
        </Link>
      </p>
    </div>
  )
}
