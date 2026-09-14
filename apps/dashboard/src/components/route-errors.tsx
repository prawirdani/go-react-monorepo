import { Button } from "@repo/ui/components/button"
import { MoodPuzzled, ServerOff } from "@repo/ui/icons"
import { cn } from "@repo/ui/lib/utils"
import { Link } from "@tanstack/react-router"

export function NotFound({ fullPage = true }: { fullPage?: boolean }) {
  return (
    <div
      className={cn(
        "grid place-items-center bg-background p-6",
        fullPage ? "min-h-svh" : "h-full",
      )}
    >
      <div
        role="alert"
        className="flex w-full max-w-xs flex-col items-center gap-4 text-center"
      >
        <MoodPuzzled
          className="size-9 text-muted-foreground"
          strokeWidth={1.5}
        />
        <h1 className="panel-label">404 / Tidak ditemukan</h1>
        <p className="text-sm text-muted-foreground">
          Halaman yang Anda cari tidak ada atau sudah dipindahkan.
        </p>
        <Button variant="outline" nativeButton={false} render={<Link to="/" />}>
          Kembali ke konsol
        </Button>
      </div>
    </div>
  )
}

export function InternalServerError({ error: _ }: { error: unknown }) {
  return (
    <div className="grid min-h-svh place-items-center bg-background p-6">
      <div
        role="alert"
        className="flex w-full max-w-xs flex-col items-center gap-4 text-center"
      >
        <ServerOff className="size-9 text-muted-foreground" strokeWidth={1.5} />
        <h1 className="panel-label">500 / Kesalahan server</h1>
        <p className="text-sm text-muted-foreground">
          Terjadi kesalahan saat memuat halaman. Coba lagi beberapa saat.
        </p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Muat ulang
        </Button>
      </div>
    </div>
  )
}
