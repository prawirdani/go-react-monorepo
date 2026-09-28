import type { z } from "zod";

/** A domain's multi-select filters: each an array schema with an empty fallback. */
export type FilterFields = Record<string, z.ZodType>;

/**
 * The EMPTY value of each declared filter, for the router's `stripSearchParams`
 * middleware — an unset filter is omitted from the URL rather than serialized as
 * `role=[]`. Base params (page, limit, sort, order) are never stripped.
 */
export function filteringStripDefaults(
	filters: FilterFields,
): Record<string, unknown> {
	return Object.fromEntries(
		Object.keys(filters).map((key) => [key, []]),
	) as Record<string, unknown>;
}
