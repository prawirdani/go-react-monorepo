import { useTranslations } from "@repo/i18n"
import { type User, updateUserSchema } from "@repo/schemas/user"
import { Button } from "@repo/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog"
import { FieldGroup } from "@repo/ui/components/field"
import toast from "@repo/ui/components/toast"
import { Edit } from "@repo/ui/icons"
import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { setFormErrors, useAppForm } from "@/components/form"
import { useErrorHandler } from "@/hooks/use-error-handler"
import { updateUser } from "@/lib/data-access/mutations"
import { GenderOptions } from "@/lib/i18n"

interface EditUserDialogProps {
  user: User
}

export function EditUserDialog({ user }: EditUserDialogProps) {
  const [open, setOpen] = useState(false)
  const handleError = useErrorHandler()
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
        toast.success(t("users.edit.success"))
        setOpen(false)
        formApi.reset(value)
      } catch (error) {
        handleError(error, {
          VALIDATION: (e) => setFormErrors(formApi, e.details),
        })
      }
    },
  })

  const handleOpenChange = (next: boolean) => {
    if (form.state.isSubmitting) return
    if (next) {
      // Re-seed from the current row so a refetch after an earlier edit shows.
      form.reset({ name: user.name, phone: user.phone, gender: user.gender })
    }
    setOpen(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            title={t("users.edit.action")}
            aria-label={t("users.edit.action")}
          >
            <Edit />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("users.edit.title")}</DialogTitle>
          <DialogDescription>{t("users.edit.description")}</DialogDescription>
        </DialogHeader>
        <p className="truncate font-mono text-xs text-muted-foreground">
          {user.name}
        </p>

        <form.AppForm>
          <form.Root className="w-full flex flex-col">
            <FieldGroup className="gap-4">
              <form.AppField
                name="name"
                children={(field) => (
                  <field.Container>
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
                  <field.Container>
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
                  <field.Container>
                    <field.Label text={t("profile.identity.gender")} />
                    <div>
                      <field.Select className="w-full" items={genderOptions} />
                      <field.Errors />
                    </div>
                  </field.Container>
                )}
              />
            </FieldGroup>
          </form.Root>

          <DialogFooter>
            <form.Subscribe
              selector={(state) => [state.isSubmitting]}
              children={([isSubmitting]) => (
                <DialogClose
                  render={
                    <Button variant="outline" disabled={isSubmitting} />
                  }
                >
                  {tc("actions.cancel")}
                </DialogClose>
              )}
            />
            <form.SubmitButton>{tc("actions.save")}</form.SubmitButton>
          </DialogFooter>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  )
}
