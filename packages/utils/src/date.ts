export function parseEpoch(value: unknown): Date | null {
	if (
		typeof value !== "number" ||
		!Number.isFinite(value) ||
		!Number.isInteger(value)
	) {
		return null;
	}

	const date = new Date(value * 1000);

	return Number.isNaN(date.getTime()) ? null : date;
}

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parse a `YYYY-MM-DD` calendar day into its local calendar parts, rejecting
 * anything that is not a real day (e.g. `2026-02-30`, which `Date` would roll
 * forward into March).
 */
function parseDay(day: string): { year: number; month: number; date: number } | null {
	const match = DAY_PATTERN.exec(day);
	if (!match) return null;

	const year = Number(match[1]);
	const month = Number(match[2]);
	const date = Number(match[3]);

	const probe = new Date(year, month - 1, date);
	if (
		probe.getFullYear() !== year ||
		probe.getMonth() !== month - 1 ||
		probe.getDate() !== date
	) {
		return null;
	}

	return { year, month, date };
}

/**
 * Local start-of-day as an ISO datetime, e.g. "2026-09-17" -> the instant the
 * local day begins. A UTC+7 (WIB) user's "17 Sep" is "2026-09-16T17:00:00.000Z".
 *
 * The whole reason these exist: a "day" is a calendar concept in the user's
 * timezone, not UTC. Assuming `T00:00:00Z` would shift the window by the UTC
 * offset and drop (or add) hours of the user's actual day. `new Date(y, m, d)`
 * is local by spec, and `toISOString()` does the conversion for us.
 */
export function dayStartIso(day: string): string {
	const parts = parseDay(day);
	if (!parts) return "";

	const local = new Date(parts.year, parts.month - 1, parts.date, 0, 0, 0, 0);
	return local.toISOString();
}

/** Local end-of-day (23:59:59.999) as an ISO datetime; "" when unparseable. */
export function dayEndIso(day: string): string {
	const parts = parseDay(day);
	if (!parts) return "";

	const local = new Date(parts.year, parts.month - 1, parts.date, 23, 59, 59, 999);
	return local.toISOString();
}
