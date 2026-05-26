'use client';

import React from 'react';
import { Globe, Database, CheckCircle } from 'lucide-react';

interface GeneralTabProps {
  branchName: string;
  setBranchName: (v: string) => void;
  timezone: string;
  setTimezone: (v: string) => void;
  currency: string;
  language: 'en' | 'sw';
  handleLanguageToggle: (l: 'en' | 'sw') => void;
  receiptHeader: string;
  setReceiptHeader: (v: string) => void;
  receiptFooter: string;
  setReceiptFooter: (v: string) => void;
  saveLoading: boolean;
  successMsg: string;
  handleSaveGeneral: (e: React.FormEvent) => void;
  t: (k: string) => string;
}

export default function GeneralTab({
  branchName,
  setBranchName,
  timezone,
  setTimezone,
  currency,
  language,
  handleLanguageToggle,
  receiptHeader,
  setReceiptHeader,
  receiptFooter,
  setReceiptFooter,
  saveLoading,
  successMsg,
  handleSaveGeneral,
  t
}: GeneralTabProps) {
  return (
    <form onSubmit={handleSaveGeneral} className="space-y-6 max-w-2xl">
      <div className="space-y-4">
        <h3 className="font-bold text-[13.5px] text-nx-text border-b border-nx-border/40 pb-2 flex items-center gap-2">
          <Globe className="w-4 h-4 text-nx-cyan" />
          {t('settings.general.branchInfo')}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-nx-text-sec uppercase">{t('settings.general.branchName')}</label>
            <input
              type="text"
              required
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              className="bg-nx-elevated border border-nx-border rounded px-3 py-2 text-[12.5px] focus:outline-none focus:border-nx-cyan"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-nx-text-sec uppercase">{t('settings.general.timezone')}</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="bg-nx-elevated border border-nx-border rounded px-3 py-2 text-[12.5px] focus:outline-none focus:border-nx-cyan"
            >
              <option value="Africa/Dar_es_Salaam">Africa/Dar_es_Salaam (EAT)</option>
              <option value="Africa/Nairobi">Africa/Nairobi (EAT)</option>
              <option value="Africa/Kigali">Africa/Kigali (CAT)</option>
              <option value="UTC">Coordinated Universal Time (UTC)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-nx-text-sec uppercase">{t('settings.general.currency')}</label>
            <input
              type="text"
              disabled
              value={currency}
              className="bg-nx-elevated/40 border border-nx-border/60 text-nx-text-muted rounded px-3 py-2 text-[12.5px] cursor-not-allowed"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-nx-text-sec uppercase">{t('settings.general.language')}</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleLanguageToggle('en')}
                className={`flex-1 py-2 text-[12px] font-bold border rounded transition-colors ${
                  language === 'en' ? 'bg-nx-cyan text-white border-nx-cyan' : 'border-nx-border text-nx-text hover:bg-nx-elevated'
                }`}
              >
                English (EN)
              </button>
              <button
                type="button"
                onClick={() => handleLanguageToggle('sw')}
                className={`flex-1 py-2 text-[12px] font-bold border rounded transition-colors ${
                  language === 'sw' ? 'bg-nx-cyan text-white border-nx-cyan' : 'border-nx-border text-nx-text hover:bg-nx-elevated'
                }`}
              >
                Kiswahili (SW)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Receipt Settings */}
      <div className="space-y-4 pt-4">
        <h3 className="font-bold text-[13.5px] text-nx-text border-b border-nx-border/40 pb-2 flex items-center gap-2">
          <Database className="w-4 h-4 text-nx-cyan" />
          {t('settings.general.receiptSettings')}
        </h3>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-nx-text-sec uppercase">{t('settings.general.receiptHeader')}</label>
          <input
            type="text"
            value={receiptHeader}
            onChange={(e) => setReceiptHeader(e.target.value)}
            className="bg-nx-elevated border border-nx-border rounded px-3 py-2 text-[12.5px] focus:outline-none focus:border-nx-cyan"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-nx-text-sec uppercase">{t('settings.general.receiptFooter')}</label>
          <textarea
            rows={2}
            value={receiptFooter}
            onChange={(e) => setReceiptFooter(e.target.value)}
            className="bg-nx-elevated border border-nx-border rounded px-3 py-2 text-[12.5px] focus:outline-none focus:border-nx-cyan resize-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-4 pt-4">
        <button
          type="submit"
          disabled={saveLoading}
          className="btn-primary px-6 py-2 text-[12.5px]"
        >
          {saveLoading ? t('common.loading') : t('common.save')}
        </button>
        
        {successMsg && (
          <span className="text-[12px] font-semibold text-nx-green flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4" />
            {successMsg}
          </span>
        )}
      </div>
    </form>
  );
}
