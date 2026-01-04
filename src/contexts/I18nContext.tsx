import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import zhLocale from '../locales/zh.json';
import enLocale from '../locales/en.json';

// ============ Types ============

export type Locale = 'zh' | 'en';

type LocaleData = typeof zhLocale;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

// ============ Constants ============

const LOCALE_STORAGE_KEY = 'verboo-locale';

const locales: Record<Locale, LocaleData> = {
  zh: zhLocale,
  en: enLocale as LocaleData,
};

// ============ Context ============

const I18nContext = createContext<I18nContextValue | null>(null);

// ============ Helper ============

/**
 * Get nested value from object by dot-notation key
 * Returns the key itself if not found (no default fallback)
 */
function getNestedValue(obj: Record<string, unknown>, key: string): string {
  const keys = key.split('.');
  let current: unknown = obj;

  for (const k of keys) {
    if (current && typeof current === 'object' && k in current) {
      current = (current as Record<string, unknown>)[k];
    } else {
      // Key not found - return the key itself for easy debugging
      return key;
    }
  }

  if (typeof current === 'string') {
    return current;
  }

  // Not a string value - return key for debugging
  return key;
}

// ============ Provider ============

interface I18nProviderProps {
  children: ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    // Read from localStorage on init
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (saved === 'zh' || saved === 'en') {
        return saved;
      }
    }
    return 'zh'; // Default to Chinese
  });

  // Persist locale to localStorage
  useEffect(() => {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    // Notify main process for context menu updates
    const { ipcRenderer } = window.require('electron');
    ipcRenderer.invoke('set-locale', newLocale).catch(console.error);
  }, []);

  const t = useCallback((key: string): string => {
    return getNestedValue(locales[locale] as Record<string, unknown>, key);
  }, [locale]);

  const value: I18nContextValue = {
    locale,
    setLocale,
    t,
  };

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

// ============ Hook ============

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
}

// ============ Utility for Main Process ============

/**
 * Get translation function for main process
 * This is a standalone function that doesn't rely on React context
 */
export function createTranslator(locale: Locale) {
  return (key: string): string => {
    return getNestedValue(locales[locale] as Record<string, unknown>, key);
  };
}
