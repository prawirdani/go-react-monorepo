import { useTranslations } from "@repo/i18n"
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
import {
  Panel,
  PanelBody,
  PanelGrid,
  PanelHeader,
  PanelNote,
  StateBadge,
} from "@/components/layout/panel"

export const Route = createFileRoute("/(app)/example/")({
  component: RouteComponent,
})

function RouteComponent() {
  const t = useTranslations("app")

  return (
    <Page
      title={t("example.title")}
      description={t("example.description")}
      breadcrumbs={[
        { name: t("dashboard.title"), href: "/" },
        { name: t("example.title") },
      ]}
    >
      <PanelGrid>
        <Panel className="animate-panel-in">
          <PanelHeader
            title={t("example.tablePanel")}
            aside={
              <StateBadge tone="warning">{t("dashboard.sampleTag")}</StateBadge>
            }
          />
          <PanelBody className="flex-1">
            <Table>
              <colgroup>
                <col className="w-[30%]" />
                <col className="w-[20%]" />
                <col className="w-[40%]" />
                <col className="w-auto" />
              </colgroup>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-3 panel-label">
                    {t("example.column")}
                  </TableHead>
                  <TableHead className="px-3 panel-label">
                    {t("example.column")}
                  </TableHead>
                  <TableHead className="px-3 panel-label">
                    {t("example.column")}
                  </TableHead>
                  <TableHead className="px-3" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: yes
                  <TableRow key={i}>
                    <TableCell className="px-3 py-4">
                      <Skeleton className="h-5 w-1/3" />
                    </TableCell>
                    <TableCell className="px-3 py-4">
                      <Skeleton className="h-5 w-2/3" />
                    </TableCell>
                    <TableCell className="px-3 py-4">
                      <Skeleton className="h-5 w-3/3" />
                    </TableCell>
                    <TableCell className="flex justify-end px-3 py-4">
                      <Skeleton className="h-8 w-24" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </PanelBody>
          <PanelNote className="border-t border-border">
            {t("example.note")}
          </PanelNote>
        </Panel>
      </PanelGrid>
    </Page>
  )
}
