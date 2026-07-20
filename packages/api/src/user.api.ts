import type { UpdateUserInput } from "@repo/schemas/user";
import type { APIClient } from "./client";

export class UserAPI {
	private client: APIClient;

	constructor(client: APIClient) {
		this.client = client;
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

	async updateUser(payload: UpdateUserInput): Promise<void> {
		await this.client.Put("/api/users", {
			body: JSON.stringify(payload),
		});
	}

	async deleteProfilePicture(): Promise<void> {
		await this.client.Delete("/api/users/profile-picture");
	}
}
