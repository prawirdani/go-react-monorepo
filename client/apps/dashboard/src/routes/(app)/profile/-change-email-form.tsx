import { useFormatter, useTranslations } from "@repo/i18n"
import { requestEmailChangeSchema } from "@repo/schemas/auth"
import { Button } from "@repo/ui/components/button"
import { FieldGroup } from "@repo/ui/components/field"
import toast from "@repo/ui/components/toast"
import { setFormErrors, useAppForm } from "@/components/form"
import { useErrorHandler } from "@/hooks/use-error-handler"
import { authAPI } from "@/lib/data-access/api"

interface ChangeEmailFormProps {
  onClose: () => void
}

export function ChangeEmailForm({ onClose }: ChangeEmailFormProps) {
  const handleError = useErrorHandler()
  const formatter = useFormatter()
  const t = useTranslations("app")
  const tc = useTranslations("common")

  const form = useAppForm({
    defaultValues: {
      new_email: "",
    },
    validators: {
      onSubmit: requestEmailChangeSchema,
    },
    onSubmit: async ({ value, formApi }) => {
      try {
        await authAPI.requestEmailChange(value)
        toast.success(t("profile.changeEmail.success"))
        onClose()
        form.reset()
        // Unlike change-password: the address is not the account's email until
        // the link sent to the new inbox is opened, so this session stays valid.
      } catch (error) {
        handleError(error, {
          VALIDATION: (e) => setFormErrors(formApi, e.details),
          USER_EMAIL_CONFLICT: () => {
            setFormErrors(formApi, {
              new_email: t("profile.changeEmail.conflict"),
            })
          },
          // The copy ends in "at", so the allowed time is appended in the same
          // sentence — same shape the global handler uses for recovery throttling.
          AUTH_EMAIL_CHANGE_THROTTLED: (e) => {
            toast.error(
              `${t("profile.changeEmail.throttled")} ${formatter.dateTime(
                new Date(e.details.retry_after),
                { dateStyle: "short", timeStyle: "short" },
              )}`,
            )
          },
        })
      }
    },
  })

  return (
    <form.AppForm>
      <form.Root className="flex-1 flex flex-col gap-8">
        <FieldGroup className="gap-4">
          <form.AppField
            name="new_email"
            children={(field) => (
              <field.Container>
                <field.Label text={t("profile.changeEmail.label")} required />
                <field.TextField
                  placeholder={t("profile.changeEmail.placeholder")}
                  type="email"
                  autoComplete="email"
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
