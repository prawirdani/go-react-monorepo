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
  redirect,
  useRouter,
} from "@tanstack/react-router"
import { useState } from "react"
import { z } from "zod"
import { useAppForm } from "@/components/form"
import { useErrorHandler } from "@/hooks/use-error-handler"
import { authActions } from "@/lib/auth"
import { useAuthStore } from "@/stores/auth-store"

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
  const [rootError, setRootError] = useState<string | null>(null)

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
    onSubmit: async ({ value }) => {
      try {
        await authActions.login(value)
        router.invalidate()
        router.navigate({ to: search.redirect || "/", replace: true })
      } catch (error) {
        // if (error instanceof ForbiddenAccessError) {
        //   setRootError("Akun Anda tidak memiliki akses ke Dashboard")
        //   return
        // }

        handleError(error, (apiErr) => {
          if (apiErr.code === "AUTH_CREDENTIALS") {
            setRootError("Email atau kata sandi Anda salah")
            return true
          }
          return false
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
                <field.Label text="Kata Sandi" required />
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

        {rootError && (
          <div className="outline outline-destructive rounded-sm p-2 flex gap-2 items-center bg-destructive/2">
            <AlertTriangle className="text-destructive" />
            <span className="text-destructive">{rootError}</span>
          </div>
        )}

        <form.SubmitButton className="w-full" text="Masuk" />
      </form.Root>
    </form.AppForm>
  )
}
