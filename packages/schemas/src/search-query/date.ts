import { z } from "zod";

/**
 * Date filtering shared by every search query.
 *
 * `date` is a single client-local day sent as a UTC datetime: the backend
 * resolves these params in UTC, so a date-only value would be read as a UTC day
 * and shift the window by the client's offset. A WIB (UTC+7) user picking
 * 1 Sept sends `2026-08-31T17:00:00.000Z`. `from`/`to` are an explicit range;
 * the server lets `date` win over them, so a caller must not send both — see
 * `audit.api.ts`.
 *
 * Each field `.catch("")`s: a hand-edited or malformed URL param becomes the
 * empty string, which `stripSearchParams` drops from the URL and the API layer
 * omits from the request. That is what makes "a malformed date falls through"
 * true on the client too (nothing is sent, so the server sees nothing). A
 * hand-edited date-only `date=` now fails validation and is dropped — intended.
 */
export const dateFields = {
	date: z.iso.datetime().catch(""),
	from: z.iso.datetime().catch(""),
	to: z.iso.datetime().catch(""),
} as const;

export type DateQuery = { date: string; from: string; to: string };

/** Empty values, for the router's `stripSearchParams` middleware. */
export const dateStripDefaults = { date: "", from: "", to: "" };
