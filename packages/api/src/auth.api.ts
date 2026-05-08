import type { LoginInput, TokenPair } from "@repo/schemas/auth";
import type { User } from "@repo/schemas/user";
import type { APIClient } from "./client";

export class AuthAPI {
	private client: APIClient;

	constructor(client: APIClient) {
		this.client = client;
	}

	async login(data: LoginInput): Promise<TokenPair> {
		const res = await this.client.Post<TokenPair>("/api/auth/login", {
			credentials: "include",
			body: JSON.stringify(data),
		});

		return res.data;
	}

	async identify(): Promise<User> {
		const res = await this.client.Get<User>("/api/auth/me", {
			withAuth: true,
		});
		return res.data;
	}

	async logout(): Promise<void> {
		await this.client.Delete<null>("/api/auth/logout", {
			withAuth: true,
			skipRefresh: true,
		});
	}

	async refreshAccessToken(): Promise<TokenPair> {
		const res = await this.client.Post<TokenPair>("/api/auth/refresh", {
			withAuth: true,
			skipRefresh: true,
		});
		return res.data;
	}
}
