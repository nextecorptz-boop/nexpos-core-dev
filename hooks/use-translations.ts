'use client';

import { useI18n } from '@/lib/i18n/i18n-provider';

export function useTranslations() {
  const { t, language, setLanguage } = useI18n();
  return { t, language, setLanguage };
}
