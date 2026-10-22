import { useTranslations } from "@repo/i18n"
import { Button } from "@repo/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { Label } from "@repo/ui/components/label"
import toast from "@repo/ui/components/toast"
import { Restore } from "@repo/ui/icons"
import { useState } from "react"
import Cropper, { type Area } from "react-easy-crop"
import { getCroppedImage } from "./-crop-image"

const MAX_ZOOM = 3

interface ImageCropperDialogProps {
  /** Object URL of the picked image. A non-null value opens the dialog. */
  src: string | null
  onCancel: () => void
  onCropped: (file: File) => void | Promise<void>
}

export function ImageCropperDialog({
  src,
  onCancel,
  onCropped,
}: ImageCropperDialogProps) {
  return (
    <Dialog
      open={src !== null}
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      {src && (
        <DialogContent className="gap-5">
          <CropperForm
            key={src}
            src={src}
            onCancel={onCancel}
            onCropped={onCropped}
          />
        </DialogContent>
      )}
    </Dialog>
  )
}

interface CropperFormProps {
  src: string
  onCancel: () => void
  onCropped: (file: File) => void | Promise<void>
}

function CropperForm({ src, onCancel, onCropped }: CropperFormProps) {
  const t = useTranslations("app")
  const tc = useTranslations("common")

  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!croppedArea) return
    setSaving(true)
    try {
      const file = await getCroppedImage(src, croppedArea, rotation)
      await onCropped(file)
    } catch {
      toast.error(t("profile.picture.editor.failed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("profile.picture.editor.title")}</DialogTitle>
        <DialogDescription>
          {t("profile.picture.editor.description")}
        </DialogDescription>
      </DialogHeader>

      <div className="relative h-72 w-full overflow-hidden rounded-md border border-border bg-muted">
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={1}
          cropShape="round"
          showGrid={false}
          minZoom={1}
          maxZoom={MAX_ZOOM}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
          onCropComplete={(_area, areaPixels) => setCroppedArea(areaPixels)}
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Label
            htmlFor="avatar-zoom"
            className="w-14 shrink-0 text-muted-foreground"
          >
            {t("profile.picture.editor.zoom")}
          </Label>
          <input
            id="avatar-zoom"
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full cursor-pointer accent-primary"
          />
          <span className="w-12 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          {/* Keeps the readouts of both sliders in one column. */}
          <span className="size-6 shrink-0" aria-hidden="true" />
        </div>

        <div className="flex items-center gap-3">
          <Label
            htmlFor="avatar-rotation"
            className="w-14 shrink-0 text-muted-foreground"
          >
            {t("profile.picture.editor.rotate")}
          </Label>
          <input
            id="avatar-rotation"
            type="range"
            min={-180}
            max={180}
            step={1}
            value={rotation}
            onChange={(e) => setRotation(Number(e.target.value))}
            className="w-full cursor-pointer accent-primary"
          />
          <span className="w-12 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">
            {rotation}°
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={rotation === 0}
            title={t("profile.picture.editor.reset")}
            aria-label={t("profile.picture.editor.reset")}
            onClick={() => setRotation(0)}
          >
            <Restore />
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("profile.picture.editor.hint")}
      </p>

      <DialogFooter>
        <Button variant="outline" disabled={saving} onClick={onCancel}>
          {tc("actions.cancel")}
        </Button>
        <Button loading={saving} disabled={!croppedArea} onClick={handleSave}>
          {tc("actions.save")}
        </Button>
      </DialogFooter>
    </>
  )
}
