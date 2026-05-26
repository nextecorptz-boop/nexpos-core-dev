'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { en } from '@/locales/en';
import { sw } from '@/locales/sw';

export type Language = 'en' | 'sw';

interface I18nContextProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (path: string, variables?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextProps | undefined>(undefined);

export function I18nProvider({
  children,
  initialLanguage = 'en'
}: {
  children: React.ReactNode;
  initialLanguage?: Language;
}) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  useEffect(() => {
    // Sync with localStorage on client mount if available
    const localLang = localStorage.getItem('nx_lang') as Language;
    if (localLang && localLang !== language && (localLang === 'en' || localLang === 'sw')) {
      setLanguageState(localLang);
    }
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('nx_lang', lang);
    
    // Set cookie valid for 365 days
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 1);
    document.cookie = `nx_lang=${lang}; expires=${expiry.toUTCString()}; path=/; SameSite=Lax`;
  };

  const t = (path: string, variables?: Record<string, string | number>): string => {
    const dictionary = language === 'sw' ? sw : en;
    const parts = path.split('.');
    let current: any = dictionary;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        // Fallback to English lookup
        let fallback: any = en;
        for (const fbPart of parts) {
          if (fallback && typeof fallback === 'object' && fbPart in fallback) {
            fallback = fallback[fbPart];
          } else {
            fallback = path;
            break;
          }
        }
        current = fallback;
        break;
      }
    }

    if (typeof current !== 'string') {
      // Log translation mismatch to local telemetry logs
      import('@/lib/telemetry/telemetry').then(({ Telemetry }) => {
        Telemetry.trackTranslationMismatch(path, language);
      }).catch(err => console.warn('Failed to load telemetry inside i18n:', err));

      return path;
    }

    let result = current;
    if (variables) {
      Object.entries(variables).forEach(([key, val]) => {
        result = result.replace(new RegExp(`{${key}}`, 'g'), String(val));
      });
    }

    return result;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
