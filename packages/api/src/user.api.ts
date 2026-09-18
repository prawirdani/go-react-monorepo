import type {
	UpdateUserInput,
	User,
	UserFilter,
	UserSearchQuery,
	UserSortKey,
} from "@repo/schemas/user";
import type { APIClient } from "./client";
import type { QueryableResponse, QueryMeta } from "./response";

/** Meta the users list endpoint echoes: applied filters, sort, pagination. */
export type UserListMeta = QueryMeta<UserFilter, UserSortKey, true>;

export class UserAPI {
	private client: APIClient;

	constructor(client: APIClient) {
		this.client = client;
	}

	// available queries: /api/users?sort=(id/created_at/updated_at)&order=(asc/desc)&page=1&limit=10&role=admin,user&gender=M,F,O
	async listUser(
		params: UserSearchQuery,
	): Promise<QueryableResponse<User, UserListMeta>> {
		const query = new URLSearchParams({
			page: String(params.page),
			limit: String(params.limit),
			sort: params.sort,
			order: params.order,
		});
		// Multi-select filters: comma-joined, omitted when empty (backend
		// treats gender as UPPERCASE M/F/O).
		if (params.role.length) query.set("role", params.role.join(","));
		if (params.gender.length) query.set("gender", params.gender.join(","));
		return await this.client.Queryable<User, UserListMeta>(
			`/api/users?${query}`,
		);
	}

	async updateUser(payload: UpdateUserInput): Promise<void> {
		await this.client.Put("/api/users", {
			body: JSON.stringify(payload),
		});
	}

	async deleteUser(userID: string): Promise<void> {
		await this.client.Delete(`/api/users/${userID}`);
	}

	async changeProfilePicture(pict: File): Promise<void> {
		const formData = new FormData();
		if (pict) {
			formData.append("image", pict);
		}

		await this.client.Put("/api/users/profile-picture", {
			body: formData,
		});
	}

	async deleteProfilePicture(): Promise<void> {
		await this.client.Delete("/api/users/profile-picture");
	}
}
