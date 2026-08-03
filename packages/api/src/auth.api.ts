import type {
	ChangePasswordInput,
	LoginInput,
	PasswordRecoveryToken,
	RecoverPasswordInput,
	ResetPasswordInput,
	TokenPair,
} from "@repo/schemas/auth";
import type { User } from "@repo/schemas/user";
import { parseEpoch } from "@repo/utils/date";
import type { APIClient } from "./client";

export class AuthAPI {
	private client: APIClient;

	constructor(client: APIClient) {
		this.client = client;
	}

	async login(credentials: LoginInput): Promise<TokenPair> {
		const res = await this.client.Post<TokenPair>("/api/auth/login", {
			body: JSON.stringify(credentials),
			noAuth: true,
		});

		return res.data;
	}

	async logout(): Promise<void> {
		await this.client.Delete<null>("/api/auth/logout", {
			skipRefresh: true,
		});
	}

	async identify(): Promise<User> {
		const res = await this.client.Get<User>("/api/auth/me");
		return res.data;
	}

	/**
	 * Changing password for authed user.
	 */
	async changePassword(payload: ChangePasswordInput): Promise<void> {
		await this.client.Put("/api/auth/password/change", {
			body: JSON.stringify(payload),
		});
	}

	/**
	 * Requests a password recovery email.
	 *
	 * @returns An object containing `retry_after`, represented timestamp with ISO 8601 date-time when another request is allowed.
	 */
	async recoverPassword(
		payload: RecoverPasswordInput,
	): Promise<{ retry_after: Date }> {
		const res = await this.client.Fetch(
			"http://localhost:8080/api/auth/password/recover",
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

	/**
	 * Get password recovery token.
	 */
	async getPasswordRecoveryToken(
		token: string,
	): Promise<PasswordRecoveryToken> {
		const res = await this.client.Get<PasswordRecoveryToken>(
			`/api/auth/password/recover/${token}`,
		);
		return res.data;
	}

	/**
	 * Reset password using password recovery token.
	 */
	async resetPassword(payload: ResetPasswordInput): Promise<void> {
		await this.client.Put("/api/auth/password/reset", {
			body: JSON.stringify(payload),
		});
	}
}
