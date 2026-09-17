import type { AuditEntry } from "@repo/schemas/audit";
import type { APIClient } from "./client";

export class AuditAPI {
	private client: APIClient;

	constructor(client: APIClient) {
		this.client = client;
	}

	async listAuditEntry(): Promise<AuditEntry[]> {
		const res = await this.client.Get<AuditEntry[]>("/api/audit");
		return res.data;
	}
}
