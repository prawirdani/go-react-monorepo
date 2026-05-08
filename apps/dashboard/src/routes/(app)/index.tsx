import { Card } from "@repo/ui/components/card"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/(app)/")({
  component: Component,
})

function Component() {
  return (
    <div className="h-full text-center">
      <div className="grid md:grid-cols-3 gap-6 [&_div]:(h-180px)">
        <Card className="h-[180px] flex flex-col justify-center items-center">
          <code>This is card</code>
        </Card>
        <Card className="h-[180px] flex flex-col justify-center items-center">
          <code>This is card</code>
        </Card>
        <Card className="h-[180px] flex flex-col justify-center items-center">
          <code>This is card</code>
        </Card>
        <Card className="md:col-span-2 h-[300px] flex flex-col justify-center items-center">
          <code>This is card</code>
        </Card>
        <Card className="h-[300px] flex flex-col justify-center items-center">
          <code>This is card</code>
        </Card>
        <Card className="md:col-span-3 h-[350px] flex flex-col justify-center items-center">
          <code>This is card</code>
        </Card>
      </div>
    </div>
  )
}
