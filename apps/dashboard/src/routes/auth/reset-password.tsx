import { resetPasswordSchema } from "@repo/schemas/auth"
import { FieldGroup } from "@repo/ui/components/field"
import { Check, ClockX } from "@repo/ui/icons"
import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import z from "zod"
import { setFormErrors, useAppForm } from "@/components/form"
import { AuthPanel, AuthShell } from "@/components/layout/auth-shell"
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

const linkClass =
  "rounded-sm text-primary outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-ring"

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
    <AuthShell>
      <AuthPanel
        title="Atur Ulang Kata Sandi"
        description={
          invalid
            ? "Tautan ini tidak dapat digunakan lagi."
            : "Buat kata sandi baru untuk akun Anda."
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
      </AuthPanel>
    </AuthShell>
  )
}

function InvalidContent() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <ClockX className="mt-0.5 size-5 shrink-0 text-warning" />
        <p className="text-sm font-medium text-foreground">
          Tautan telah kedaluwarsa atau tidak valid.
        </p>
      </div>
      <p className="border-t border-border pt-3 text-sm text-muted-foreground">
        Silakan{" "}
        <Link to="/auth/forgot-password" className={linkClass}>
          ajukan kembali
        </Link>{" "}
        permintaan atur ulang kata sandi baru untuk mendapatkan tautan yang
        dapat digunakan.
      </p>
    </div>
  )
}

function SuccessContent() {
  return (
    <div className="flex items-start gap-3">
      <Check className="mt-0.5 size-5 shrink-0 text-success" />
      <p className="text-sm text-muted-foreground">
        Kata sandi Anda berhasil diperbarui,{" "}
        <Link to="/login" className={linkClass}>
          login
        </Link>
        .
      </p>
    </div>
  )
}
