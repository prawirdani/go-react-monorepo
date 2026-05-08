import { Card, CardContent } from "@repo/ui/components/card"
import { Skeleton } from "@repo/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table"
import { createFileRoute } from "@tanstack/react-router"
import { Page } from "@/components/layout/page"

export const Route = createFileRoute("/(app)/example/")({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <Page
      title="Example Page"
      description="Lorem Ipsum Dolor Apsimet"
      breadcrumbs={[{ name: "Dashboard", href: "/" }, { name: "Example" }]}
    >
      <Card>
        <CardContent>
          <Table>
            <colgroup>
              <col className="w-[30%]" />
              <col className="w-[20%]" />
              <col className="w-[40%]" />
              <col className="w-auto" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>Col</TableHead>
                <TableHead>Col</TableHead>
                <TableHead>Col</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: yes
                <TableRow key={i} className="[&>td]:py-4">
                  <TableCell>
                    <Skeleton className="w-1/3 h-6" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="w-2/3 h-6" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="w-3/3 h-6" />
                  </TableCell>
                  <TableCell className="flex justify-end">
                    <Skeleton className="w-24 h-8" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Page>
  )
}
