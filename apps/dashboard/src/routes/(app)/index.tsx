import { Button } from "@repo/ui/components/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table"
import { createFileRoute, Link } from "@tanstack/react-router"
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

const summary: { label: string; value: string; tone?: Tone }[] = [
  { label: "Entri hari ini", value: "128" },
  { label: "Menunggu tinjauan", value: "12", tone: "warning" },
  { label: "Gagal diproses", value: "3", tone: "destructive" },
  { label: "Sinkron terakhir", value: "09:41 WIB" },
]

const services: { name: string; state: string; tone: Tone }[] = [
  { name: "API", state: "Normal", tone: "success" },
  { name: "Autentikasi", state: "Normal", tone: "success" },
  { name: "Penyimpanan", state: "Lambat", tone: "warning" },
  { name: "Antrean tugas", state: "Terganggu", tone: "destructive" },
  { name: "Pencadangan", state: "Terjadwal", tone: "info" },
]

const activity: {
  time: string
  actor: string
  action: string
  state: string
  tone: Tone
}[] = [
  {
    time: "09:41",
    actor: "Operator",
    action: "Memperbarui profil",
    state: "Selesai",
    tone: "success",
  },
  {
    time: "09:32",
    actor: "Sistem",
    action: "Sinkronisasi katalog",
    state: "Berjalan",
    tone: "info",
  },
  {
    time: "09:20",
    actor: "Admin",
    action: "Mengarsipkan entri",
    state: "Ditinjau",
    tone: "warning",
  },
  {
    time: "09:04",
    actor: "Sistem",
    action: "Kirim email pemulihan",
    state: "Gagal",
    tone: "destructive",
  },
]

function SampleTag() {
  return <StateBadge tone="warning">Contoh</StateBadge>
}

function Component() {
  return (
    <Page
      title="Konsol"
      description="Struktur operasional yang bisa Anda ganti dengan data nyata. Setiap angka dan baris di bawah adalah contoh."
    >
      <PanelGrid className="lg:grid-cols-12">
        <Panel className="animate-panel-in lg:col-span-7">
          <PanelHeader title="Ringkasan" aside={<SampleTag />} />
          <PanelBody className="flex-1">
            <PanelRows>
              {summary.map((row) => (
                <PanelRow
                  key={row.label}
                  label={row.label}
                  value={row.value}
                  tone={row.tone}
                />
              ))}
            </PanelRows>
          </PanelBody>
          <PanelNote className="border-t border-border">
            Contoh data — hubungkan ke sumber data Anda.
          </PanelNote>
        </Panel>

        <Panel className="lg:col-span-5">
          <PanelHeader title="Status Layanan" aside={<SampleTag />} />
          <PanelBody className="flex-1">
            <ul className="divide-y divide-border">
              {services.map((service) => (
                <li
                  key={service.name}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <span className="min-w-0 truncate text-sm">
                    {service.name}
                  </span>
                  <StateBadge tone={service.tone}>{service.state}</StateBadge>
                </li>
              ))}
            </ul>
          </PanelBody>
        </Panel>

        <Panel className="lg:col-span-5">
          <PanelHeader title="Tindakan" />
          <PanelBody className="flex-1 justify-between gap-5 p-3">
            <p className="max-w-[46ch] text-sm text-muted-foreground">
              Halaman contoh berisi tabel dengan status pemuatan. Pakai sebagai
              titik awal untuk daftar dan filter yang Anda butuhkan.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button nativeButton={false} render={<Link to="/example" />}>
                Buka contoh data
              </Button>
              <Button
                variant="ghost"
                nativeButton={false}
                render={<Link to="/settings" />}
              >
                Pengaturan
              </Button>
            </div>
          </PanelBody>
        </Panel>

        <Panel className="lg:col-span-7">
          <PanelHeader title="Aktivitas Terbaru" aside={<SampleTag />} />
          <PanelBody className="flex-1">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[92px] px-3 panel-label">
                    Waktu
                  </TableHead>
                  <TableHead className="px-3 panel-label">Pelaku</TableHead>
                  <TableHead className="px-3 panel-label">Aksi</TableHead>
                  <TableHead className="px-3 text-right panel-label">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activity.map((entry) => (
                  <TableRow key={entry.time}>
                    <TableCell
                      data-mono
                      className="px-3 text-xs text-muted-foreground"
                    >
                      {entry.time}
                    </TableCell>
                    <TableCell className="px-3">{entry.actor}</TableCell>
                    <TableCell className="px-3 text-muted-foreground">
                      {entry.action}
                    </TableCell>
                    <TableCell className="px-3 text-right">
                      <StateBadge tone={entry.tone}>{entry.state}</StateBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </PanelBody>
        </Panel>
      </PanelGrid>
    </Page>
  )
}
