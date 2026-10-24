import { useTranslations } from "@repo/i18n"
import { useEffect, useState } from "react"

/**
 * Tracks a "retry after" deadline for a throttled action, persisting it in
 * localStorage so a page reload keeps the lock. Pass a distinct `storageKey`
 * per flow (login lockout, recovery throttle, ...) so they never collide.
 *
 * `isThrottled` is true until the deadline elapses, at which point the hook
 * auto-clears itself and flips back to false.
 */
export function useRetryAfter(storageKey: string) {
	const [retryAfter, setRetryAfter] = useState<Date | null>(() => {
		const raw = localStorage.getItem(storageKey)
		if (!raw) return null
		const date = new Date(raw)
		const isValidDate = date instanceof Date && !Number.isNaN(date.getTime())
		if (!isValidDate || date.getTime() <= Date.now()) {
			localStorage.removeItem(storageKey)
			return null
		}
		return date
	})

	const isThrottled = retryAfter !== null && retryAfter.getTime() > Date.now()

	// Persist retryAfter, and auto-clear it (and the button lock) once it elapses.
	useEffect(() => {
		if (!retryAfter) {
			localStorage.removeItem(storageKey)
			return
		}
		localStorage.setItem(storageKey, retryAfter.toISOString())
		const ms = retryAfter.getTime() - Date.now()
		if (ms <= 0) {
			setRetryAfter(null)
			return
		}
		const timer = setTimeout(() => {
			setRetryAfter(null)
		}, ms)
		return () => clearTimeout(timer)
	}, [retryAfter, storageKey])

	return { retryAfter, setRetryAfter, isThrottled }
}

/** Live-updating "N seconds" counter that ticks down to the given deadline. */
export function Countdown({ until }: { until: Date }) {
	const t = useTranslations("app")
	const getRemainingSeconds = () =>
		Math.max(0, Math.ceil((until.getTime() - Date.now()) / 1000))
	const [seconds, setSeconds] = useState(getRemainingSeconds)

	// biome-ignore lint/correctness/useExhaustiveDependencies: getRemainingSeconds is derived purely from `until`
	useEffect(() => {
		setSeconds(getRemainingSeconds())
		const timer = setInterval(() => {
			setSeconds(getRemainingSeconds())
		}, 1000)
		return () => clearInterval(timer)
	}, [until])

	return (
		<span>
			{seconds} {t("auth.forgot.secondsUnit")}
		</span>
	)
}
