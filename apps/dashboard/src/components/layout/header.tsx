import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/ui/components/alert-dialog"
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar"
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
import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useErrorHandler } from "@/hooks/use-error-handler"
import { authActions } from "@/lib/auth"
import { useAuthStore } from "@/stores/auth-store"

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

  // HACK: null guard and logout race condition temp fix
  const displayUser = user ?? { name: "…", role: "…" }

  return (
    <AlertDialog>
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Avatar className="size-9">
            <AvatarFallback>{displayUser.name.charAt(0)}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-56">
          <div className="flex items-center gap-2 p-1.5">
            <Avatar size="lg">
              <AvatarFallback>{displayUser.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="text-sm leading-4">
              <p className="font-medium">{displayUser.name}</p>
              {/* <p className="text-muted-foreground">{displayUser.role}</p> */}
            </div>
          </div>
          <DropdownMenuSeparator />
          <ThemeToggler className="w-full justify-between font-normal h-10" />
          <DropdownMenuSeparator />
          <div className="[&_[data-slot=dropdown-menu-item]]:py-2 [&_[data-slot=dropdown-menu-item]]:cursor-pointer">
            <DropdownMenuItem>
              <User />
              Profil
            </DropdownMenuItem>

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

  const navigate = useNavigate()
  const handleError = useErrorHandler()

  const handleLogout = async () => {
    setLoading(true)
    try {
      await authActions.logout()
      navigate({ to: "/login" })
    } catch (e) {
      handleError(e)
    }
    setLoading(false)
  }

  return (
    <AlertDialogContent className="max-sm:min-w-[90%] sm:w-fit">
      <AlertDialogHeader>
        <AlertDialogTitle>Konfirmasi Keluar</AlertDialogTitle>
        <AlertDialogDescription className="">
          Anda akan keluar dari akun ini. Anda perlu masuk kembali untuk
          mengakses aplikasi.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="max-sm:[&_button]:flex-1 [&_button]:min-w-24">
        <AlertDialogCancel>Batal</AlertDialogCancel>
        <AlertDialogAction
          render={() => (
            <Button onClick={handleLogout} loading={loading}>
              Ya
            </Button>
          )}
        />
      </AlertDialogFooter>
    </AlertDialogContent>
  )
}
