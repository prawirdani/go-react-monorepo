import type {
	ChangePasswordInput,
	CompleteRegistrationInput,
	LoginInput,
	OpaqueTokenMeta,
	RecoverPasswordInput,
	RegisterInput,
	RegistrationToken,
	ResetPasswordInput,
	SessionEntry,
	TokenPair,
} from "@repo/schemas/auth";
import type { Permission } from "@repo/schemas/permission";
import type { User } from "@repo/schemas/user";
import { parseEpoch } from "@repo/utils/date";
import type { APIClient } from "./client";

export class AuthAPI {
	private client: APIClient;

	constructor(client: APIClient) {
		this.client = client;
	}

	/**
	 * Registers a user. The public form exists only on a *public* deployment
	 * (`internal_mode: false`), where the caller has no session to send — so it
	 * passes `{ noAuth: true }`. The admin/invite case requires
	 * auth.register-user and defaults to sending the session.
	 */
	async register(
		payload: RegisterInput,
		options?: { noAuth?: boolean },
	): Promise<void> {
		await this.client.Post("/api/auth/register", {
			body: JSON.stringify(payload),
			noAuth: options?.noAuth ?? false,
		});
	}

	/** Completes registration from a token. Unauthenticated. */
	async completeRegistration(
		payload: CompleteRegistrationInput,
	): Promise<void> {
		await this.client.Post("/api/auth/register/complete", {
			body: JSON.stringify(payload),
			noAuth: true,
		});
	}

	/** Reads a registration token's metadata. Unauthenticated. */
	async getRegistrationToken(rawToken: string): Promise<RegistrationToken> {
		const res = await this.client.Get<RegistrationToken>(
			`/api/auth/register/${rawToken}`,
		);
		return res.data;
	}

	/** Authenticates and sets the session cookies. Unauthenticated. */
	async login(credentials: LoginInput): Promise<TokenPair> {
		const res = await this.client.Post<TokenPair>("/api/auth/login", {
			body: JSON.stringify(credentials),
			noAuth: true,
		});

		return res.data;
	}

	/** Destroys the current session and clears its cookies. */
	async logout(): Promise<void> {
		await this.client.Delete<null>("/api/auth/logout", {
			skipRefresh: true,
		});
	}

	/** Returns the current user. Self. */
	async identify(): Promise<User> {
		const res = await this.client.Get<User>("/api/auth/me");
		return res.data;
	}

	/**
	 * Changes the current user's password. Self.
	 */
	async changePassword(payload: ChangePasswordInput): Promise<void> {
		await this.client.Put("/api/auth/password/change", {
			body: JSON.stringify(payload),
		});
	}

	/**
	 * Requests a password recovery email. Unauthenticated.
	 *
	 * @returns An object containing `retry_after`, represented timestamp with ISO 8601 date-time when another request is allowed.
	 */
	async recoverPassword(
		payload: RecoverPasswordInput,
	): Promise<{ retry_after: Date }> {
		const res = await this.client.Fetch(
			`${this.client.getBaseURL()}/api/auth/password/recover`,
			{
				method: "POST",
				credentials: "include",
				body: JSON.stringify(payload),
			},
		);

		if (!res.ok) {
			const errorBody = await res.json().catch((e) => e);
			throw errorBody;
		}

		const retryAfter = Number(res.headers.get("retry-after"));
		const date = parseEpoch(retryAfter);

		return {
			retry_after: date ?? new Date(0),
		};
	}

	/** Gets a password recovery token's metadata. Unauthenticated. */
	async getPasswordRecoveryToken(token: string): Promise<OpaqueTokenMeta> {
		const res = await this.client.Get<OpaqueTokenMeta>(
			`/api/auth/password/recover/${token}`,
		);
		return res.data;
	}

	/** Resets a password using a recovery token. Unauthenticated. */
	async resetPassword(payload: ResetPasswordInput): Promise<void> {
		await this.client.Put("/api/auth/password/reset", {
			body: JSON.stringify(payload),
		});
	}

	/** Lists the current user's permissions. Self. */
	async getPermissions(): Promise<Permission[]> {
		const res = await this.client.Get<Permission[]>("/api/auth/permissions");
		return res.data;
	}

	/**
	 * Lists active sessions of given user id.
	 * Requires auth.view-user-sessions permission or self (current user).
	 */
	async listUserSession(userId: string): Promise<SessionEntry[]> {
		const res = await this.client.Get<SessionEntry[]>(
			`/api/auth/sessions/users/${userId}`,
		);
		return res.data;
	}

	/**
	 * Revokes all active sessions of given user id.
	 * Requires auth.revoke-user-sessions permission or self (current user).
	 */
	async revokeUserSessions(userId: string) {
		await this.client.Delete(`/api/auth/users/${userId}`);
	}

	/**
	 * Revokes specific session.
	 * Requires auth.revoke-user-sessions permission or self (current user).
	 */
	async revokeSession(sessionId: string) {
		await this.client.Delete(`/api/auth/sessions/${sessionId}`);
	}
}
