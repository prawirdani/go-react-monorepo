import { Separator } from "@repo/ui/components/separator"
import { MoodPuzzled, ServerOff } from "@repo/ui/icons"
import { cn } from "@repo/ui/lib/utils"

export function NotFound({ fullPage = true }: { fullPage?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col place-items-center",
        fullPage ? "min-h-[100vh]" : "h-full",
      )}
    >
      <div className="m-auto space-y-2">
        <MoodPuzzled className="h-16 w-16 mx-auto" strokeWidth={1.5} />
        <div className="space-y-1 [&>*]:text-center">
          <h3 className="font-medium text-lg md:text-2xl font-mono">
            404 | Not Found
          </h3>
          <Separator />
          <h4 className="md:text-lg">Halaman tidak ditemukan</h4>
        </div>
      </div>
    </div>
  )
}

export function InternalServerError({ error: _ }: { error: unknown }) {
  return (
    <div className="flex flex-col min-h-[100vh] place-items-center">
      <div className="m-auto flex flex-col items-center gap-y-4">
        <ServerOff className="h-16 w-16" strokeWidth={1.5} />
        <div className="space-y-1 [&>*]:text-center">
          <h3 className="font-medium text-lg md:text-2xl font-mono">
            500 | Internal Server Error
          </h3>
          <Separator />
          <h4 className="md:text-lg">
            Terjadi kesalahan coba lagi beberapa saat.
          </h4>
        </div>
      </div>
    </div>
  )
}
