import { useEffect, useRef, useState } from "react"

/**
 * Holds a loading state for a minimum time.
 *
 * The loading state is true the moment it starts and stays true until the data
 * lands *and* `minDuration` has elapsed, so a fast response cannot flash a
 * skeleton in and out. The floor only applies while the state was ever true: if
 * it never starts, nothing is delayed.
 */
export function useDelayedLoading(state: boolean, minDuration = 300) {
  const [holding, setHolding] = useState(false)
  const startedAt = useRef(0)

  useEffect(() => {
    if (state) {
      if (holding) return
      startedAt.current = Date.now()
      setHolding(true)
      return
    }

    if (!holding) return

    const remaining = minDuration - (Date.now() - startedAt.current)
    if (remaining <= 0) {
      setHolding(false)
      return
    }

    const timerId = setTimeout(() => setHolding(false), remaining)
    return () => clearTimeout(timerId)
  }, [state, holding, minDuration])

  return state || holding
}
