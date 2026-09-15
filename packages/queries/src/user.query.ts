import type { AuthAPI } from "@repo/api";
import { keepPreviousData, queryOptions } from "@tanstack/react-query";

export function userQueries(authAPI: AuthAPI) {
	return {
		currentUser: queryOptions({
			queryKey: ["current-user"],
			queryFn: () => authAPI.identify(),
			staleTime: 15 * 60 * 1000, // 15 minutes
			placeholderData: keepPreviousData,
			retry: false,
		}),
	};
}
