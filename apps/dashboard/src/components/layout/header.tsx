import { useTranslations } from "@repo/i18n"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPrimitive,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/ui/components/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/avatar"
import { Button } from "@repo/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import { useSidebar } from "@repo/ui/components/sidebar"
import { ThemeModeToggle } from "@repo/ui/components/theme-picker"
import { Burger, Logout, User } from "@repo/ui/icons"
import { useQuery } from "@tanstack/react-query"
import { Link, useRouterState } from "@tanstack/react-router"
import { useState } from "react"
import { RoleBadge } from "@/components/layout/role-badge"
import { useErrorHandler } from "@/hooks/use-error-handler"
import { authActions } from "@/lib/auth/session"
import { imageUrl } from "@/lib/data-access/api"
import { getSession } from "@/lib/data-access/queries"

const dialogHandler = AlertDialogPrimitive.createHandle()

export function AppHeader() {
  const { toggleSidebar } = useSidebar()
  const t = useTranslations("app")

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-3">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        aria-label={t("header.toggleNav")}
      >
        <Burger className="size-5!" />
      </Button>
      <span aria-hidden="true" className="h-5 w-px bg-border" />
      <MonoPath />
      <div className="ml-auto flex items-center gap-2">
        <AvatarSection />
      </div>
    </header>
  )
}

/** The current location, written the way a machine reports it. */
function MonoPath() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <p className="min-w-0 truncate font-mono text-xs text-muted-foreground">
      <span aria-hidden="true" className="text-muted-foreground/60">
        ~
      </span>
      {pathname}
    </p>
  )
}

function AvatarSection() {
  const user = useQuery(getSession).data?.user
  const t = useTranslations("app")

  if (!user) return null

  return (
    <AlertDialog handle={dialogHandler}>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`${t("header.accountMenu")} ${user.name}`}
        >
          <Avatar className="size-8" key={user.profile_picture || "fallback"}>
            {user.profile_picture && (
              <AvatarImage
                src={imageUrl.profile(user.profile_picture)}
                alt={t("shared.avatarAlt")}
              />
            )}
            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-60">
          <div className="flex items-center gap-2 p-1.5">
            <Avatar size="lg" key={user.profile_picture || "fallback"}>
              {user.profile_picture && (
                <AvatarImage
                  src={imageUrl.profile(user.profile_picture)}
                  alt={t("shared.avatarAlt")}
                />
              )}
              <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 leading-4">
              <div className="flex min-w-0 items-center gap-2">
                <p className="min-w-0 truncate text-sm font-medium">
                  {user.name}
                </p>
                <RoleBadge role={user.role} />
              </div>
              <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                {user.email}
              </p>
            </div>
          </div>
          <DropdownMenuSeparator />

          <ThemeModeToggle className="w-full" containMenuEvents />

          <DropdownMenuSeparator />
          <div className="[&_[data-slot=dropdown-menu-item]]:py-2 [&_[data-slot=dropdown-menu-item]]:cursor-pointer">
            <Link to="/profile">
              <DropdownMenuItem>
                <User />
                {t("header.profile")}
              </DropdownMenuItem>
            </Link>

            <AlertDialogTrigger className="w-full">
              <DropdownMenuItem>
                <Logout />
                {t("header.logout")}
              </DropdownMenuItem>
            </AlertDialogTrigger>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      <LogoutConfirmationDialog />
    </AlertDialog>
  )
}

function LogoutConfirmationDialog() {
  const [loading, setLoading] = useState(false)
  const t = useTranslations("app")
  const tc = useTranslations("common")

  const handleError = useErrorHandler()

  const handleLogout = async () => {
    setLoading(true)
    try {
      await authActions.logout()
    } catch (e) {
      handleError(e)
    }
    setLoading(false)
    dialogHandler.close()
  }

  return (
    <AlertDialogContent className="max-sm:min-w-[90%] sm:w-fit">
      <AlertDialogHeader>
        <AlertDialogTitle>{t("header.logout")}</AlertDialogTitle>
        <AlertDialogDescription>
          {t("header.logoutDescription")}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{tc("actions.cancel")}</AlertDialogCancel>
        <AlertDialogAction onClick={handleLogout} loading={loading}>
          {t("shared.yes")}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  )
}
