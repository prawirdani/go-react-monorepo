import { keepPreviousData } from "@tanstack/react-query";

export const DEFAULT_QUERY_OPTS = {
	placeholderData: keepPreviousData,
	retry: false,
	staleTime: 10 * 60 * 1000, // 10 minutes
	gcTime: 1000 * 60 * 5, // 5 minutes
};
