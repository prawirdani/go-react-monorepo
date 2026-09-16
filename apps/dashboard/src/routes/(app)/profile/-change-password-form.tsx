import { useTranslations } from "@repo/i18n"
import { changePasswordSchema } from "@repo/schemas/auth"
import { Button } from "@repo/ui/components/button"
import { FieldGroup } from "@repo/ui/components/field"
import toast from "@repo/ui/components/toast"
import { setFormErrors, useAppForm } from "@/components/form"
import { useErrorHandler } from "@/hooks/use-error-handler"
import { authAPI } from "@/lib/api"

interface ChangePasswordFormProps {
  onClose: () => void
}

export function ChangePasswordForm({ onClose }: ChangePasswordFormProps) {
  const handleError = useErrorHandler()
  const t = useTranslations("app")
  const tc = useTranslations("common")

  const form = useAppForm({
    defaultValues: {
      password: "",
      new_password: "",
      new_password_confirmation: "",
    },
    validators: {
      onSubmit: changePasswordSchema,
    },
    onSubmit: async ({ value, formApi }) => {
      try {
        await authAPI.changePassword(value)
        toast.success(t("profile.changePassword.success"))
        onClose()
        form.reset()
      } catch (error) {
        handleError(error, {
          VALIDATION: (e) => setFormErrors(formApi, e.details),
          AUTH_CREDENTIALS: () => {
            setFormErrors(formApi, {
              password: t("profile.changePassword.mismatch"),
            })
          },
        })
      }
    },
  })

  return (
    <form.AppForm>
      <form.Root className="flex-1 flex flex-col gap-8">
        <FieldGroup className="grid sm:grid-cols-2 gap-4">
          <form.AppField
            name="password"
            children={(field) => (
              <field.Container>
                <field.Label
                  text={t("profile.changePassword.currentLabel")}
                  required
                />
                <field.TextField
                  placeholder={t("profile.changePassword.currentPlaceholder")}
                  type="password"
                  autoComplete="on"
                />
                <field.Errors />
              </field.Container>
            )}
          />

          <form.AppField
            name="new_password"
            children={(field) => (
              <field.Container className="sm:col-start-1 sm:row-start-2">
                <field.Label
                  text={t("profile.changePassword.newLabel")}
                  required
                />
                <field.TextField
                  placeholder={t("profile.changePassword.newPlaceholder")}
                  type="password"
                  autoComplete="new-password"
                />
                <field.Errors />
              </field.Container>
            )}
          />

          <form.AppField
            name="new_password_confirmation"
            children={(field) => (
              <field.Container className="sm:col-start-2 sm:row-start-2">
                <field.Label
                  text={t("profile.changePassword.confirmLabel")}
                  required
                />

                <field.TextField
                  placeholder={t("profile.changePassword.confirmPlaceholder")}
                  type="password"
                  autoComplete="new-password-confirmation"
                />
                <field.Errors />
              </field.Container>
            )}
          />
        </FieldGroup>

        <div className="flex justify-end gap-2 [&_button]:min-w-28">
          <form.SubmitButton>{tc("actions.save")}</form.SubmitButton>
          <Button variant="outline" onClick={onClose}>
            {tc("actions.cancel")}
          </Button>
        </div>
      </form.Root>
    </form.AppForm>
  )
}
