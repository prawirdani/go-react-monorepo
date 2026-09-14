/**
 * Keeps the key shape of a catalog but widens every leaf string, so a
 * translation catalog can be typed against its English source: a missing or
 * misspelled key becomes a compile error, while the copy stays free-form.
 */
export type DeepStringify<T> = T extends string
	? string
	: T extends object
		? { [K in keyof T]: DeepStringify<T[K]> }
		: T;
