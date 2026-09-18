import type { AuthAPI } from "@repo/api";
import type { Permission } from "@repo/schemas/permission";
import type { User } from "@repo/schemas/user";
import { queryOptions } from "@tanstack/react-query";

export const AUTH_KEY = "auth" as const;

/** The session as one cached fact: identity and permissions must not disagree. */
export type AuthSession = {
	user: User;
	permissions: Permission[];
};

export function authQueries(authAPI: AuthAPI) {
	return {
		getSession: queryOptions({
			queryKey: [AUTH_KEY],
			queryFn: async (): Promise<AuthSession> => {
				const [user, permissions] = await Promise.all([
					authAPI.identify(),
					authAPI.getPermissions(),
				]);
				return { user, permissions };
			},
			// No grace window: a revoked session must be visible on the next
			// navigation, not 15 minutes later.
			staleTime: 0,
			retry: false,
		}),
	};
}
