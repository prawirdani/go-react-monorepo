/**
 * Turns the cropper's selection into a standardized square avatar.
 *
 * `react-easy-crop` reports `croppedAreaPixels` in the coordinate space of the
 * *rotated* image's axis-aligned bounding box, in natural pixels. The transform
 * below maps that box onto a 512x512 canvas, so the export is always square and
 * always the same size no matter how the picture was framed.
 */

export const AVATAR_SIZE = 512

export interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

/** Size of the axis-aligned box that contains the image after rotation. */
export function rotatedBounds(
  width: number,
  height: number,
  rotation: number,
): { width: number; height: number } {
  const rad = (rotation * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  return {
    width: cos * width + sin * height,
    height: sin * width + cos * height,
  }
}

export interface CropTransform {
  scaleX: number
  scaleY: number
  /** Output-canvas position of the image centre. */
  centerX: number
  centerY: number
}

export function cropTransform(
  imageWidth: number,
  imageHeight: number,
  crop: CropArea,
  rotation: number,
  size: number = AVATAR_SIZE,
): CropTransform {
  const bounds = rotatedBounds(imageWidth, imageHeight, rotation)
  // Separate axes keep the output exactly square even if the reported crop is
  // a pixel off square from rounding.
  const scaleX = size / crop.width
  const scaleY = size / crop.height
  return {
    scaleX,
    scaleY,
    centerX: (bounds.width / 2 - crop.x) * scaleX,
    centerY: (bounds.height / 2 - crop.y) * scaleY,
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Could not load the image"))
    image.src = src
  })
}

/** Draws the rotated crop onto a 512x512 canvas and returns it as a JPEG file. */
export async function getCroppedImage(
  src: string,
  crop: CropArea,
  rotation: number,
): Promise<File> {
  if (crop.width <= 0 || crop.height <= 0) {
    throw new Error("Crop area is empty")
  }

  const image = await loadImage(src)
  const width = image.naturalWidth
  const height = image.naturalHeight

  const canvas = document.createElement("canvas")
  canvas.width = AVATAR_SIZE
  canvas.height = AVATAR_SIZE

  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas is not supported")

  // JPEG has no alpha channel, so transparent PNGs get a white matte instead
  // of black.
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE)

  const { scaleX, scaleY, centerX, centerY } = cropTransform(
    width,
    height,
    crop,
    rotation,
  )
  ctx.setTransform(scaleX, 0, 0, scaleY, centerX, centerY)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(image, -width / 2, -height / 2, width, height)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.85)
  })
  if (!blob) throw new Error("Could not export the image")

  return new File([blob], "avatar.jpg", { type: "image/jpeg" })
}
