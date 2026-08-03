import { GenderLabels, type User, updateUserSchema } from "@repo/schemas/user"
import { Button } from "@repo/ui/components/button"
import { FieldGroup } from "@repo/ui/components/field"
import { Separator } from "@repo/ui/components/separator"
import toast from "@repo/ui/components/toast"
import { useRouter } from "@tanstack/react-router"
import { setFormErrors, useAppForm } from "@/components/form"
import { useErrorHandler } from "@/hooks/use-error-handler"
import { userAPI } from "@/lib/api"
import { authActions } from "@/stores/auth-store"

interface UpdateUserFormProps {
  user: User
  onClose: () => void
}

export const GenderSelectOptions = Object.entries(GenderLabels).map(
  ([value, label]) => ({
    value: value,
    label,
  }),
)

export function UpdateUserForm({ user, onClose }: UpdateUserFormProps) {
  const handleError = useErrorHandler()
  const router = useRouter()

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
        await userAPI.updateUser(value)
        await authActions.invalidate()
        await router.invalidate()
        toast.success("Profile berhasil diperbarui")
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
        <FieldGroup className="mb-8 gap-2.5">
          <Separator />
          <form.AppField
            name="name"
            children={(field) => (
              <field.Container
                orientation="horizontal"
                className="justify-between [&>*]:w-1/2"
              >
                <field.Label text="Nama" required />
                <div>
                  <field.TextField placeholder="Masukkan nama Anda" />
                  <field.Errors />
                </div>
              </field.Container>
            )}
          />

          <Separator />

          <form.AppField
            name="phone"
            children={(field) => (
              <field.Container
                orientation="horizontal"
                className="justify-between [&>*]:w-1/2"
              >
                <field.Label text="No Handphone" />
                <div>
                  <field.TextField placeholder="Masukkan nomor handphone Anda" />
                  <field.Errors />
                </div>
              </field.Container>
            )}
          />

          <Separator />

          <form.AppField
            name="gender"
            children={(field) => (
              <field.Container
                orientation="horizontal"
                className="justify-between [&>*]:w-1/2"
              >
                <field.Label text="Jenis Kelamin" />
                <div>
                  <field.Select
                    className="w-full"
                    items={GenderSelectOptions}
                  />
                  <field.Errors />
                </div>
              </field.Container>
            )}
          />
        </FieldGroup>

        <div className="[&>button]:min-w-28 flex gap-2 justify-center">
          <form.SubmitButton>Simpan</form.SubmitButton>
          <form.Subscribe
            selector={(state) => [state.isSubmitting]}
            children={([isSubmitting]) => (
              <Button
                variant="outline"
                disabled={isSubmitting}
                onClick={onClose}
              >
                Batal
              </Button>
            )}
          />
        </div>
      </form.Root>
    </form.AppForm>
  )
}
