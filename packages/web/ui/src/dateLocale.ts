import type { Locale } from "date-fns";
import bg from "date-fns/locale/bg";
import de from "date-fns/locale/de";
import enGB from "date-fns/locale/en-GB";
import enUS from "date-fns/locale/en-US";
import es from "date-fns/locale/es";
import fr from "date-fns/locale/fr";
import it from "date-fns/locale/it";
import pl from "date-fns/locale/pl";
import ptBR from "date-fns/locale/pt-BR";
import ru from "date-fns/locale/ru";

/**
 * Map BCP 47 language tag (lowercased) to a date-fns locale. Keys are stored
 * lowercase so lookup is case-insensitive; both primary tags (`"de"`) and
 * region tags (`"de-de"`) resolve. Drives date-format localization such as
 * US vs European vs Bulgarian ordering.
 */
const LOCALE_BY_TAG: Record<string, Locale> = {
	en: enUS,
	"en-us": enUS,
	"en-gb": enGB,
	bg: bg,
	"bg-bg": bg,
	de: de,
	"de-de": de,
	"de-at": de,
	fr: fr,
	"fr-fr": fr,
	es: es,
	"es-es": es,
	it: it,
	"it-it": it,
	pl: pl,
	"pl-pl": pl,
	"pt-br": ptBR,
	ru: ru,
	"ru-ru": ru,
};

const DEFAULT_LOCALE = enUS;

/**
 * Resolve a date-fns locale for a BCP 47 language tag (e.g. `navigator.language`).
 * Falls back from the full tag to its primary subtag to `en-US`. Suitable as the
 * `adapterLocale` of a MUI `LocalizationProvider`.
 */
export function getDateFnsLocaleForLanguageTag(languageTag: string): Locale {
	const normalized = languageTag.trim().toLowerCase();
	const primary = normalized.split("-")[0] ?? "";
	return LOCALE_BY_TAG[normalized] ?? LOCALE_BY_TAG[primary] ?? DEFAULT_LOCALE;
}

/**
 * Resolve the date-fns locale for the current browser/document language, falling
 * back to `en-US`. Safe to call outside a browser (returns the default).
 */
export function getBrowserDateFnsLocale(): Locale {
	if (typeof navigator !== "undefined" && navigator.language) {
		return getDateFnsLocaleForLanguageTag(navigator.language);
	}
	if (typeof document !== "undefined" && document.documentElement?.lang) {
		return getDateFnsLocaleForLanguageTag(document.documentElement.lang);
	}
	return DEFAULT_LOCALE;
}
