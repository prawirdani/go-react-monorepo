import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { IntlProvider } from "use-intl";
import {
	DEFAULT_LOCALE,
	isLocale,
	LOCALE_STORAGE_KEY,
	type Locale,
	TIME_ZONE,
} from "./config";
import { catalogFor } from "./messages";

type I18nContextValue = {
	locale: Locale;
	setLocale: (locale: Locale) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function readInitialLocale(): Locale {
	if (typeof window === "undefined") return DEFAULT_LOCALE;
	const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
	return isLocale(stored) ? stored : DEFAULT_LOCALE;
}

/**
 * Locale lives outside use-intl so we can persist it and set `<html lang>`.
 * Changing the locale only re-renders — no `key` remount is required.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
	const [locale, setLocaleState] = useState<Locale>(readInitialLocale);

	useEffect(() => {
		document.documentElement.lang = locale;
	}, [locale]);

	const setLocale = useCallback((next: Locale) => {
		if (typeof window !== "undefined") {
			window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
		}
		setLocaleState(next);
	}, []);

	const value = useMemo<I18nContextValue>(
		() => ({ locale, setLocale }),
		[locale, setLocale],
	);

	return (
		<I18nContext.Provider value={value}>
			<IntlProvider
				locale={locale}
				messages={catalogFor(locale)}
				timeZone={TIME_ZONE}
				onError={(error) => {
					// Never swallow: missing/garbled messages must be visible.
					// The check:messages script is the build-time guard for gaps.
					console.error(`[i18n:${error.code}] ${error.message}`);
				}}
			>
				{children}
			</IntlProvider>
		</I18nContext.Provider>
	);
}

/** Persisted locale setter. */
export function useSetLocale() {
	const context = useContext(I18nContext);
	if (!context) {
		throw new Error("useSetLocale must be used within an I18nProvider.");
	}
	return context.setLocale;
}
