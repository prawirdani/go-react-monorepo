export interface ResponseBody<T = null> {
	// Optional to match Go's `Body` envelope (`data,omitempty`): message-only
	// responses omit `data` entirely.
	data?: T;
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

// All three slices are opt-in — pass `never` (or just omit) to exclude one.
// The opt-out branch is `unknown`, not `never`: `never` is absorbing under
// intersection (`never & { pagination: … }` is `never`), so using it as the
// sentinel would collapse `QueryMetaOnly` to `never` and leave a default-meta
// `meta` unusable. `X & unknown = X` keeps the remaining slices.
//
// `filter` and `sort` are optional within a slice. Go marshals both with
// `omitempty`/`omitzero` (internal/ports/repository/query.go:46-47): applying no
// filter leaves the key out, and `ApplySort` clears its fields when the requested
// column is not allow-listed, so an unsorted request omits `sort` entirely.
//
// `pagination` stays required, because it is always present:
// `ApplyPagination` clamps page and limit to at least 1 before `PageMeta` runs
// (internal/ports/repository/pagination.go), so that object is never the zero
// value `omitzero` would drop.
export type QueryMeta<
	TFilter = never,
	TSortKey extends string = never,
	TPagination = never,
> = (IsNever<TFilter> extends true ? unknown : { filter?: TFilter }) &
	(IsNever<TSortKey> extends true ? unknown : { sort?: Sort<TSortKey> }) &
	(IsNever<TPagination> extends true ? unknown : { pagination: PaginationMeta });

/** Default meta: an endpoint that echoes pagination only, no filter/sort. */
export type QueryMetaOnly = QueryMeta<never, never, true>;

/** The success envelope with an endpoint-specific `meta` slice. */
export type ResponseBodyWithMeta<TData, TMeta> = ResponseBody<TData> & {
	meta: TMeta;
};

/**
 * A list response. A special case of `ResponseBodyWithMeta`, not a parallel
 * shape.
 */
export type QueryableResponse<
	TData,
	TMeta = QueryMetaOnly,
> = ResponseBodyWithMeta<TData[], TMeta>;

// example:
// A list carrying all three meta slices
// type UserListResponse = QueryableResponse<User, QueryMeta<UserFilter, UserSortKey, true>>;
//
// // A list carrying pagination only (the default)
// type LogListResponse = QueryableResponse<LogEntry>;
//
// // A single object carrying a declared meta slice
// type MeResponse = ResponseBodyWithMeta<User, { session_id: string }>;
