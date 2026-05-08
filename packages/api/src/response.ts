export interface APIResponse<TData = null> {
	data: TData;
	message: string | null;
}

// TODO:
export type PaginationMeta = {
	page: number;
	size: number;
	count: number;
	max_page: number;
};

export type APIPaginatedResponse<T> = APIResponse<T[]> & {
	pagination: PaginationMeta;
};
