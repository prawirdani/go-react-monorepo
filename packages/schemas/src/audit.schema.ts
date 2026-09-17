type JsonObject = Record<string, unknown>;

export interface AuditEntry {
	id: number;
	actor_id: string | null;
	action: string;
	entity: string;
	entity_id: string;
	prev: JsonObject | null;
	next: JsonObject | null;
	meta: JsonObject | null;
	created_at: string;
}
