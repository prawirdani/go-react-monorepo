import { Button } from "@repo/ui/components/button"
import { ThemePicker } from "@repo/ui/components/theme-picker"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Page } from "@/components/layout/page"
import {
  Panel,
  PanelBody,
  PanelGrid,
  PanelHeader,
  PanelRow,
  PanelRows,
} from "@/components/layout/panel"
import { useAuthStore } from "@/stores/auth-store"

export const Route = createFileRoute("/(app)/settings/")({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <Page
      title="Pengaturan"
      description="Preferensi tampilan dan informasi dasar aplikasi."
    >
      <PanelGrid className="lg:grid-cols-12">
        <Panel className="animate-panel-in lg:col-span-7">
          <PanelHeader title="Tampilan" />
          <PanelBody className="flex-1">
            <div className="flex flex-col gap-4 px-3 py-3">
              <div className="min-w-0">
                <p className="text-sm text-foreground">Tema dan mode</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Preferensi disimpan di peramban ini dan mengikuti sistem bila
                  belum dipilih.
                </p>
              </div>
              <ThemePicker className="w-full" />
            </div>
          </PanelBody>
        </Panel>

        <AkunPanel className="lg:col-span-5" />

        <Panel className="lg:col-span-12">
          <PanelHeader title="Tentang" />
          <PanelBody className="flex-1">
            <PanelRows>
              <PanelRow
                label="Bahasa antarmuka"
                value="Indonesia"
                mono={false}
              />
              <PanelRow label="Autentikasi" value="cookie · httpOnly" />
              <PanelRow label="Basis API" value="/api" />
              <PanelRow label="Mode default" value="Gelap" mono={false} />
            </PanelRows>
          </PanelBody>
        </Panel>
      </PanelGrid>
    </Page>
  )
}

function AkunPanel({ className }: { className?: string }) {
  const user = useAuthStore((s) => s.user)

  return (
    <Panel className={className}>
      <PanelHeader title="Akun" />
      <PanelBody className="flex flex-1 flex-col justify-between gap-4 p-3">
        <div className="min-w-0">
          <p className="text-sm text-foreground">Sesi saat ini</p>
          <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
            {user?.email ?? "—"}
          </p>
        </div>
        <Button
          variant="outline"
          className="self-start"
          nativeButton={false}
          render={<Link to="/profile" />}
        >
          Buka profil
        </Button>
      </PanelBody>
    </Panel>
  )
}
