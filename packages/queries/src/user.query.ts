import type { AuthAPI, UserAPI } from "@repo/api";
import type { UpdateUserInput, UserSearchQuery } from "@repo/schemas/user";
import {
	keepPreviousData,
	mutationOptions,
	queryOptions,
} from "@tanstack/react-query";

const KEY = "users" as const;
const IDENTITY_KEY = "current-user" as const;

/**
 * Declarative invalidation targets, read by the dashboard's `MutationCache`
 * (`main.tsx`). Every user mutation touches both: the actor's identity
 * (header, `IDENTITY_KEY`) and the admin list (`KEY`) — whose rows render
 * avatar/name/phone/gender, so a profile edit shows there too.
 */
const meta = { invalidatesQuery: [[IDENTITY_KEY], [KEY]] };

export function userQueries(authAPI: AuthAPI, userAPI: UserAPI) {
	return {
		currentUser: queryOptions({
			queryKey: ["current-user"],
			queryFn: () => authAPI.identify(),
			staleTime: 15 * 60 * 1000, // 15 minutes
			placeholderData: keepPreviousData,
			retry: false,
		}),
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
