import { useEffect, useState } from "react"

export function useDelayedLoading(state: boolean, delay: number = 350) {
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>

    const exec = () => {
      if (state) {
        timerId = setTimeout(() => {
          setLoading(true)
        }, delay)
      } else {
        clearTimeout(timerId)
        setLoading(false)
      }
    }

    exec()

    return () => clearTimeout(timerId)
  }, [state, delay])

  return loading
}
