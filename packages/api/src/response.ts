export interface APIResponse<T = null> {
	data: T;
	message: string | null;
}

export type PaginationMeta = {
	page: number;
	size: number;
	count: number;
	max_page: number;
};

export type APIPaginatedResponse<T> = APIResponse<T[]> & {
	pagination: PaginationMeta;
};
