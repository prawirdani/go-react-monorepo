import type { UserAPI } from "@repo/api";
import type { UpdateUserInput, UserSearchQuery } from "@repo/schemas/user";
import {
	keepPreviousData,
	mutationOptions,
	queryOptions,
} from "@tanstack/react-query";
import { AUTH_KEY, USER_KEY } from "./keys";

/**
 * Declarative invalidation targets, read by the dashboard's `MutationCache`
 * (`lib/query-client.ts`). Every user mutation touches both: the session
 * identity (header, `AUTH_KEY`) and the admin list (`USER_KEY`) — whose rows
 * render avatar/name/phone/gender, so a profile edit shows there too.
 */
const meta = { invalidatesQuery: [[AUTH_KEY], [USER_KEY]] };

export function userQueries(userAPI: UserAPI) {
	return {
		listUser: (params: UserSearchQuery) =>
			queryOptions({
				queryKey: [USER_KEY, params],
				queryFn: () => userAPI.listUser(params),
				placeholderData: keepPreviousData, // keep old page visible while the next loads
				retry: false,
				staleTime: 60 * 1000, // 1 minute
			}),
	};
}

export function userMutations(userAPI: UserAPI) {
	return {
		updateUser: mutationOptions({
			mutationFn: (args: { userId: string; payload: UpdateUserInput }) =>
				userAPI.updateUser(args.userId, args.payload),
			meta,
		}),
		deleteUser: mutationOptions({
			mutationFn: (userId: string) => userAPI.deleteUser(userId),
			meta,
		}),
		changeProfilePicture: mutationOptions({
			mutationFn: (pict: File) => userAPI.changeProfilePicture(pict),
			meta,
		}),
		deleteProfilePicture: mutationOptions({
			mutationFn: () => userAPI.deleteProfilePicture(),
			meta,
		}),
	};
}
