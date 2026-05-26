# Operational Control: UX Standardization & i18n Management Runbook

This operational guide outlines the localization structure, coding rules, and styling standards for maintaining a unified user experience (UX) and multi-language support (English/Swahili) in NEXPOS.

---

## 1. i18n System Architecture & Coding Rules

All UI text visible to the end-user must flow through the central translation provider.

### Rule 1: No Hardcoded JSX Text
Never write raw text nodes inside JSX tags.
- **Incorrect:** `<span>Save changes</span>`
- **Correct:** `<span>{t('common.save')}</span>`

### Rule 2: No Hardcoded Attributes
Never write hardcoded string values for attributes like `placeholder`, `label`, or `title`.
- **Incorrect:** `<input placeholder="Enter name" />`
- **Correct:** `<input placeholder={t('common.name')} />`

### Rule 3: Use Dotted Paths
Translation keys in the `t()` function must use dotted syntax matching the structures in `/locales/en/index.ts` and `/locales/sw/index.ts`.
- **Example:** `t('settings.tabs.general')`

---

## 2. Dynamic Language Switching & State Persistence

Language state is synchronized across the client and the server:
1. **Client-Side:** When a user selects a language in the General settings panel:
   - `setLanguage('sw')` (or `'en'`) is invoked from the `useTranslations` hook.
   - The value is stored in `localStorage` under `nx_lang`.
   - A cookie `nx_lang` is updated with a 365-day expiration.
   - A `Telemetry.trackLanguageChange` log is recorded in the local logs buffer.
2. **Server-Side:** Next.js root layout reads the `nx_lang` cookie at request time and pre-renders the page with the appropriate language. This prevents flashing of mixed languages during client hydration.

---

## 3. Extending Translations (Adding Keys)

To add new keys:
1. Open [locales/en/index.ts](file:///c:/Users/wise_gtr/Desktop/Demo%20Websites/NEXPOS/locales/en/index.ts) and add the key to the appropriate section:
   ```typescript
   export const en = {
     common: {
       newKey: "New Key Label"
     }
   };
   ```
2. Open [locales/sw/index.ts](file:///c:/Users/wise_gtr/Desktop/Demo%20Websites/NEXPOS/locales/sw/index.ts) and add the identical key:
   ```typescript
   export const sw: TranslationType = {
     common: {
       newKey: "Lebo Mpya ya Ufunguo"
     }
   };
   ```
3. Run the integrity scanner to verify:
   ```bash
   npx tsx scripts/check-translations.ts
   ```

---

## 4. UX & Styling Standards

All operational settings panels and control centers must follow the NEXPOS unified dark theme:
* **Spacing:** Use tailwind utility margins/paddings or class values matching standard 6-hour spacing models (`p-6` card padding, `space-y-4` form row separation).
* **Typography:** Display titles must use `font-display` and `text-nx-text`. Standard tags should use `text-nx-text-sec` for muted/secondary descriptions.
* **Cards & Forms:** Wrap interactive groups inside `bg-nx-elevated/40 border border-nx-border p-4 rounded-nx-card` panels.
* **Focus States:** Input components must use: `focus:outline-none focus:border-nx-cyan` for focus indicator colors.
