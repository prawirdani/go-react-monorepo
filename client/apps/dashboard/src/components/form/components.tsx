import { useTranslations } from "@repo/i18n"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/alert-dialog"
import { Button, type ButtonProps } from "@repo/ui/components/button"
import { useBlocker } from "@tanstack/react-router"
import type { ComponentPropsWithoutRef, PropsWithChildren } from "react"
import { useFormContext } from "./context"

type RootProps = Omit<
  PropsWithChildren<ComponentPropsWithoutRef<"form">>,
  "id" | "onSubmit"
>

export function Root({ children, className, ...props }: RootProps) {
  const form = useFormContext()
  return (
    <form
      {...props}
      id={form.formId}
      className={className}
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
    >
      {children}
    </form>
  )
}

export function Blocker() {
  const form = useFormContext()

  return (
    <form.Subscribe selector={(state) => [state.isDirty, state.isDefaultValue]}>
      {([isDirty, isDefaultValue]) => (
        <BlockerDialog
          isDirty={isDirty && !isDefaultValue}
          onConfirm={() => form.reset()}
        />
      )}
    </form.Subscribe>
  )
}

interface BlockerDialog {
  isDirty: boolean
  onConfirm?: () => void
}

function BlockerDialog({ isDirty, onConfirm }: BlockerDialog) {
  const t = useTranslations("app")
  const tc = useTranslations("common")
  const { proceed, reset, status } = useBlocker({
    shouldBlockFn: () => isDirty,
    withResolver: true,
    enableBeforeUnload: false,
  })

  const handleProceed = () => {
    onConfirm?.()
    proceed?.()
  }

  return (
    <AlertDialog open={status === "blocked"}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("form.unsaved.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("form.unsaved.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="max-lg:[&>button]:flex-1 lg:[&>button]:min-w-24">
          <Button variant="outline" onClick={() => reset?.()}>
            {tc("actions.close")}
          </Button>
          <Button onClick={handleProceed}>{t("shared.yes")}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// type SubmitButtonProps = {
//   children: ReactNode
//   className?: string
// }

type SubmitButtonProps = Omit<
  ButtonProps,
  "loading" | "type" | "disabled" | "form"
> & {
  disabled?: boolean // optional: allow extra disabling logic from caller
}

/**
 * A submit button that controls a form via its ID.
 * Use this when the button is outside the <form> tag or for strict form association.
 * @param text - The label to display
 */
export function SubmitButton({
  children,
  disabled,
  ...props
}: SubmitButtonProps) {
  const { Subscribe, formId } = useFormContext()
  return (
    <Subscribe selector={(state) => [state.isSubmitting, state.canSubmit]}>
      {([isSubmitting, canSubmit]) => (
        <Button
          {...props}
          loading={isSubmitting}
          type="submit"
          disabled={disabled || !canSubmit}
          form={formId}
        >
          {children}
        </Button>
      )}
    </Subscribe>
  )
}
