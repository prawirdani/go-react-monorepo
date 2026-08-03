import { loginSchema } from "@repo/schemas/auth"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card"
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

function RouteComponent() {
  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Card className="min-h-[350px]">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Masuk</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
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
      <form.Root className={cn("flex-1 flex flex-col gap-8", className)}>
        <FieldGroup className="flex-1">
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
                <div className="flex justify-between items-center">
                  <field.Label text="Kata Sandi" required />
                  <Link
                    to="/auth/forgot-password"
                    className="hover:underline inline text-blue-600 cursor-pointer hover:text-purple-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
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
            <div className="outline outline-destructive rounded-sm p-2 flex gap-2 items-center bg-destructive/2">
              <AlertTriangle className="text-destructive" />
              <span className="text-destructive">{error}</span>
            </div>
          )}
        </RootError>

        <form.SubmitButton className="w-full">Masuk</form.SubmitButton>
      </form.Root>
    </form.AppForm>
  )
}
