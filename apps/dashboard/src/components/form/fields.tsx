import { type Translator, useTranslations } from "@repo/i18n"
import { Button } from "@repo/ui/components/button"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips as ComboboxChipsComp,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxPrimitive,
  ComboboxValue,
  useComboboxAnchor,
} from "@repo/ui/components/combobox"
import {
  Field,
  FieldError as FieldErrorComp,
  FieldLabel,
} from "@repo/ui/components/field"
import { Input } from "@repo/ui/components/input"
import {
  Select as SelectComp,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import { Switch, type SwitchProps } from "@repo/ui/components/switch"
import { Textarea } from "@repo/ui/components/textarea"
import { X } from "@repo/ui/icons"
import { cn } from "@repo/ui/lib/utils"
import type { AnyFieldApi } from "@tanstack/react-form"
import {
  type ComponentPropsWithoutRef,
  type PropsWithChildren,
  useMemo,
} from "react"
import { useFieldContext, useFormContext } from "./context"

/**
 * Zod emits message keys; the API layer puts raw server text into field errors.
 * A value that resolves as a key is translated, anything else passes through.
 * `t.has()` is the discriminator — no prefix matching.
 */
function resolveMessage(t: Translator, value: string): string {
  const key = value as Parameters<Translator["has"]>[0]
  return t.has(key) ? t(key) : value
}

type ContainerProps = PropsWithChildren<
  ComponentPropsWithoutRef<"div"> & {
    orientation?: "horizontal" | "vertical"
  }
>

export function Container({ children, orientation, ...props }: ContainerProps) {
  const field = useFieldContext()
  const invalid = isFieldInvalid(field)

  return (
    <Field {...props} data-invalid={invalid} orientation={orientation}>
      {children}
    </Field>
  )
}

type LabelProps = ComponentPropsWithoutRef<"label"> & {
  text: string
  required?: boolean
}

export function Label({ text, className, required, ...props }: LabelProps) {
  const field = useFieldContext()

  return (
    <FieldLabel
      {...props}
      htmlFor={field.name}
      className={cn("inline-flex items-center gap-0.5", className)}
    >
      {text}
      {required && (
        <span
          aria-hidden="true"
          className="text-destructive text-[length:var(--text-label-size)] font-bold leading-none select-none self-start mt-0.5"
        >
          *
        </span>
      )}
    </FieldLabel>
  )
}

type TextFieldProps = Omit<
  ComponentPropsWithoutRef<"input">,
  "id" | "name" | "value" | "onBlur" | "onChange" | "aria-invalid"
>

export function TextField(props: TextFieldProps) {
  const field = useFieldContext<string>()
  const invalid = isFieldInvalid(field)
  return (
    <Input
      {...props}
      id={field.name}
      name={field.name}
      value={field.state.value ?? ""}
      onBlur={field.handleBlur}
      onChange={(e) => field.handleChange(e.target.value)}
      aria-invalid={invalid}
      autoComplete={props.autoComplete ?? "off"}
    />
  )
}

type NumberFieldProps = Omit<
  ComponentPropsWithoutRef<"input">,
  | "id"
  | "name"
  | "value"
  | "onBlur"
  | "onChange"
  | "aria-invalid"
  | "type"
  | "inputMode"
>

export function NumberField(props: NumberFieldProps) {
  const field = useFieldContext<number | null>()
  const invalid = isFieldInvalid(field)
  return (
    <Input
      {...props}
      type="number"
      inputMode="numeric"
      id={field.name}
      name={field.name}
      value={field.state.value ?? ""}
      onBlur={field.handleBlur}
      onChange={(e) => {
        const { value, valueAsNumber } = e.target
        field.handleChange(value === "" ? null : valueAsNumber)
      }}
      aria-invalid={invalid}
      autoComplete={props.autoComplete ?? "off"}
    />
  )
}

export function PriceField({
  className,
  placeholder,
  ...props
}: Omit<TextFieldProps, "type" | "inputMode">) {
  const field = useFieldContext<number>()

  const displayValue =
    field.state.value === 0 ? "" : field.state.value.toLocaleString("id-ID")

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, "")
    const numValue = rawValue === "" ? 0 : parseInt(rawValue, 10)

    field.handleChange(numValue)
  }

  const invalid = isFieldInvalid(field)

  return (
    <div className="relative flex items-center">
      <span className="absolute left-3 text-muted-foreground text-sm select-none pointer-events-none">
        Rp
      </span>
      <Input
        {...props}
        className={cn("pl-9", className)}
        id={field.name}
        name={field.name}
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        value={displayValue}
        onBlur={field.handleBlur}
        onChange={handleChange}
        aria-invalid={invalid}
      />
    </div>
  )
}

type SwitchToggleProps = Omit<
  SwitchProps,
  "id" | "name" | "checked" | "onCheckedChange" | "aria-invalid"
>

export function SwitchToggle(props: SwitchToggleProps) {
  const field = useFieldContext<boolean>()
  const invalid = isFieldInvalid(field)

  return (
    <Switch
      {...props}
      id={field.name}
      name={field.name}
      checked={field.state.value}
      onCheckedChange={field.handleChange}
      aria-invalid={invalid}
    />
  )
}

type TextAreaFieldProps = Omit<
  ComponentPropsWithoutRef<"textarea">,
  "id" | "name" | "value" | "onBlur" | "onChange" | "aria-invalid"
>

export function TextAreaField(props: TextAreaFieldProps) {
  const field = useFieldContext<string>()
  const invalid = isFieldInvalid(field)
  return (
    <Textarea
      {...props}
      id={field.name}
      name={field.name}
      value={field.state.value ?? ""}
      onBlur={field.handleBlur}
      onChange={(e) => field.handleChange(e.target.value)}
      aria-invalid={invalid}
    />
  )
}

type FileFieldProps = Omit<
  ComponentPropsWithoutRef<"input">,
  "id" | "name" | "value" | "onBlur" | "onChange" | "aria-invalid" | "type"
> & {
  accept: string
}

/* TODO: With Image Preview */
export function FileField({ accept, ...props }: FileFieldProps) {
  const field = useFieldContext<File>()
  const invalid = isFieldInvalid(field)

  return (
    <Input
      {...props}
      type="file"
      accept={accept}
      id={field.name}
      name={field.name}
      onBlur={field.handleBlur}
      onChange={(e) => {
        const files = e.target.files
        if (files?.[0]) {
          field.handleChange(files[0])
        }
      }}
      aria-invalid={invalid}
    />
  )
}

type SelectProps<T> = {
  className?: string
  placeholder?: string
  items: { value: T; label: string }[]
}

export function Select<T extends string | number>({
  items,
  placeholder,
  className,
}: SelectProps<T>) {
  const field = useFieldContext<T>()
  const invalid = isFieldInvalid(field)

  return (
    <SelectComp
      id={field.name}
      name={field.name}
      value={field.state.value}
      onValueChange={(v) => field.handleChange(v as T)}
      items={items}
    >
      <SelectTrigger
        className={className}
        id={field.name}
        name={field.name}
        aria-invalid={invalid}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent side="bottom" alignItemWithTrigger={false}>
        <SelectGroup>
          {items.map((item) => (
            <SelectItem
              key={item.value}
              value={item.value}
              className="max-sm:py-3"
            >
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </SelectComp>
  )
}

type ComboboxChipsProps<T> = {
  items: { value: T; label: string }[]
}

/**
 * This is non native html input, so there is no need to use Label alongside this component
 */
export function ComboboxChips<T extends string | number>({
  items,
}: ComboboxChipsProps<T>) {
  const anchor = useComboboxAnchor()

  const field = useFieldContext<T[]>()

  const selectedItems = useMemo(() => {
    const valuesSet = new Set(field.state.value || [])
    return items.filter((item) => valuesSet.has(item.value))
  }, [field.state.value, items])

  const handleOnValueChange = (nextValue: (typeof items)[number][]) => {
    field.handleChange(nextValue.map((v) => v.value))
  }

  return (
    <Combobox
      multiple
      value={selectedItems}
      onValueChange={handleOnValueChange}
      items={items}
      itemToStringValue={(item) => item.label}
    >
      <ComboboxChipsComp ref={anchor} className="min-h-12 flex items-stretch">
        <ComboboxValue>
          {selectedItems.map((item) => (
            <ComboboxChip
              key={item.value}
              showRemove={false}
              className="contents"
            >
              <ComboboxPrimitive.ChipRemove
                render={
                  <Button variant="outline" className="border">
                    <span>{item.label}</span>
                    <X className="size-3" />
                  </Button>
                }
              />
            </ComboboxChip>
          ))}
        </ComboboxValue>
        <ComboboxChipsInput
          placeholder="Klik untuk tautkan modifikasi menu"
          className="hover:cursor-pointer flex-1"
        />
      </ComboboxChipsComp>
      <ComboboxContent anchor={anchor} side="top" align="center">
        <ComboboxEmpty>Belum ada data modifikasi menu.</ComboboxEmpty>
        <ComboboxList>
          {(item) => (
            <ComboboxItem
              key={item.value}
              value={item}
              className="max-sm:py-3 max-sm:not-last:border-b"
            >
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

export function Errors() {
  const field = useFieldContext()
  const t = useTranslations()
  const invalid = isFieldInvalid(field)

  if (!invalid) return null

  const errors = field.state.meta.errors.map((error) => {
    const message =
      typeof error === "string"
        ? error
        : (error as { message?: string } | undefined)?.message

    if (typeof message !== "string") return undefined

    return { message: resolveMessage(t, message) }
  })

  return <FieldErrorComp errors={errors} />
}

type RootErrorProps = {
  children?: (error: string) => React.ReactNode
}

export function RootError({ children }: RootErrorProps) {
  const form = useFormContext()

  return (
    <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
      {(error) => {
        if (typeof error !== "string") {
          return null
        }

        if (children) {
          return children(error)
        }

        return (
          <span className="text-destructive text-sm" role="alert">
            {error}
          </span>
        )
      }}
    </form.Subscribe>
  )
}

const isFieldInvalid = (field: AnyFieldApi) => {
  return field.state.meta.isTouched && field.state.meta.errors.length > 0
}
