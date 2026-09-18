import { useTranslations } from "@repo/i18n"
import { type User, updateUserSchema } from "@repo/schemas/user"
import { Button } from "@repo/ui/components/button"
import { FieldGroup } from "@repo/ui/components/field"
import toast from "@repo/ui/components/toast"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { setFormErrors, useAppForm } from "@/components/form"
import { useErrorHandler } from "@/hooks/use-error-handler"
import { updateUser } from "@/lib/data-access/mutations"
import { GenderOptions } from "@/lib/i18n"

interface UpdateUserFormProps {
  user: User
  onClose: () => void
}

export function UpdateUserForm({ user, onClose }: UpdateUserFormProps) {
  const handleError = useErrorHandler()
  const router = useRouter()
  const t = useTranslations("app")
  const tc = useTranslations("common")

  const genderOptions = GenderOptions(tc)

  const { mutateAsync } = useMutation(updateUser)
  const form = useAppForm({
    defaultValues: {
      name: user.name,
      phone: user.phone,
      gender: user.gender,
    },
    validators: {
      onSubmit: updateUserSchema,
    },
    onSubmit: async ({ value, formApi }) => {
      try {
        await mutateAsync({ userId: user.id, payload: value })
        await router.invalidate()
        toast.success(t("profile.updateUser.success"))
        onClose()
      } catch (error) {
        handleError(error, {
          VALIDATION: (e) => setFormErrors(formApi, e.details),
        })
      }
    },
  })

  return (
    <form.AppForm>
      <form.Root className="w-full flex flex-col">
        <FieldGroup className="gap-4">
          <form.AppField
            name="name"
            children={(field) => (
              <field.Container
                orientation="horizontal"
                className="justify-between [&>*]:w-1/2"
              >
                <field.Label text={t("profile.identity.name")} required />
                <div>
                  <field.TextField
                    placeholder={t("profile.updateUser.namePlaceholder")}
                  />
                  <field.Errors />
                </div>
              </field.Container>
            )}
          />

          <form.AppField
            name="phone"
            children={(field) => (
              <field.Container
                orientation="horizontal"
                className="justify-between [&>*]:w-1/2"
              >
                <field.Label text={t("profile.identity.phone")} />
                <div>
                  <field.TextField
                    type="number"
                    placeholder={t("profile.updateUser.phonePlaceholder")}
                  />
                  <field.Errors />
                </div>
              </field.Container>
            )}
          />

          <form.AppField
            name="gender"
            children={(field) => (
              <field.Container
                orientation="horizontal"
                className="justify-between [&>*]:w-1/2"
              >
                <field.Label text={t("profile.identity.gender")} />
                <div>
                  <field.Select className="w-full" items={genderOptions} />
                  <field.Errors />
                </div>
              </field.Container>
            )}
          />
        </FieldGroup>

        <div className="mt-6 flex justify-end gap-2 [&>button]:min-w-28">
          <form.SubmitButton>{tc("actions.save")}</form.SubmitButton>
          <form.Subscribe
            selector={(state) => [state.isSubmitting]}
            children={([isSubmitting]) => (
              <Button
                variant="outline"
                disabled={isSubmitting}
                onClick={onClose}
              >
                {tc("actions.cancel")}
              </Button>
            )}
          />
        </div>
      </form.Root>
    </form.AppForm>
  )
}
