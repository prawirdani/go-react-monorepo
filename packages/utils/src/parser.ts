import { parse } from "bowser";

export function parseUA(raw: string) {
	return parse(raw);
}
