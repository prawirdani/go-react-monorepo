import { loginSchema } from "@repo/schemas/auth"
import { FieldGroup } from "@repo/ui/components/field"
import { AlertTriangle } from "@repo/ui/icons"
import { cn } from "@repo/ui/lib/utils"
import {
  createFileRoute,
  getRouteApi,
  Link,
  redirect,
  useRouter,
} from "@tanstack/react-router"
import { z } from "zod"
import { setFormErrors, setFormRootError, useAppForm } from "@/components/form"
import { RootError } from "@/components/form/fields"
import { AuthPanel, AuthShell } from "@/components/layout/auth-shell"
import { useErrorHandler } from "@/hooks/use-error-handler"
import { authActions, useAuthStore } from "@/stores/auth-store"

const loginSearch = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute("/login")({
  validateSearch: loginSearch,
  beforeLoad: async ({ search }) => {
    const auth = useAuthStore.getState()
    if (auth.user) {
      throw redirect({ to: search.redirect || "/", replace: true })
    }
  },
  component: RouteComponent,
})

const linkClass =
  "rounded-sm text-primary outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-ring"

function RouteComponent() {
  return (
    <AuthShell>
      <AuthPanel
        title="Masuk"
        description="Gunakan akun internal Anda untuk melanjutkan ke konsol."
      >
        <LoginForm />
      </AuthPanel>
    </AuthShell>
  )
}

function LoginForm({ className }: { className?: string }) {
  const search = getRouteApi("/login").useSearch()
  const router = useRouter()
  const handleError = useErrorHandler()

  const form = useAppForm({
    defaultValues: {
      email: "",
      password: "",
    },
    validators: {
      onSubmit: loginSchema,
    },
    onSubmit: async ({ value, formApi }) => {
      try {
        await authActions.login(value)
        await router.invalidate()
        await router.navigate({ to: search.redirect || "/", replace: true })
      } catch (error) {
        handleError(error, {
          VALIDATION: (e) => setFormErrors(formApi, e.details),
          AUTH_CREDENTIALS: () => {
            setFormRootError(formApi, "Email atau kata sandi Anda salah")
          },
        })
      }
    },
  })

  return (
    <form.AppForm>
      <form.Root className={cn("flex flex-col gap-6", className)}>
        <FieldGroup className="gap-5">
          <form.AppField
            name="email"
            children={(field) => (
              <field.Container>
                <field.Label text="Email" required />
                <field.TextField
                  placeholder="Masukan alamat email Anda"
                  autoComplete="on"
                />
                <field.Errors />
              </field.Container>
            )}
          />

          <form.AppField
            name="password"
            children={(field) => (
              <field.Container>
                <div className="flex items-center justify-between gap-2">
                  <field.Label text="Kata Sandi" required />
                  <Link to="/auth/forgot-password" className={linkClass}>
                    Lupa password?
                  </Link>
                </div>
                <field.TextField
                  placeholder="Masukan kata sandi Anda"
                  type="password"
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

        <form.SubmitButton className="w-full">Masuk</form.SubmitButton>
      </form.Root>
    </form.AppForm>
  )
}
