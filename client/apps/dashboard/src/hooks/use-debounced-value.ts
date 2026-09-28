import { useEffect, useState } from "react"

/**
 * Returns `value` after it has stayed unchanged for `delay` ms. The timeout is
 * cleared on every change and on unmount, so a rapid typist fires one update
 * and an unmount never sets state on a dead component.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])

  return debounced
}
