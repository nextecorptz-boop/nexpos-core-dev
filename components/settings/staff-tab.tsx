'use client';

import React from 'react';
import { Users, Lock } from 'lucide-react';

interface StaffTabProps {
  staffList: any[];
  t: (k: string) => string;
}

export default function StaffTab({
  staffList,
  t
}: StaffTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="font-bold text-[13.5px] text-nx-text flex items-center gap-2">
            <Users className="w-4.5 h-4.5 text-nx-cyan" />
            {t('settings.staff.title')}
          </h3>
          <p className="text-[10px] text-nx-text-sec mt-0.5">
            {t('settings.staff.subtitle')}
          </p>
        </div>
        
        <button
          disabled
          className="py-1.5 px-3 bg-nx-elevated/50 text-nx-text-muted border border-nx-border rounded font-bold text-[11px] cursor-not-allowed flex items-center gap-1.5"
        >
          <Lock className="w-3 h-3" />
          {t('settings.staff.addStaff')}
        </button>
      </div>

      <div className="border border-nx-border rounded-nx-card overflow-x-auto">
        <table className="w-full text-[11px] text-left border-collapse select-text">
          <thead>
            <tr className="bg-nx-elevated text-nx-text-sec font-bold border-b border-nx-border">
              <th className="p-2.5">{t('common.name')}</th>
              <th className="p-2.5">{t('common.email')}</th>
              <th className="p-2.5">{t('common.role')}</th>
              <th className="p-2.5">{t('settings.staff.branchAccess')}</th>
              <th className="p-2.5">{t('common.status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-nx-border/50">
            {/* Simulated Owner Scope profile first */}
            <tr className="hover:bg-nx-elevated/40">
              <td className="p-2.5 font-semibold text-nx-text">{t('settings.staff.ownerName')}</td>
              <td className="p-2.5 text-nx-text-sec">owner@nexpos.co.tz</td>
              <td className="p-2.5 font-bold text-nx-cyan">{t('settings.staff.roles.owner')}</td>
              <td className="p-2.5 text-nx-text-sec">{t('settings.staff.allBranches')}</td>
              <td className="p-2.5">
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-nx-green/10 text-nx-green border border-nx-green/20">
                  {t('common.active')}
                </span>
              </td>
            </tr>

            {/* Staff profiles */}
            {staffList.map((staff) => (
              <tr key={staff.id} className="hover:bg-nx-elevated/40">
                <td className="p-2.5 font-semibold text-nx-text">{staff.name}</td>
                <td className="p-2.5 text-nx-text-sec">{staff.email}</td>
                <td className="p-2.5 text-nx-text capitalize">
                  {t(`settings.staff.roles.${staff.role as 'manager' | 'cashier'}`)}
                </td>
                <td className="p-2.5 text-nx-text-sec">{staff.branch}</td>
                <td className="p-2.5">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                    staff.active ? 'bg-nx-green/10 text-nx-green border border-nx-green/20' : 'bg-nx-border text-nx-text-muted'
                  }`}>
                    {staff.active ? t('common.active') : t('common.inactive')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Terminal Authorization details */}
      <div className="bg-nx-elevated/20 border border-nx-border p-4 rounded-nx-card space-y-2">
        <h4 className="font-bold text-[12px] text-nx-text">{t('settings.staff.deviceAuth')}</h4>
        <p className="text-[10px] text-nx-text-sec leading-relaxed">
          Staff roles are restricted dynamically. Owners hold full SaaS system controls; Managers manage local catalogs, inventory requisitions, and cash till overrides; Cashiers can only perform POS sales transactions.
        </p>
      </div>
    </div>
  );
}
