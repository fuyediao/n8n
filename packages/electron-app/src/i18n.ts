import fs from 'fs';
import path from 'path';

type Translations = Record<string, unknown>;

let translations: Translations = {};
let currentLocale = 'en';

/**
 * Load translation file
 */
function loadTranslations(locale: string): Translations {
	// Default to 'en' if locale file doesn't exist
	const targetLocale = locale === 'en' ? 'en' : 'en';

	try {
		// Try to load from @n8n/i18n package dist
		const i18nPackagePath = require.resolve(`@n8n/i18n/dist/locales/${targetLocale}.json`);
		const translationFile = fs.readFileSync(i18nPackagePath, 'utf-8');
		return JSON.parse(translationFile);
	} catch {
		// Fallback: try relative path to source
		try {
			const fallbackPath = path.join(
				__dirname,
				`../../frontend/@n8n/i18n/src/locales/${targetLocale}.json`,
			);
			const translationFile = fs.readFileSync(fallbackPath, 'utf-8');
			return JSON.parse(translationFile);
		} catch {
			// Return empty object if can't load
			console.warn(`Failed to load translations for locale: ${locale}, using English fallback`);
			return {};
		}
	}
}

/**
 * Get translation by key path (e.g., 'generic.loading' or 'generic.error')
 */
function getTranslation(key: string, fallback?: string): string {
	const keys = key.split('.');
	let value: any = translations;

	for (const k of keys) {
		if (value && typeof value === 'object' && k in value) {
			value = value[k];
		} else {
			return fallback || key;
		}
	}

	return typeof value === 'string' ? value : fallback || key;
}

/**
 * Initialize i18n
 */
export function initI18n(locale = 'en'): void {
	currentLocale = locale;
	translations = loadTranslations(locale);
}

// Electron-specific translations (fallback if not in main i18n)
const electronTranslations: Record<string, string> = {
	'app.starting': 'Starting n8n...',
	'app.startingDescription': 'Please wait, the server is starting',
	'app.error': 'Failed to start n8n server',
	'app.errorDescription': 'Please check the console logs for details',
	'app.errorAfterAttempts': 'Failed to start n8n server after {attempts} attempts',
};

/**
 * Get translation with electron-specific fallbacks and parameter interpolation
 */
export function t(
	key: string,
	fallback?: string,
	params?: Record<string, string | number>,
): string {
	if (Object.keys(translations).length === 0) {
		initI18n();
	}

	// Try to get from main i18n, fallback to electron translations, then to provided fallback
	const electronFallback = electronTranslations[key] || fallback;
	let result = getTranslation(key, electronFallback || key);

	// Simple parameter interpolation
	if (params) {
		for (const [paramKey, paramValue] of Object.entries(params)) {
			result = result.replace(`{${paramKey}}`, String(paramValue));
		}
	}

	return result;
}
