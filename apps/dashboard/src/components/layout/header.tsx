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
import { ThemeToggler } from "@repo/ui/components/theme-toggler"
import { Burger, Logout, User } from "@repo/ui/icons"
import { Link, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { useErrorHandler } from "@/hooks/use-error-handler"
import { imageUrl } from "@/lib/api"
import { authActions, useAuthStore } from "@/stores/auth-store"

const dialogHandler = AlertDialogPrimitive.createHandle()

export function AppHeader() {
  const { toggleSidebar } = useSidebar()

  return (
    <header className="sticky top-0 z-10 bg-background flex shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 border-b max-md:h-12 h-16">
      <div className="flex items-center gap-2 px-2.5 justify-between flex-1">
        <Button variant="ghost" size="icon" onClick={toggleSidebar}>
          <Burger className="!size-5" />
        </Button>
        <div className="flex gap-2 items-center">
          <AvatarSection />
        </div>
      </div>
    </header>
  )
}

function AvatarSection() {
  const user = useAuthStore((s) => s.user)

  const navigate = useNavigate()

  useEffect(() => {
    if (!user) {
      navigate({
        to: "/login",
        replace: true,
      })
    }
  }, [user, navigate])

  if (!user) return null

  return (
    <AlertDialog handle={dialogHandler}>
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Avatar className="size-9" key={user.profile_picture || "fallback"}>
            {user.profile_picture && (
              <AvatarImage
                src={imageUrl.profile(user.profile_picture)}
                alt="profile picture"
              />
            )}
            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-56">
          <div className="flex items-center gap-2 p-1.5">
            <Avatar size="lg" key={user.profile_picture || "fallback"}>
              {user.profile_picture && (
                <AvatarImage
                  src={imageUrl.profile(user.profile_picture)}
                  alt="profile picture"
                />
              )}
              <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="text-sm leading-4">
              <p className="font-medium">{user.name}</p>
            </div>
          </div>
          <DropdownMenuSeparator />
          <ThemeToggler className="w-full justify-between font-normal h-10" />
          <DropdownMenuSeparator />
          <div className="[&_[data-slot=dropdown-menu-item]]:py-2 [&_[data-slot=dropdown-menu-item]]:cursor-pointer">
            <Link to="/profile">
              <DropdownMenuItem>
                <User />
                Profil
              </DropdownMenuItem>
            </Link>

            <AlertDialogTrigger className="w-full">
              <DropdownMenuItem>
                <Logout />
                Keluar
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
        <AlertDialogTitle>Keluar</AlertDialogTitle>
        <AlertDialogDescription>
          Anda akan keluar dari akun ini. Anda perlu masuk kembali untuk
          mengakses aplikasi.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Batal</AlertDialogCancel>
        <AlertDialogAction onClick={handleLogout} loading={loading}>
          Ya
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  )
}
