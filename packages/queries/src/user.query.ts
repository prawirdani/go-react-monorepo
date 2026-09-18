import type { AuthAPI, UserAPI } from "@repo/api";
import type { UserSearchQuery } from "@repo/schemas/user";
import { keepPreviousData, queryOptions } from "@tanstack/react-query";

export function userQueries(authAPI: AuthAPI, userAPI: UserAPI) {
	return {
		currentUser: queryOptions({
			queryKey: ["current-user"],
			queryFn: () => authAPI.identify(),
			staleTime: 15 * 60 * 1000, // 15 minutes
			placeholderData: keepPreviousData,
			retry: false,
		}),
		list: (params: UserSearchQuery) =>
			queryOptions({
				queryKey: ["users", params],
				queryFn: () => userAPI.listUser(params),
				placeholderData: keepPreviousData, // keep old page visible while the next loads
				retry: false,
				staleTime: 60 * 1000, // 1 minute
			}),
	};
}
