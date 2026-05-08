import { createFormHook } from "@tanstack/react-form"
import { Blocker, Root, SubmitButton } from "@/components/form/components"
import { fieldContext, formContext } from "./context"
import {
  ComboboxChips,
  Container,
  Errors,
  FileField,
  Label,
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
