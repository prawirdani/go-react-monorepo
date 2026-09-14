import type { Messages } from "use-intl";
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
