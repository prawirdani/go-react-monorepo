import { useCallback, useEffect, useState } from "react"

export function useLocalStorage<T>(key: string, parse: (raw: string) => T) {
  const [entry, setEntry] = useState<StoredEntry<T> | null>(() =>
    readEntry(key, parse),
  )

  const setValue = useCallback((value: T | null, ttlMs?: number) => {
    if (value === null) {
      setEntry(null)
      return
    }
    setEntry({ value, expiresAt: ttlMs ? Date.now() + ttlMs : null })
  }, [])

  useEffect(() => {
    if (!entry) {
      localStorage.removeItem(key)
      return
    }

    localStorage.setItem(
      key,
      JSON.stringify({
        value: JSON.stringify(entry.value),
        expiresAt: entry.expiresAt,
      }),
    )

    if (entry.expiresAt === null) return

    const ms = entry.expiresAt - Date.now()
    if (ms <= 0) {
      setEntry(null)
      return
    }

    const timer = setTimeout(() => setEntry(null), ms)
    return () => clearTimeout(timer)
  }, [entry, key])

  return {
    value: entry?.value ?? null,
    setValue,
  }
}

interface StoredEntry<T> {
  value: T
  expiresAt: number | null // epoch ms; null = no expiry
}

function readEntry<T>(
  key: string,
  parse: (raw: string) => T,
): StoredEntry<T> | null {
  const raw = localStorage.getItem(key)
  if (!raw) return null

  try {
    const { value, expiresAt } = JSON.parse(raw) as {
      value: string
      expiresAt: number | null
    }
    if (expiresAt !== null && expiresAt <= Date.now()) return null
    return { value: parse(value), expiresAt }
  } catch {
    return null
  }
}
