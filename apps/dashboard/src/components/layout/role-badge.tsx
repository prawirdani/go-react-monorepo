import { useTranslations } from "@repo/i18n"
import type { Role } from "@repo/schemas/user"
import { cn } from "@repo/ui/lib/utils"
import { StateBadge } from "@/components/layout/panel"
import { RoleLabel } from "@/lib/i18n"

/**
 * A role is an attribute, never state — so it carries no saturation and one
 * shared marker serves both surfaces:
 *
 * - `chip`: the contained outline marker, used inline with the account name.
 * - `value`: the same mono uppercase micro-label, sized for a label/value row.
 */
export function RoleBadge({
  role,
  variant = "chip",
  className,
}: {
  role: Role
  variant?: "chip" | "value"
  className?: string
}) {
  const t = useTranslations("app")
  const label = RoleLabel(t, role)

  if (variant === "value") {
    return (
      <span className={cn("panel-label font-mono", className)}>{label}</span>
    )
  }

  return <StateBadge className={cn("shrink-0", className)}>{label}</StateBadge>
}
