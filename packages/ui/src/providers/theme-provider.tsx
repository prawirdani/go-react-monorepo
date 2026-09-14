import {
  DEFAULT_THEME,
  THEME_IDS,
  type ThemeDefinition,
  type ThemeId,
  themes,
} from "@repo/ui/themes"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

export type ThemeMode = "dark" | "light" | "system"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultMode?: ThemeMode
  defaultTheme?: ThemeId
  storageKey?: string
  paletteStorageKey?: string
}

type ThemeProviderState = {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  theme: ThemeId
  setTheme: (theme: ThemeId) => void
  themes: ThemeDefinition[]
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(
  undefined,
)

const MODES: readonly ThemeMode[] = ["dark", "light", "system"]

function resolveMode(mode: ThemeMode): "dark" | "light" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
  }
  return mode
}

function readMode(key: string, fallback: ThemeMode): ThemeMode {
  if (typeof window === "undefined") return fallback
  const stored = window.localStorage.getItem(key)
  return stored && (MODES as readonly string[]).includes(stored)
    ? (stored as ThemeMode)
    : fallback
}

function readPalette(key: string, fallback: ThemeId): ThemeId {
  if (typeof window === "undefined") return fallback
  const stored = window.localStorage.getItem(key)
  return stored && (THEME_IDS as readonly string[]).includes(stored)
    ? (stored as ThemeId)
    : fallback
}

export function ThemeProvider({
  children,
  defaultMode = "system",
  defaultTheme = DEFAULT_THEME,
  storageKey = "vite-ui-theme",
  paletteStorageKey = "vite-ui-theme-palette",
  ...props
}: ThemeProviderProps) {
  const [mode, setModeState] = useState<ThemeMode>(() =>
    readMode(storageKey, defaultMode),
  )
  const [theme, setThemeState] = useState<ThemeId>(() =>
    readPalette(paletteStorageKey, defaultTheme),
  )

  // Mode axis: the .dark / .light class, exactly as before.
  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove("light", "dark")
    root.classList.add(resolveMode(mode))
  }, [mode])

  // Palette axis: data-theme, which the token blocks key off.
  useEffect(() => {
    window.document.documentElement.setAttribute("data-theme", theme)
  }, [theme])

  const setMode = useCallback(
    (next: ThemeMode) => {
      window.localStorage.setItem(storageKey, next)
      setModeState(next)
    },
    [storageKey],
  )

  const setTheme = useCallback(
    (next: ThemeId) => {
      window.localStorage.setItem(paletteStorageKey, next)
      setThemeState(next)
    },
    [paletteStorageKey],
  )

  const value = useMemo<ThemeProviderState>(
    () => ({ mode, setMode, theme, setTheme, themes }),
    [mode, setMode, theme, setTheme],
  )

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}
