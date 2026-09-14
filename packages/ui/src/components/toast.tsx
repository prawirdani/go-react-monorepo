import {
  IconAlertCircle,
  IconCircleCheck,
  IconInfoCircle,
  IconX,
} from "@tabler/icons-react"
import { cva } from "class-variance-authority"
import { toast as t } from "sonner"
import { cn } from "../lib/utils"
import { Button } from "./button"

const toastVariants = cva(
  "md:min-w-[380px] flex gap-4 p-4 items-center min-h-16 bg-card border rounded-md relative [&_svg]:size-8 [&_svg]:shrink-0 font-sans",
  {
    variants: {
      variant: {
        default: "border-border text-card-foreground",
        success: "border-success/50 text-card-foreground [&_svg]:text-success",
        error:
          "border-destructive/50 text-card-foreground [&_svg]:text-destructive",
        info: "border-info/50 text-card-foreground [&_svg]:text-info",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

const iconsMap: Record<string, React.ReactNode | undefined> = {
  default: undefined,
  success: <IconCircleCheck />,
  error: <IconAlertCircle />,
  info: <IconInfoCircle />,
}

type ToastConfig = {
  description?: string
  duration?: number
  closeButton?: boolean
}

function createToast(
  message: string,
  variant: "default" | "success" | "error" | "info" = "default",
  conf: ToastConfig = {},
) {
  const { description, duration = 2500, closeButton = false } = conf
  return t.custom(
    (tid) => (
      <div className={cn(toastVariants({ variant }))}>
        {iconsMap[variant]}
        <div className="flex-1 space-y-1">
          <p className="text-sm font-[600]">{message}</p>
          {description && <p className="text-sm leading-5">{description}</p>}
        </div>
        {closeButton && (
          <Button variant="ghost" size="icon" onClick={() => t.dismiss(tid)}>
            <IconX className="!text-foreground !size-5" />
          </Button>
        )}
      </div>
    ),
    { duration },
  )
}

// Main toast function (default variant)
function toast(message: string, conf: ToastConfig = {}) {
  createToast(message, "default", conf)
}

toast.success = (message: string, conf: ToastConfig = {}) =>
  createToast(message, "success", conf)

toast.error = (message: string, conf: ToastConfig = {}) =>
  createToast(message, "error", conf)

toast.info = (message: string, conf: ToastConfig = {}) =>
  createToast(message, "info", conf)

export default toast
