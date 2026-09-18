import type { UserAPI } from "@repo/api";
import type { UpdateUserInput, UserSearchQuery } from "@repo/schemas/user";
import {
	keepPreviousData,
	mutationOptions,
	queryOptions,
} from "@tanstack/react-query";
import { AUTH_KEY } from "./auth.query";

const KEY = "users" as const;

/**
 * Declarative invalidation targets, read by the dashboard's `MutationCache`
 * (`main.tsx`). Every user mutation touches both: the session identity
 * (header, `AUTH_KEY`) and the admin list (`KEY`) — whose rows render
 * avatar/name/phone/gender, so a profile edit shows there too.
 */
const meta = { invalidatesQuery: [[AUTH_KEY], [KEY]] };

export function userQueries(userAPI: UserAPI) {
	return {
		listUser: (params: UserSearchQuery) =>
			queryOptions({
				queryKey: [KEY, params],
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
