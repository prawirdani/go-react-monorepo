import { GenderLabels } from "@repo/schemas/user"
import { Button } from "@repo/ui/components/button"
import { Edit, Email, Password } from "@repo/ui/icons"
import { cn } from "@repo/ui/lib/utils"
import { createFileRoute, redirect } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { useState } from "react"
import { Page } from "@/components/layout/page"
import {
  Panel,
  PanelBody,
  PanelGrid,
  PanelHeader,
  PanelRow,
  PanelRows,
  StateBadge,
} from "@/components/layout/panel"
import { useAuthStore } from "@/stores/auth-store"
import { ChangePasswordForm } from "./-change-password-form"
import { ProfilePicture } from "./-profile-picture"
import { UpdateUserForm } from "./-update-user-form"

export const Route = createFileRoute("/(app)/profile/")({
  loader: () => {
    const user = useAuthStore.getState().user
    if (!user) {
      throw redirect({
        to: "/login",
      })
    }
    return user
  },
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <Page
      title="Profil"
      description="Identitas akun dan pengaturan keamanannya."
    >
      <PanelGrid className="lg:grid-cols-12">
        <IdentityPanel className="animate-panel-in lg:col-span-5" />
        <SecurityPanel className="lg:col-span-7" />
      </PanelGrid>
    </Page>
  )
}

function IdentityPanel({ className }: { className?: string }) {
  const user = Route.useLoaderData()
  const [showForm, setShowForm] = useState(false)

  return (
    <Panel className={className}>
      <PanelHeader
        title="Identitas"
        aside={
          <Button
            variant="outline"
            size="icon-sm"
            hidden={showForm}
            onClick={() => setShowForm(true)}
            aria-label="Ubah identitas"
          >
            <Edit />
          </Button>
        }
      />
      <PanelBody className="flex-1">
        {showForm ? (
          <div className="p-3">
            <UpdateUserForm user={user} onClose={() => setShowForm(false)} />
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-4 px-3 py-6">
              <ProfilePicture user={user} />
              <div className="max-w-full text-center">
                <p className="truncate text-base font-medium text-foreground">
                  {user.name}
                </p>
                <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                  {user.id}
                </p>
              </div>
            </div>
            <PanelRows className="border-t border-border">
              <PanelRow label="Nama" value={user.name} mono={false} />
              <PanelRow label="No Handphone" value={user.phone ?? "-"} />
              <PanelRow
                label="Jenis Kelamin"
                value={
                  user.gender
                    ? (GenderLabels[user.gender] ?? GenderLabels.O)
                    : "-"
                }
                mono={false}
              />
            </PanelRows>
          </>
        )}
      </PanelBody>
    </Panel>
  )
}

function SecurityPanel({ className }: { className?: string }) {
  const user = Route.useLoaderData()
  const [showPasswordForm, setShowPasswordForm] = useState(false)

  return (
    <Panel className={className}>
      <PanelHeader title="Keamanan Akun" />
      <PanelBody className="flex-1">
        <p className="px-3 pt-3 pb-3 text-sm text-muted-foreground">
          Kelola kata sandi dan alamat email untuk menjaga keamanan akun Anda.
        </p>

        <div className="divide-y divide-border border-t border-border">
          <SecurityRow
            icon={<Email className="size-4" />}
            action={
              <Button variant="outline" size="sm" disabled={showPasswordForm}>
                {user.email_verified_at ? "Ubah email" : "Verifikasi"}
              </Button>
            }
          >
            <span className="min-w-0 truncate font-mono text-sm">
              {user.email}
            </span>
            {user.email_verified_at ? (
              <StateBadge tone="success">Terverifikasi</StateBadge>
            ) : (
              <StateBadge tone="destructive">Belum Terverifikasi</StateBadge>
            )}
          </SecurityRow>

          <SecurityRow
            icon={<Password className="size-4" />}
            action={
              <Button
                variant="outline"
                size="sm"
                hidden={showPasswordForm}
                onClick={() => setShowPasswordForm(true)}
              >
                Ubah kata sandi
              </Button>
            }
          >
            <span className="text-sm text-foreground">Kata Sandi</span>
          </SecurityRow>
        </div>

        {showPasswordForm && (
          <div className="border-t border-border p-3">
            <ChangePasswordForm onClose={() => setShowPasswordForm(false)} />
          </div>
        )}
      </PanelBody>
    </Panel>
  )
}

function SecurityRow({
  icon,
  action,
  children,
  className,
}: {
  icon: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-3 px-3 py-3", className)}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-sm text-muted-foreground">
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {children}
      </div>
      {action}
    </div>
  )
}
