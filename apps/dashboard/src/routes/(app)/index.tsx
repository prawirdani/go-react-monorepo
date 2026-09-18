import { type MessageKeys, useTranslations } from "@repo/i18n"
import { createFileRoute } from "@tanstack/react-router"
import { Page } from "@/components/layout/page"
import {
  Panel,
  PanelBody,
  PanelGrid,
  PanelHeader,
  PanelNote,
  PanelRow,
  PanelRows,
  StateBadge,
  type Tone,
} from "@/components/layout/panel"

export const Route = createFileRoute("/(app)/")({
  component: Component,
})

// Sample figures are data, not copy — only the labels are translated.
const summary: { labelKey: MessageKeys<"app">; value: string; tone?: Tone }[] =
  [
    { labelKey: "dashboard.summary.entriesToday", value: "128" },
    {
      labelKey: "dashboard.summary.awaitingReview",
      value: "12",
      tone: "warning",
    },
    {
      labelKey: "dashboard.summary.failedProcessing",
      value: "3",
      tone: "destructive",
    },
    { labelKey: "dashboard.summary.lastSync", value: "09:41 WIB" },
  ]

const services: {
  nameKey: MessageKeys<"app">
  stateKey: MessageKeys<"app">
  tone: Tone
}[] = [
  {
    nameKey: "dashboard.service.api",
    stateKey: "dashboard.serviceState.normal",
    tone: "success",
  },
  {
    nameKey: "dashboard.service.auth",
    stateKey: "dashboard.serviceState.normal",
    tone: "success",
  },
  {
    nameKey: "dashboard.service.storage",
    stateKey: "dashboard.serviceState.slow",
    tone: "warning",
  },
  {
    nameKey: "dashboard.service.taskQueue",
    stateKey: "dashboard.serviceState.disrupted",
    tone: "destructive",
  },
  {
    nameKey: "dashboard.service.backup",
    stateKey: "dashboard.serviceState.scheduled",
    tone: "info",
  },
]

function SampleTag() {
  const t = useTranslations("app")
  return <StateBadge tone="warning">{t("dashboard.sampleTag")}</StateBadge>
}

function Component() {
  const t = useTranslations("app")
  // const canReadAudit = useCan("audit.read")

  return (
    <Page title={t("dashboard.title")} description={t("dashboard.description")}>
      <PanelGrid className="lg:grid-cols-12">
        <Panel className="animate-panel-in lg:col-span-7">
          <PanelHeader
            title={t("dashboard.panels.summary")}
            aside={<SampleTag />}
          />
          <PanelBody className="flex-1">
            <PanelRows>
              {summary.map((row) => (
                <PanelRow
                  key={row.labelKey}
                  label={t(row.labelKey)}
                  value={row.value}
                  tone={row.tone}
                />
              ))}
            </PanelRows>
          </PanelBody>
          <PanelNote className="border-t border-border">
            {t("dashboard.summaryNote")}
          </PanelNote>
        </Panel>

        <Panel className="lg:col-span-5">
          <PanelHeader
            title={t("dashboard.panels.services")}
            aside={<SampleTag />}
          />
          <PanelBody className="flex-1">
            <ul className="divide-y divide-border">
              {services.map((service) => (
                <li
                  key={service.nameKey}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <span className="min-w-0 truncate text-sm">
                    {t(service.nameKey)}
                  </span>
                  <StateBadge tone={service.tone}>
                    {t(service.stateKey)}
                  </StateBadge>
                </li>
              ))}
            </ul>
          </PanelBody>
        </Panel>

        {/* <Panel className="lg:col-span-5"> */}
        {/*   <PanelHeader title={t("dashboard.panels.actions")} /> */}
        {/*   <PanelBody className="flex-1 justify-between gap-5 p-3"> */}
        {/*     <p className="max-w-[46ch] text-sm text-muted-foreground"> */}
        {/*       {t("dashboard.actionsNote")} */}
        {/*     </p> */}
        {/*     <div className="flex flex-wrap items-center gap-2"> */}
        {/*       <Button nativeButton={false} render={<Link to="/example" />}> */}
        {/*         {t("dashboard.openExample")} */}
        {/*       </Button> */}
        {/*       <Button */}
        {/*         variant="ghost" */}
        {/*         nativeButton={false} */}
        {/*         render={<Link to="/settings" />} */}
        {/*       > */}
        {/*         {t("dashboard.openSettings")} */}
        {/*       </Button> */}
        {/*     </div> */}
        {/*   </PanelBody> */}
        {/* </Panel> */}

        {/* Admin-only: omitted entirely without `audit.read`, so the grid
            reflows to the three panels a non-admin may see. */}
        {/* {canReadAudit && ( */}
        {/*   <AuditPanel enableQuery={canReadAudit} className="lg:col-span-7" /> */}
        {/* )} */}
      </PanelGrid>
    </Page>
  )
}

// function AuditPanel({
//   className,
//   enableQuery,
// }: {
//   className?: string
//   enableQuery: boolean
// }) {
//   const t = useTranslations("app")
//   const { data, isPending, isError } = useQuery({
//     ...auditQueries.list,
//     enabled: enableQuery,
//   })
//
//   const entries = data ?? []
//
//   return (
//     <Panel className={className}>
//       <PanelHeader title={t("dashboard.panels.audit")} />
//       <PanelBody className="flex-1">
//         {isPending ? (
//           <AuditLoading />
//         ) : isError ? (
//           <p role="alert" className="px-3 py-4 text-sm text-destructive">
//             {t("dashboard.audit.error")}
//           </p>
//         ) : entries.length === 0 ? (
//           <p className="px-3 py-4 text-sm text-muted-foreground">
//             {t("dashboard.audit.empty")}
//           </p>
//         ) : (
//           <AuditTable entries={entries} />
//         )}
//       </PanelBody>
//     </Panel>
//   )
// }
//
// function AuditHeader() {
//   const t = useTranslations("app")
//   return (
//     <TableHeader>
//       <TableRow className="hover:bg-transparent">
//         <TableHead className="w-[190px] px-3 panel-label">
//           {t("dashboard.table.time")}
//         </TableHead>
//         <TableHead className="px-3 panel-label">
//           {t("dashboard.table.actor")}
//         </TableHead>
//         <TableHead className="px-3 panel-label">
//           {t("dashboard.table.action")}
//         </TableHead>
//         <TableHead className="px-3 panel-label">
//           {t("dashboard.table.entity")}
//         </TableHead>
//       </TableRow>
//     </TableHeader>
//   )
// }
//
// /** Same loading shape as the example route's table. */
// function AuditLoading() {
//   const t = useTranslations("app")
//
//   return (
//     <>
//       <p role="status" className="sr-only">
//         {t("dashboard.audit.loading")}
//       </p>
//       <Table>
//         <AuditHeader />
//         <TableBody>
//           {Array.from({ length: 5 }).map((_, i) => (
//             // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows
//             <TableRow key={i}>
//               <TableCell className="px-3 py-4">
//                 <Skeleton className="h-4 w-2/3" />
//               </TableCell>
//               <TableCell className="px-3 py-4">
//                 <Skeleton className="h-4 w-1/2" />
//               </TableCell>
//               <TableCell className="px-3 py-4">
//                 <Skeleton className="h-4 w-3/4" />
//               </TableCell>
//               <TableCell className="px-3 py-4">
//                 <Skeleton className="h-4 w-2/3" />
//               </TableCell>
//             </TableRow>
//           ))}
//         </TableBody>
//       </Table>
//     </>
//   )
// }
//
// function AuditTable({ entries }: { entries: AuditEntry[] }) {
//   const t = useTranslations("app")
//   const format = useFormatter()
//
//   return (
//     <Table>
//       <AuditHeader />
//       <TableBody>
//         {entries.map((entry) => {
//           const hasPayload =
//             entry.prev !== null || entry.next !== null || entry.meta !== null
//
//           return (
//             <Fragment key={entry.id}>
//               <TableRow>
//                 <TableCell
//                   data-mono
//                   className="px-3 text-xs text-muted-foreground"
//                 >
//                   {format.dateTime(new Date(entry.created_at), {
//                     dateStyle: "short",
//                     timeStyle: "medium",
//                   })}
//                 </TableCell>
//                 <TableCell
//                   data-mono={entry.actor_id ? true : undefined}
//                   className="px-3 text-xs"
//                 >
//                   {entry.actor_id ?? (
//                     <span className="text-muted-foreground">
//                       {t("dashboard.audit.noActor")}
//                     </span>
//                   )}
//                 </TableCell>
//                 <TableCell className="px-3">{entry.action}</TableCell>
//                 <TableCell className="px-3">
//                   <span>{entry.entity}</span>
//                   <span className="ml-2 font-mono text-xs text-muted-foreground">
//                     {entry.entity_id}
//                   </span>
//                 </TableCell>
//               </TableRow>
//               {hasPayload && (
//                 <TableRow className="hover:bg-transparent">
//                   <TableCell colSpan={4} className="px-3 pb-3">
//                     <details className="group/payload">
//                       <summary className="panel-label inline-flex cursor-pointer rounded-sm outline-none select-none focus-visible:ring-2 focus-visible:ring-ring">
//                         {t("dashboard.audit.payload")}
//                       </summary>
//                       <div className="mt-2 grid gap-px overflow-hidden rounded-sm border border-border bg-border md:grid-cols-3">
//                         <PayloadBlock label="prev" value={entry.prev} />
//                         <PayloadBlock label="next" value={entry.next} />
//                         <PayloadBlock label="meta" value={entry.meta} />
//                       </div>
//                     </details>
//                   </TableCell>
//                 </TableRow>
//               )}
//             </Fragment>
//           )
//         })}
//       </TableBody>
//     </Table>
//   )
// }
//
// /** Raw JSON, as JSON: three seam-divided mono blocks. */
// function PayloadBlock({
//   label,
//   value,
// }: {
//   label: string
//   value: AuditEntry["prev"]
// }) {
//   return (
//     <div className="min-w-0 bg-card">
//       <p className="panel-label border-b border-border px-2 py-1">{label}</p>
//       {value === null ? (
//         <p className="px-2 py-1.5 font-mono text-xs text-muted-foreground">—</p>
//       ) : (
//         <pre className="max-h-56 overflow-auto px-2 py-1.5 font-mono text-xs leading-relaxed">
//           {JSON.stringify(value, null, 2)}
//         </pre>
//       )}
//     </div>
//   )
// }
