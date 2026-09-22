import type { AuthAPI } from "@repo/api";
import type { RegisterInput } from "@repo/schemas/auth";
import type { Permission } from "@repo/schemas/permission";
import type { User } from "@repo/schemas/user";
import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { AUTH_KEY, SESSIONS_KEY, USER_KEY } from "./keys";

/**
 * The session as one cached fact: identity, permissions, and the session id the
 * identity was resolved with must not disagree.
 */
export type AuthSession = {
	user: User;
	permissions: Permission[];
	sessionId: string;
};

export function authQueries(authAPI: AuthAPI) {
	return {
		getSession: queryOptions({
			queryKey: [AUTH_KEY],
			queryFn: async (): Promise<AuthSession> => {
				const [identity, permissions] = await Promise.all([
					authAPI.identify(),
					authAPI.getPermissions(),
				]);
				return {
					user: identity.user,
					permissions,
					sessionId: identity.session_id,
				};
			},
			// No grace window: a revoked session must be visible on the next
			// navigation, not 15 minutes later.
			staleTime: 0,
			retry: false,
		}),
		/**
		 * Active sessions for one user. Self, or `auth.view-user-sessions` for an
		 * admin. No `staleTime` grace: whether a session is still live is server state.
		 */
		listUserSessions: (userId: string) =>
			queryOptions({
				queryKey: [SESSIONS_KEY, userId],
				queryFn: () => authAPI.listUserSession(userId),
				staleTime: 0,
				retry: false,
			}),
	};
}

/** Revoking can kill the caller's own session, so invalidate every list. */
const sessionMeta = { invalidatesQuery: [[SESSIONS_KEY]] };

export function authMutations(authAPI: AuthAPI) {
	return {
		revokeSession: mutationOptions({
			mutationFn: (sessionId: string) => authAPI.revokeSession(sessionId),
			meta: sessionMeta,
		}),
		revokeUserSessions: mutationOptions({
			mutationFn: (userId: string) => authAPI.revokeUserSessions(userId),
			meta: sessionMeta,
		}),
		/**
		 * Admin invite. Registers with the caller's session — the public
		 * self-registration form is the `noAuth` case — and refreshes the users
		 * list, which is where the invitation was sent from.
		 */
		inviteUser: mutationOptions({
			mutationFn: (payload: RegisterInput) => authAPI.register(payload),
			meta: { invalidatesQuery: [[USER_KEY]] },
		}),
	};
}
