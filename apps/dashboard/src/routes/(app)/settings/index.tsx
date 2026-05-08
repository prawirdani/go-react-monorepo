import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/(app)/settings/")({
  component: RouteComponent,
})

function RouteComponent() {
  return <p>Settings Page</p>
}
