import type { z } from "zod";

/** A domain's multi-select filters: each an array schema with a fallback. */
export type FilterFields = Record<string, z.ZodType>;

/**
 * The DEFAULT value of each declared filter, for the router's
 * `stripSearchParams` middleware - a value equal to its default is omitted from
 * the URL rather than serialized, the same way `page` and `sort` are. Defaults
 * to the EMPTY array (an unset filter); pass `defaults` for a filter that opens
 * pre-selected.
 */
export function filteringStripDefaults(
	filters: FilterFields,
	defaults: Record<string, unknown> = {},
): Record<string, unknown> {
	return Object.fromEntries(
		Object.keys(filters).map((key) => [key, defaults[key] ?? []]),
	) as Record<string, unknown>;
}
