import { useTranslations } from "@repo/i18n"
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
import { RoleBadge } from "@/components/layout/role-badge"
import { GENDER_LABEL_KEYS } from "@/lib/i18n"
import { useAuthStore } from "@/stores/auth-store"
import { ChangePasswordForm } from "./-change-password-form"
import { ProfilePicture } from "./-profile-picture"
import { UpdateUserForm } from "./-update-user-form"

export const Route = createFileRoute("/(app)/profile/")({
  loader: () => {
    const user = useAuthStore.getState().user
    if (!user) {
      throw redirect({
        to: "/auth/login",
      })
    }
    return user
  },
  component: RouteComponent,
})

function RouteComponent() {
  const t = useTranslations("app")

  return (
    <Page title={t("profile.title")} description={t("profile.description")}>
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
  const t = useTranslations("app")
  const tc = useTranslations("common")

  return (
    <Panel className={className}>
      <PanelHeader
        title={t("profile.identity.panel")}
        aside={
          <Button
            variant="ghost"
            size="icon-sm"
            hidden={showForm}
            onClick={() => setShowForm(true)}
            aria-label={t("profile.identity.editLabel")}
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
              <PanelRow
                label={t("profile.identity.name")}
                value={user.name}
                mono={false}
              />
              <PanelRow
                label={t("profile.identity.role")}
                value={<RoleBadge role={user.role} variant="value" />}
                mono={false}
              />
              <PanelRow
                label={t("profile.identity.phone")}
                value={user.phone ?? "-"}
              />
              <PanelRow
                label={t("profile.identity.gender")}
                value={user.gender ? tc(GENDER_LABEL_KEYS[user.gender]) : "-"}
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
  const t = useTranslations("app")

  return (
    <Panel className={className}>
      <PanelHeader title={t("profile.security.panel")} />
      <PanelBody className="flex-1">
        <p className="px-3 pt-3 pb-3 text-sm text-muted-foreground">
          {t("profile.security.description")}
        </p>

        <div className="divide-y divide-border border-t border-border">
          <SecurityRow
            icon={<Email className="size-4" />}
            action={
              <Button variant="outline" size="sm" disabled={showPasswordForm}>
                {user.email_verified_at
                  ? t("profile.security.changeEmail")
                  : t("profile.security.verifyEmail")}
              </Button>
            }
          >
            <span className="min-w-0 truncate font-mono text-sm">
              {user.email}
            </span>
            {user.email_verified_at ? (
              <StateBadge tone="success">
                {t("profile.security.verified")}
              </StateBadge>
            ) : (
              <StateBadge tone="destructive">
                {t("profile.security.unverified")}
              </StateBadge>
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
                {t("profile.security.changePassword")}
              </Button>
            }
          >
            <span className="text-sm text-foreground">
              {t("profile.security.password")}
            </span>
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
