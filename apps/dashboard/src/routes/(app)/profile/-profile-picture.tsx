import { useTranslations } from "@repo/i18n"
import { profilePictureSchema, type User } from "@repo/schemas/user"
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
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/avatar"
import { Button } from "@repo/ui/components/button"
import {
  CreateDropdownHandler,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import toast from "@repo/ui/components/toast"
import { Edit, Loader, Trash, Upload } from "@repo/ui/icons"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { type ChangeEvent, type ComponentProps, useRef, useState } from "react"
import { useErrorHandler } from "@/hooks/use-error-handler"
import { imageUrl } from "@/lib/data-access/api"
import {
  changeProfilePicture,
  deleteProfilePicture,
} from "@/lib/data-access/mutations"
import { authActions } from "@/stores/auth-store"

const dialogHandler: ReturnType<typeof CreateDropdownHandler> =
  CreateDropdownHandler()

interface ProfilePictureProps extends ComponentProps<"div"> {
  user: User
}

export function ProfilePicture({ user, ...props }: ProfilePictureProps) {
  const handleError = useErrorHandler()
  const router = useRouter()
  const t = useTranslations("app")

  const imageInputRef = useRef<HTMLInputElement>(null)

  const { mutateAsync, isPending } = useMutation(changeProfilePicture)
  const imageOnChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const result = profilePictureSchema.safeParse(file)

    if (!result.success) {
      toast.error(t("profile.picture.invalid"), {
        description: result.error.issues[0].message,
      })
      e.target.value = ""
      return
    }
    await mutateAsync(result.data, {
      onSuccess: async () => {
        await authActions.invalidate()
        await router.invalidate()
      },
      onError: (e) => handleError(e),
      onSettled: () => {
        e.target.value = ""
      },
    })
  }

  return (
    <div {...props}>
      <DropdownMenuTrigger handle={dialogHandler}>
        <div
          className="group relative w-fit cursor-pointer"
          data-loading={isPending}
        >
          <input
            type="file"
            accept="image/*"
            hidden
            ref={imageInputRef}
            onChange={imageOnChange}
          />
          <Avatar
            className="size-28 md:size-44 transition-[width,height] duration-200 ease-linear"
            key={user.profile_picture || `empty-${Date.now()}`}
          >
            {user.profile_picture && (
              <AvatarImage
                src={imageUrl.profile(user?.profile_picture)}
                alt={t("shared.avatarAlt")}
                className="object-cover"
              />
            )}
            <AvatarFallback className="text-2xl">
              {user.name.charAt(0)}
            </AvatarFallback>
          </Avatar>

          {/* Loader overlay: visible when data-loading=true, OR always-mounted but opacity toggled */}
          <div
            className="absolute inset-0 flex items-center justify-center rounded-full bg-background/50 opacity-0 transition-opacity duration-200 ease-console
              group-data-[loading=true]:opacity-100"
          >
            <div className="flex items-center justify-center rounded-full bg-foreground p-3 text-background transition-transform duration-200 ease-console group-data-[loading=true]:scale-100 scale-90">
              <Loader className="animate-spin size-7" />
            </div>
          </div>

          {/* Edit overlay: only on hover, and only when NOT loading */}
          <div
            className="absolute inset-0 flex items-center justify-center rounded-full bg-background/50 opacity-0 transition-opacity duration-200 ease-console
              group-hover:opacity-100 group-data-[loading=true]:opacity-0 group-data-[loading=true]:pointer-events-none"
          >
            <div className="flex items-center justify-center rounded-full bg-foreground p-3 text-background transition-transform duration-200 ease-console group-hover:scale-100 scale-90">
              <Edit className="size-5" />
            </div>
          </div>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenu handle={dialogHandler}>
        <DropdownMenuContent
          className="flex flex-col gap-1.5 p-1.5 [&_button]:w-full w-28"
          align="center"
        >
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              imageInputRef.current?.click()
            }}
          >
            <Upload />
            {t("profile.picture.upload")}
          </Button>
          {/* Destructive action, kept apart from its neighbour by empty space. */}
          <div className="mt-2 border-t border-border pt-2">
            <DeleteDialog disabled={!user.profile_picture} />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

interface DeleteDialogProps {
  disabled: boolean
}

function DeleteDialog({ disabled }: DeleteDialogProps) {
  const [loading, setLoading] = useState(false)
  const handleError = useErrorHandler()
  const router = useRouter()
  const t = useTranslations("app")
  const tc = useTranslations("common")

  const { mutateAsync } = useMutation(deleteProfilePicture)
  const handleDeletePicture = async () => {
    setLoading(true)
    try {
      await mutateAsync()
      await authActions.invalidate()
      await router.invalidate()
    } catch (error) {
      handleError(error)
    } finally {
      setLoading(false)
      dialogHandler.close()
    }
  }
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="destructive" size="sm" disabled={disabled}>
            <Trash />
            {t("profile.picture.delete")}
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("profile.picture.deleteTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("profile.picture.deleteDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            disabled={loading}
            loading={loading}
            variant="destructive"
            onClick={handleDeletePicture}
          >
            {t("shared.yes")}
          </AlertDialogAction>
          <AlertDialogCancel disabled={loading} variant="outline">
            {tc("actions.cancel")}
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
