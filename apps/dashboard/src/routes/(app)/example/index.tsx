import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/(app)/example/")({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Example Page</div>
}
