export interface ResponseBody<T = null> {
	data: T;
	message?: string;
}

/** The `meta.pagination` slice — the only piece most list endpoints return. */
export type PaginationMeta = {
	page: number;
	limit: number;
	total: number;
	total_pages: number;
};

type SortOrder = "ASC" | "DESC";

interface Sort<TSortKey extends string> {
	by: TSortKey;
	order: SortOrder;
}

// Helper to detect an "unset" generic
type IsNever<T> = [T] extends [never] ? true : false;

// All three slices are opt-in — pass `never` (or just omit) to exclude one
export type QueryMeta<
	TFilter = never,
	TSortKey extends string = never,
	TPagination = never,
> = (IsNever<TFilter> extends true ? never : { filter: TFilter }) &
	(IsNever<TSortKey> extends true ? never : { sort: Sort<TSortKey> }) &
	(IsNever<TPagination> extends true ? never : { pagination: PaginationMeta });

/** Default meta: an endpoint that echoes pagination only, no filter/sort. */
export type QueryMetaOnly = QueryMeta<never, never, true>;

/**
 * A list response whose `meta` carries whatever the endpoint echoes —
 * pagination, applied filters, applied sort. Not pagination-specific.
 */
export type QueryableResponse<TData, TMeta = QueryMetaOnly> = ResponseBody<
	TData[]
> & {
	meta: TMeta;
};

// example:
// All three
// type UserListResponse = QueryableResponse<User, Meta<UserFilter, UserSortKey, true>>;
//
// // Only pagination (the default)
// type LogListResponse = QueryableResponse<LogEntry>;
//
// // Only filter + sort, no pagination
// type ExportResponse = QueryableResponse<User, Meta<UserFilter, UserSortKey>>;
