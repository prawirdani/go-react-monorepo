import { resetPasswordSchema } from "@repo/schemas/auth"
import { Card, CardContent } from "@repo/ui/components/card"
import { FieldGroup } from "@repo/ui/components/field"
import { Check, ClockX } from "@repo/ui/icons"
import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import z from "zod"
import { setFormErrors, useAppForm } from "@/components/form"
import { useErrorHandler } from "@/hooks/use-error-handler"
import { authAPI } from "@/lib/api"

const search = z.object({
  token: z.string(),
})

export const Route = createFileRoute("/auth/reset-password")({
  validateSearch: search,
  beforeLoad: async ({ search }) => {
    if (!search.token) {
      throw redirect({ to: "/login", replace: true })
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

function RouteComponent() {
  const { token, invalid } = Route.useLoaderData()
  const handleError = useErrorHandler()

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
        await authAPI.resetPassword({
          token: value.token,
          new_password: value.new_password,
        })
      } catch (error) {
        handleError(error, {
          VALIDATION: (e) => setFormErrors(formApi, e.details),
        })
      }
    },
  })

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center p-6 md:p-10 gap-8">
      <p className="text-xl font-bold text-center">Atur Ulang Kata Sandi</p>
      <Card className="w-full md:w-[60%] xl:w-[30%] [--card-spacing:--spacing(6)]!">
        <CardContent className="flex-1 flex flex-col">
          {invalid ? (
            <InvalidContent />
          ) : (
            <form.Subscribe selector={(state) => state.isSubmitSuccessful}>
              {(success) =>
                success ? (
                  <SuccessContent />
                ) : (
                  <form.AppForm>
                    <form.Root className="flex-1 flex flex-col gap-8">
                      <FieldGroup className="flex-1">
                        <form.AppField
                          name="new_password"
                          children={(field) => (
                            <field.Container>
                              <field.Label text="Kata sandi baru" required />
                              <field.TextField
                                placeholder="Masukkan kata sandi baru Anda"
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
                                text="Konfirmasi kata sandi baru"
                                required
                              />
                              <field.TextField
                                placeholder="Masukkan ulang kata sandi baru Anda"
                                type="password"
                              />
                              <field.Errors />
                            </field.Container>
                          )}
                        />
                      </FieldGroup>
                      <form.SubmitButton className="w-full">
                        Simpan
                      </form.SubmitButton>
                    </form.Root>
                  </form.AppForm>
                )
              }
            </form.Subscribe>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function InvalidContent() {
  return (
    <>
      <ClockX className="size-12 shrink-0 mx-auto mb-1.5" />
      <p className="font-medium text-base text-center">
        Tautan telah kedaluwarsa atau tidak valid.
      </p>
      <span className="text-center mt-3">
        Silakan{" "}
        <Link
          to="/auth/forgot-password"
          className="hover:underline inline text-blue-600 cursor-pointer hover:text-purple-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          ajukan kembali
        </Link>{" "}
        permintaan atur ulang kata sandi baru untuk mendapatkan tautan yang
        dapat digunakan.
      </span>
    </>
  )
}

function SuccessContent() {
  return (
    <>
      <Check className="size-12 text-green-500 mx-auto" />
      <p className="text-center text-base">
        Kata sandi Anda berhasil diperbarui,{" "}
        <Link
          to="/login"
          className="hover:underline inline text-blue-600 cursor-pointer hover:text-purple-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          login
        </Link>
        .
      </p>
    </>
  )
}
