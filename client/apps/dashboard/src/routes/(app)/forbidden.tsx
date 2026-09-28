import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { Forbidden } from "@/components/route-errors"

const forbiddenSearch = z.object({
  from: z.string().optional(),
})

export const Route = createFileRoute("/(app)/forbidden")({
  validateSearch: forbiddenSearch,
  component: RouteComponent,
})

function RouteComponent() {
  const { from } = Route.useSearch()

  return <Forbidden from={from} />
}
