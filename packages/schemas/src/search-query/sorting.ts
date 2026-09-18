import { z } from "zod";

export const SORT_ORDERS = ["asc", "desc"] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

/**
 * `sort`/`order` fields for a domain's sortable fields.
 *
 * `z.enum()` derives its output from the tuple's *constraint*, which widens a
 * generic tuple to `string`. The `const TSort` parameter keeps the caller's
 * literal elements and the assertion below restores the literal union — the
 * runtime schema is unchanged, and callers keep `query.sort` as the domain
 * union instead of `string`.
 */
export function sortingFields<
	const TSort extends readonly [string, ...string[]],
>(sort: TSort, defaultSort: TSort[number]) {
	const sortSchema = z.enum(sort).catch(defaultSort) as z.ZodType<
		TSort[number]
	>;

	return {
		sort: sortSchema,
		order: z.enum(SORT_ORDERS).catch("desc"),
	};
}

export type SortingQuery<T extends string = string> = {
	sort: T;
	order: SortOrder;
};
