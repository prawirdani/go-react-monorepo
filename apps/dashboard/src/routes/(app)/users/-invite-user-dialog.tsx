import { useTranslations } from "@repo/i18n"
import { registerSchema } from "@repo/schemas/auth"
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
import { UserPlus } from "@repo/ui/icons"
import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { setFormErrors, useAppForm } from "@/components/form"
import { useErrorHandler } from "@/hooks/use-error-handler"
import { inviteUser } from "@/lib/data-access/mutations"

const EMPTY = { name: "", email: "" }

export function InviteUserDialog() {
  const [open, setOpen] = useState(false)
  const handleError = useErrorHandler()
  const t = useTranslations("app")
  const tc = useTranslations("common")

  const { mutateAsync } = useMutation(inviteUser)

  const form = useAppForm({
    defaultValues: EMPTY,
    validators: {
      onSubmit: registerSchema,
    },
    onSubmit: async ({ value, formApi }) => {
      try {
        await mutateAsync(value)
        toast.success(t("users.invite.success"))
        setOpen(false)
        formApi.reset()
      } catch (error) {
        handleError(error, {
          VALIDATION: (e) => setFormErrors(formApi, e.details),
        })
      }
    },
  })

  const handleOpenChange = (next: boolean) => {
    if (form.state.isSubmitting) return
    if (next) form.reset(EMPTY)
    setOpen(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <UserPlus />
            {t("users.invite.action")}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("users.invite.title")}</DialogTitle>
          <DialogDescription>{t("users.invite.description")}</DialogDescription>
        </DialogHeader>

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
                name="email"
                children={(field) => (
                  <field.Container>
                    <field.Label text={t("auth.fields.email")} required />
                    <div>
                      <field.TextField
                        type="email"
                        placeholder={t("auth.fields.emailPlaceholder")}
                      />
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
                  render={<Button variant="outline" disabled={isSubmitting} />}
                >
                  {tc("actions.cancel")}
                </DialogClose>
              )}
            />
            <form.SubmitButton>{t("users.invite.action")}</form.SubmitButton>
          </DialogFooter>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  )
}
