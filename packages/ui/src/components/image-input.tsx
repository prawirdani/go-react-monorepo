import { Input } from "@repo/ui/components/input"
import { Photo } from "@repo/ui/icons"
import { cn } from "@repo/ui/lib/utils"
import { useImperativeHandle, useRef, useState } from "react"

type PreviewVariants = "circular" | "square" | "rectangle" | "4/3"

export interface ImageInputRef {
  reset: () => void
}

interface ImageInputProps {
  className?: string
  onChange?: (blob?: File) => void
  errors?: string
  name?: React.ComponentProps<"input">["name"]
  variant?: PreviewVariants
  preview?: string
  ref?: React.Ref<ImageInputRef>
  disabled?: boolean
}

const PreviewClasses: Record<PreviewVariants, string> = {
  circular: "rounded-full aspect-square",
  rectangle: "rounded-md aspect-video",
  square: "rounded-md aspect-square",
  "4/3": "rounded-md aspect-[4/3]",
}

// TODO: Implement Editor Mode for image cropping and adjustment
export default function ImageInput({
  className,
  onChange,
  errors,
  name,
  variant = "rectangle",
  preview,
  ref,
  disabled,
}: ImageInputProps) {
  const [imagePreview, setImagePreview] = useState<string | undefined>(preview)

  const imageInputRef = useRef<HTMLInputElement>(null)

  // This hook for resetting the preview image from parent component
  useImperativeHandle(ref, () => ({
    reset: () => {
      setImagePreview(preview)
      if (imageInputRef.current) {
        imageInputRef.current.value = ""
      }
      onChange?.(undefined)
    },
  }))

  const handleImageClick = () => {
    imageInputRef.current?.click()
  }
  const imageOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files?.[0]) {
      const imageUrl = URL.createObjectURL(files[0])
      setImagePreview(imageUrl)
      onChange?.(files[0])
    }
  }
  const aspectClassname = PreviewClasses[variant]

  return (
    <div className={cn("h-full w-full mx-auto", aspectClassname, className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => handleImageClick()}
        className={cn(
          "group relative mx-auto flex h-full w-full transition-colors duration-200 border",
          // Base cursor
          disabled ? "cursor-not-allowed" : "cursor-pointer",
          // Hover effects only when enabled
          !disabled && "hover:bg-accent hover:border-primary",
          // Disabled styles
          disabled && "opacity-50 bg-gray-100",
          aspectClassname,
        )}
      >
        <Input
          id={name}
          accept="image/png, image/jpeg, image/jpg, image/webp"
          type="file"
          ref={imageInputRef}
          onChange={imageOnChange}
          hidden
        />
        {imagePreview ? (
          <>
            <img
              src={imagePreview}
              className={cn(
                "w-full outline h-full object-cover",
                aspectClassname,
              )}
              onError={(e) => {
                e.currentTarget.src =
                  "https://placehold.co/600x400?text=Image not loaded properly"
              }}
              alt="image-preview"
            />
            <div
              className={cn(
                "absolute inset-0 bg-black bg-opacity-20 transition-opacity duration-200",
                disabled ? "opacity-100" : "opacity-0 group-hover:opacity-100",
              )}
            />
          </>
        ) : (
          <div className="flex w-full flex-col justify-center">
            <Photo className="mx-auto group-hover:text-primary" size={42} />
            <span className="text-sm group-hover:text-primary">
              Choose Image
            </span>
            {errors && (
              <p className="text-sm text-destructive text-center">{errors}</p>
            )}
          </div>
        )}
      </button>
    </div>
  )
}
