import type { Messages, useTranslations } from "use-intl";
import type { Locale } from "../config";
import en from "./en";
import id from "./id";

export const messages: Record<Locale, unknown> = { en, id };

/**
 * The catalog for a locale. Cast because `id` is deliberately typed as a
 * widened shape of `en`, while `use-intl` derives its message type from the
 * literal English catalog.
 */
export function catalogFor(locale: Locale): Messages {
	return messages[locale] as Messages;
}

/** Every dot-path in T that resolves to an object (valid namespaces only). */
type NestedKeyOf<T> = {
	[K in keyof T & string]: T[K] extends Record<string, unknown>
		? `${K}` | `${K}.${NestedKeyOf<T[K]>}`
		: never;
}[keyof T & string];

/** Every *leaf* dot-path in T — objects never qualify (valid t() keys). */
type MessagePaths<T> = {
	[K in keyof T & string]: T[K] extends Record<string, unknown>
		? `${K}.${MessagePaths<T[K]>}`
		: K;
}[keyof T & string];

/** Deep-index T by a dot-separated path string. */
type Get<T, Path extends string> = Path extends `${infer Head}.${infer Rest}`
	? Head extends keyof T
		? Get<T[Head], Rest>
		: never
	: Path extends keyof T
		? T[Path]
		: never;

type Namespace = NestedKeyOf<Messages>;

type RootNamespace = "";

export type Translator<
	N extends Namespace | RootNamespace | undefined = undefined,
> = ReturnType<typeof useTranslations<N extends Namespace ? N : never>>;

export type MessageKeys<
	N extends Namespace | RootNamespace | undefined = undefined,
> = N extends Namespace
	? MessagePaths<Get<Messages, N>>
	: MessagePaths<Messages>;
