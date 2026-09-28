import { createFileRoute } from "@tanstack/react-router"
import { ACCESS, guard } from "@/lib/auth/access"

export const Route = createFileRoute("/(app)/users")({
  beforeLoad: guard(ACCESS.users),
})
