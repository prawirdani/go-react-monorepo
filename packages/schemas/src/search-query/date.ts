import { z } from "zod";

/**
 * Date filtering shared by every search query.
 *
 * Every bound is a bare calendar day (`YYYY-MM-DD`) read in `tz`, an IANA zone
 * name. `tz` absent or unknown makes the backend fall back to UTC. A timestamp
 * is malformed and dropped: the server parses these params strictly as
 * `2006-01-02`, so `2026-08-31T17:00:00.000Z` is not a day. `from` is inclusive
 * and `to` covers its whole day; `date` is the single-day shortcut and wins over
 * `from`/`to`, so a caller must not send both — see `audit.api.ts`.
 *
 * Each field `.catch("")`s: a hand-edited or malformed URL param becomes the
 * empty string, which `stripSearchParams` drops from the URL and the API layer
 * omits from the request. That is what makes "a malformed date falls through"
 * true on the client too (nothing is sent, so the server sees nothing).
 */

/**
 * True when `tz` names a zone the platform knows.
 *
 * The backend falls back to UTC for an absent or unknown zone, and `Intl` is
 * the zone database both the browser and Node ship, so an unknown name is
 * dropped here rather than sent.
 */
export function isValidTimeZone(tz: string): boolean {
	if (!tz) return false;
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: tz });
		return true;
	} catch {
		return false;
	}
}

export const dateFields = {
	date: z.iso.date().catch(""),
	from: z.iso.date().catch(""),
	to: z.iso.date().catch(""),
	tz: z.string().refine(isValidTimeZone).catch(""),
} as const;

export type DateQuery = { date: string; from: string; to: string; tz: string };

/** Empty values, for the router's `stripSearchParams` middleware. */
export const dateStripDefaults = { date: "", from: "", to: "", tz: "" };
