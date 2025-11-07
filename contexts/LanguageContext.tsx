'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import fr from '@/locales/fr.json';
import en from '@/locales/en.json';

export type Language = 'fr' | 'en';

type TranslationVariables = Record<string, string | number>;

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, fallback?: string, variables?: TranslationVariables) => string;
  choose: <T>(options: Record<Language, T>) => T;
}

const STORAGE_KEY = 'cyberscan-language';

const translations: Record<Language, Record<string, unknown>> = {
  fr,
  en,
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const getNestedValue = (obj: Record<string, unknown>, path: string): unknown => {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('fr');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'fr' || stored === 'en') {
      setLanguageState(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, language);
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  const translate = useCallback(
    (key: string, fallback?: string, variables?: TranslationVariables) => {
      const value = getNestedValue(translations[language], key);
      const resolved = typeof value === 'string' ? value : fallback ?? key;
      if (!variables) {
        return resolved;
      }
      return Object.keys(variables).reduce((acc, variableKey) => {
        return acc.replace(new RegExp(`{{\\s*${variableKey}\\s*}}`, 'g'), String(variables[variableKey]));
      }, resolved);
    },
    [language]
  );

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
  }, []);

  const choose = useCallback(
    <T,>(options: Record<Language, T>): T => {
      return options[language];
    },
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: translate,
      choose,
    }),
    [language, setLanguage, translate, choose]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
