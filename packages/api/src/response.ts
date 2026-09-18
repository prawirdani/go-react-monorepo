export interface ResponseBody<T = null> {
	data: T;
	message?: string;
}

export type PaginationMeta = {
	page: number;
	limit: number;
	total: number;
	total_pages: number;
};

export type PaginatedResponseBody<T> = ResponseBody<T[]> & {
	meta: PaginationMeta;
};
