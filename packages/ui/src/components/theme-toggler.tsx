import { cn } from "@repo/ui/lib/utils"
import { useTheme } from "@repo/ui/providers/theme-provider"
import { IconMoon, IconSun } from "@tabler/icons-react"
import { Button } from "./button"

export function ThemeToggler({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className={cn("flex items-center", className)}
    >
      <span className="leading-none">
        Mode {theme === "dark" ? "Gelap" : "Terang"}
      </span>
      <div className="relative size-4.5 flex items-center justify-center mb-[0.1rem]">
        <IconSun className="absolute h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
        <IconMoon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      </div>
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
