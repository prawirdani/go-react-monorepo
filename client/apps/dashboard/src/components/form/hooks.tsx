import { createFormHook } from "@tanstack/react-form"
import { Blocker, Root, SubmitButton } from "@/components/form/components"
import { fieldContext, formContext } from "./context"
import {
  ComboboxChips,
  Container,
  Errors,
  FileField,
  Label,
  NumberField,
  PriceField,
  Select,
  SwitchToggle,
  TextAreaField,
  TextField,
} from "./fields"

export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    Container,
    Label,
    TextField,
    NumberField,
    PriceField,
    TextAreaField,
    FileField,
    SwitchToggle,
    Select,
    ComboboxChips,
    Errors,
  },
  formComponents: {
    Blocker,
    Root,
    SubmitButton,
  },
})
