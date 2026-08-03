import { GenderLabels } from "@repo/schemas/user"
import { Badge } from "@repo/ui/components/badge"
import { Button } from "@repo/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card"
import { Separator } from "@repo/ui/components/separator"
import { Check, Edit, Email, Password, X } from "@repo/ui/icons"
import { cn } from "@repo/ui/lib/utils"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { useState } from "react"
import { Page } from "@/components/layout/page"
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
      title="Profile"
      className="mx-auto w-full md:w-[80%] lg:w-[60%] xl:w-1/2 transition-[width,height] duration-200 ease-linear !space-y-2"
    >
      <ProfileSection />
      <SecuritySection />
    </Page>
  )
}

function ProfileSection() {
  const user = Route.useLoaderData()

  const [showForm, setShowForm] = useState(false)

  return (
    <Card className="relative">
      <CardContent>
        <div className="flex flex-col items-center justify-center gap-6 mx-auto">
          <div>
            <ProfilePicture user={user} className="w-fit mx-auto" />
            <p className="text-center text-lg font-medium leading-6 mt-3">
              {user.name}
            </p>
            <p className="text-center text-xs font-medium text-muted-foreground/40">
              {user.id}
            </p>
          </div>
          {showForm ? (
            <UpdateUserForm user={user} onClose={() => setShowForm(false)} />
          ) : (
            <div className="grid grid-cols-2 w-full gap-4 [&_[data-slot=value]]:justify-self-end [&_[data-slot=key]]:text-muted-foreground">
              <Separator className="col-span-2" />
              <p data-slot="key">Nama</p>
              <p data-slot="value">{user.name}</p>
              <Separator className="col-span-2" />
              <p data-slot="key">No Handphone</p>
              <p data-slot="value">{user.phone ?? "-"}</p>
              <Separator className="col-span-2" />
              <p data-slot="key">Jenis Kelamin</p>
              <p data-slot="value">
                {user.gender
                  ? (GenderLabels[user.gender] ?? GenderLabels.O)
                  : "-"}
              </p>
            </div>
          )}
        </div>
      </CardContent>
      <Button
        className="absolute top-(--card-spacing) right-(--card-spacing)"
        variant="outline"
        size="icon"
        hidden={showForm}
        onClick={() => setShowForm((prev) => !prev)}
      >
        <Edit />
      </Button>
    </Card>
  )
}

function SecuritySection() {
  const user = Route.useLoaderData()
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Keamanan Akun</CardTitle>
        <CardDescription>
          Kelola kata sandi dan alamat email untuk menjaga keamanan akun Anda.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <SecuritySectionRowContainer>
          <Email />

          <div className="flex flex-col sm:flex-row gap-1.5 items-start sm:items-center">
            <p className="font-medium">{user.email}</p>
            {user.email_verified_at ? (
              <Badge
                variant="outline"
                className="h-6 [&>svg]:size-4! rounded-sm"
              >
                <Check className="text-green-500" data-icon="inline-start" />
                Terverifikasi
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="h-6 [&>svg]:size-4! rounded-sm"
              >
                <X className="text-destructive" data-icon="inline-start" />
                Belum Terverifikasi
              </Badge>
            )}
          </div>

          {user.email_verified_at ? (
            <Button variant="outline" size="sm" disabled={showPasswordForm}>
              Ubah email
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled={showPasswordForm}>
              Verifikasi
            </Button>
          )}
        </SecuritySectionRowContainer>

        <Separator />

        {/* Password */}
        <SecuritySectionRowContainer>
          <Password />
          <p className="font-medium">Kata Sandi</p>
          <Button
            variant="outline"
            size="sm"
            hidden={showPasswordForm}
            onClick={() => setShowPasswordForm(true)}
          >
            Ubah kata sandi
          </Button>
          {showPasswordForm && (
            <div className="col-span-3">
              <ChangePasswordForm onClose={() => setShowPasswordForm(false)} />
            </div>
          )}
        </SecuritySectionRowContainer>
      </CardContent>
    </Card>
  )
}

function SecuritySectionRowContainer({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "grid grid-cols-[auto_1fr_auto] items-center gap-4 overflow-auto",
        className,
      )}
      {...props}
    />
  )
}
