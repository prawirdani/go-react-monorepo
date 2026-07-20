import type {
	ChangePasswordInput,
	LoginInput,
	PasswordRecoveryToken,
	RecoverPasswordInput,
	ResetPasswordInput,
	TokenPair,
} from "@repo/schemas/auth";
import type { User } from "@repo/schemas/user";
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
	 * Request password recovery (forgot password).
	 */
	async recoverPassword(payload: RecoverPasswordInput): Promise<void> {
		await this.client.Post("/api/auth/password/recover", {
			body: JSON.stringify(payload),
		});
	}

	/**
	 * Get password recovery token.
	 */
	async getPasswordRecoveryToken(
		token: string,
	): Promise<PasswordRecoveryToken> {
		const res = await this.client.Get<PasswordRecoveryToken>(
			`/password/recover/${token}`,
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
