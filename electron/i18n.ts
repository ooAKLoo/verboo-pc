/**
 * Main process i18n module
 * Provides translation functionality for native menus and dialogs
 */

export type Locale = 'zh' | 'en';

// Locale data for main process (context menus, native dialogs)
const locales: Record<Locale, Record<string, string>> = {
  zh: {
    'contextMenu.saveAsset': '📥 保存素材',
    'contextMenu.openInNewTab': '在新标签页中打开链接',
  },
  en: {
    'contextMenu.saveAsset': '📥 Save to Library',
    'contextMenu.openInNewTab': 'Open Link in New Tab',
  },
};

// Current locale state
let currentLocale: Locale = 'zh';

/**
 * Set the current locale
 */
export function setLocale(locale: Locale): void {
  currentLocale = locale;
  console.log('[i18n] Locale set to:', locale);
}

/**
 * Get the current locale
 */
export function getLocale(): Locale {
  return currentLocale;
}

/**
 * Translate a key
 * Returns the key itself if translation not found (no default fallback)
 */
export function t(key: string): string {
  const translation = locales[currentLocale][key];
  if (translation === undefined) {
    // Return key for easy debugging - no silent fallback
    return key;
  }
  return translation;
}

/**
 * Load locale from storage (called on app startup)
 */
export function loadLocaleFromStorage(): void {
  try {
    // Try to read from a simple file-based storage
    const fs = require('fs');
    const path = require('path');
    const { app } = require('electron');

    const configPath = path.join(app.getPath('userData'), 'locale.txt');
    if (fs.existsSync(configPath)) {
      const saved = fs.readFileSync(configPath, 'utf-8').trim();
      if (saved === 'zh' || saved === 'en') {
        currentLocale = saved;
        console.log('[i18n] Loaded locale from storage:', currentLocale);
      }
    }
  } catch (error) {
    console.error('[i18n] Failed to load locale from storage:', error);
  }
}

/**
 * Save locale to storage
 */
export function saveLocaleToStorage(locale: Locale): void {
  try {
    const fs = require('fs');
    const path = require('path');
    const { app } = require('electron');

    const configPath = path.join(app.getPath('userData'), 'locale.txt');
    fs.writeFileSync(configPath, locale, 'utf-8');
    console.log('[i18n] Saved locale to storage:', locale);
  } catch (error) {
    console.error('[i18n] Failed to save locale to storage:', error);
  }
}
