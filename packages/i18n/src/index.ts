import "./global";

import { createTranslator } from "use-intl";
import { type Locale, TIME_ZONE } from "./config";
import { catalogFor } from "./messages";

// Reading hooks, typed through the AppConfig augmentation in ./global.
export { useFormatter, useLocale, useTranslations } from "use-intl";

export {
	DEFAULT_LOCALE,
	isLocale,
	LOCALE_STORAGE_KEY,
	LOCALES,
	type Locale,
	TIME_ZONE,
} from "./config";
export {
	catalogFor,
	type MessageKeys,
	messages,
	type Translator,
} from "./messages";
export { I18nProvider, useSetLocale } from "./provider";

/**
 * Non-React entry point for toasts, stores, and other imperative callers.
 * Types from the catalog passed in, not from AppConfig.
 */
export function getTranslator(locale: Locale) {
	return createTranslator({
		locale,
		messages: catalogFor(locale),
		timeZone: TIME_ZONE,
	});
}
