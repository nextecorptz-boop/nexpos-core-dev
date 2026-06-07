'use client'

import React, { useState, useTransition, useMemo } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Play,
  ShieldCheck,
  LockKeyhole,
} from 'lucide-react'
import { openTill, closeTill, reviewTillSession, type TillSession } from '@/lib/actions/till'

type Me = {
  id: string
  full_name: string | null
  email: string | null
  role: 'owner' | 'manager' | 'cashier'
  tenant_id: string
  branch_id: string | null
}

type Branch = {
  id: string
  name: string
}

interface TillContainerProps {
  me: Me
  isPrivileged: boolean
  workingBranchId: string | null
  branches: Branch[]
  branchesError: string | null
  sessions: TillSession[]
  cashierNames: Record<string, string>
}

const tzs = (val: number | null | undefined) => {
  if (val === null || val === undefined) return '—'
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    minimumFractionDigits: 0,
  }).format(Number(val))
}

const fmtDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-TZ', { hour12: false }) : '—'

export function TillContainer({
  me,
  isPrivileged,
  workingBranchId,
  branches,
  branchesError,
  sessions: initialSessions,
  cashierNames,
}: TillContainerProps) {
  const [sessions, setSessions] = useState<TillSession[]>(initialSessions)
  // selectedBranchId: owner/manager pick from the branch selector; cashier uses workingBranchId
  const [selectedBranchId, setSelectedBranchId] = useState<string>(workingBranchId ?? '')
  const [openingFloat, setOpeningFloat] = useState('')
  const [counted, setCounted] = useState('')
  const [closeNotes, setCloseNotes] = useState('')
  const [reviewNotesById, setReviewNotesById] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // canOpen: privileged users need a branch selected; cashiers need an assigned branch
  const canOpen = isPrivileged
    ? selectedBranchId !== '' && branches.length > 0
    : Boolean(me.branch_id)

  const myOpenSession = useMemo(
    () => sessions.find((s) => s.status === 'open' && s.cashier_id === me.id) ?? null,
    [sessions, me.id]
  )

  const reviewQueue = useMemo(
    () =>
      isPrivileged
        ? sessions.filter((s) => s.status === 'disputed' && s.owner_reviewed_at === null)
        : [],
    [sessions, isPrivileged]
  )

  const upsertSession = (next: TillSession) => {
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === next.id)
      if (idx === -1) return [next, ...prev]
      const copy = [...prev]
      copy[idx] = next
      return copy
    })
  }

  const handleOpen = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const branchId = isPrivileged ? selectedBranchId : (me.branch_id ?? '')
    if (!branchId) {
      setError(
        isPrivileged
          ? 'Please select a branch to open a till.'
          : 'No branch is assigned to your profile.'
      )
      return
    }
    const floatNum = Number(openingFloat)
    if (Number.isNaN(floatNum) || floatNum < 0) {
      setError('Opening float must be 0 or greater.')
      return
    }
    startTransition(async () => {
      const res = await openTill({ branchId, openingFloat: floatNum })
      if (res.ok === false) {
        setError(res.message)
        return
      }
      upsertSession(res.data)
      setOpeningFloat('')
    })
  }

  const handleClose = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!myOpenSession) return
    const actual = Number(counted)
    if (Number.isNaN(actual) || actual < 0) {
      setError('Counted cash must be 0 or greater.')
      return
    }
    startTransition(async () => {
      const res = await closeTill({
        sessionId: myOpenSession.id,
        actualCashCounted: actual,
        closeMode: 'normal',
        notes: closeNotes.trim() || null,
      })
      if (res.ok === false) {
        setError(res.message)
        return
      }
      upsertSession(res.data)
      setCounted('')
      setCloseNotes('')
    })
  }

  const handleReview = (sessionId: string) => {
    setError(null)
    const notes = reviewNotesById[sessionId]?.trim() || null
    startTransition(async () => {
      const res = await reviewTillSession({ sessionId, decision: 'accept', notes })
      if (res.ok === false) {
        setError(res.message)
        return
      }
      upsertSession(res.data)
      setReviewNotesById((prev) => {
        const copy = { ...prev }
        delete copy[sessionId]
        return copy
      })
    })
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 lg:px-6 pb-12 flex flex-col gap-6 font-ui">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-6 select-none">
        <div>
          <h1 className="text-[22px] font-bold text-nx-text leading-[1.3] mb-1">Till</h1>
          <p className="text-nx-text-sec text-[12px]">
            Cash drawer reconciliation and shift summary
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-nx-text-muted">
          <span className="px-2 py-1 rounded bg-nx-elevated border border-nx-border font-data">
            {me.role.toUpperCase()}
          </span>
        </div>
      </div>

      {/* G1.1 limitation banner */}
      <div className="flex items-start gap-3 bg-nx-amber/5 border border-nx-amber/20 rounded-nx-card px-5 py-4">
        <AlertTriangle className="w-5 h-5 text-nx-amber flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-ui text-[13px] font-semibold text-nx-amber">
            Opening Float Only
          </p>
          <p className="text-[12px] text-nx-text-muted leading-relaxed">
            Cash sale linkage activates in G1.2. Until then, expected cash equals the
            opening float and any non-zero difference at close is an{' '}
            <span className="font-semibold text-nx-text-sec">Unreconciled Difference</span>,
            not final drawer variance.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-nx-red/10 border border-nx-red/30 rounded-nx-card px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-nx-red flex-shrink-0 mt-0.5" />
          <p className="text-[12.5px] text-nx-red">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {myOpenSession ? (
            <OpenSessionPanel
              session={myOpenSession}
              counted={counted}
              onCounted={setCounted}
              closeNotes={closeNotes}
              onCloseNotes={setCloseNotes}
              onSubmit={handleClose}
              isPending={isPending}
            />
          ) : (
            <OpenTillForm
              openingFloat={openingFloat}
              onOpeningFloat={setOpeningFloat}
              onSubmit={handleOpen}
              isPending={isPending}
              canOpen={canOpen}
              isPrivileged={isPrivileged}
              branches={branches}
              branchesError={branchesError}
              selectedBranchId={selectedBranchId}
              onSelectBranch={setSelectedBranchId}
              cashierHasBranch={Boolean(me.branch_id)}
            />
          )}

          {/* Review queue (owner/manager only) */}
          {isPrivileged && reviewQueue.length > 0 && (
            <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-nx-amber" />
                <h3 className="font-bold text-[14px] text-nx-text">Review queue</h3>
                <span className="text-[11px] text-nx-text-muted">
                  ({reviewQueue.length} disputed)
                </span>
              </div>
              <p className="text-[12px] text-nx-text-muted leading-relaxed">
                G1.1 compares counted cash against opening float only. Accepting closes the
                session as reviewed; reopen lands in G1.2.
              </p>
              <ul className="divide-y divide-nx-border/50">
                {reviewQueue.map((s) => (
                  <li key={s.id} className="py-3 flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
                      <div className="text-nx-text">
                        <span className="font-semibold">
                          {cashierNames[s.cashier_id] ?? 'Operator'}
                        </span>
                        <span className="text-nx-text-sec"> · {fmtDateTime(s.closed_at)}</span>
                      </div>
                      <div className="font-data text-nx-red">
                        {tzs(s.variance)} unreconciled
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        placeholder="Review notes (optional)"
                        value={reviewNotesById[s.id] ?? ''}
                        onChange={(e) =>
                          setReviewNotesById((prev) => ({ ...prev, [s.id]: e.target.value }))
                        }
                        className="flex-1 bg-nx-elevated border border-nx-border text-nx-text text-[12.5px] px-3 py-2 rounded-nx-btn focus:outline-none focus:border-nx-green"
                      />
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleReview(s.id)}
                        className="bg-nx-green hover:bg-nx-green/90 disabled:opacity-60 text-black font-semibold text-[12.5px] px-4 py-2 rounded-nx-btn flex items-center gap-1.5"
                      >
                        {isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        Accept
                      </button>
                    </div>
                    {s.notes && (
                      <p className="text-[11.5px] text-nx-text-muted italic">
                        Cashier notes: {s.notes}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recent sessions */}
          <RecentSessionsTable sessions={sessions} cashierNames={cashierNames} />
        </div>

        {/* Sidebar */}
        <aside className="bg-nx-surface border border-nx-border rounded-nx-card p-5 space-y-4 select-none">
          <div className="flex items-center gap-2 text-nx-green">
            <ShieldCheck className="w-5 h-5" />
            <h3 className="font-bold text-[14px] text-nx-text">Shift reconciliation</h3>
          </div>
          <div className="space-y-3 text-[12.5px] leading-relaxed text-nx-text-sec">
            <p>
              In G1.1, expected cash is the opening float and variance is the unreconciled
              difference between counted cash and that float.
            </p>
            <div className="p-3 bg-nx-elevated/40 border border-nx-border/50 rounded-nx-card text-[11.5px] font-mono space-y-1">
              <p className="font-bold text-nx-text">Close math (G1.1)</p>
              <p>expected_cash = opening_float</p>
              <p>variance = counted − expected_cash</p>
              <p className="text-nx-amber">
                variance ≠ 0 → status = disputed (review required)
              </p>
            </div>
            <p className="text-[11.5px] italic">
              This is not final drawer variance until cash sales are linked in G1.2.
              All open / close / review events are written to the audit log.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────────

function OpenTillForm({
  openingFloat,
  onOpeningFloat,
  onSubmit,
  isPending,
  canOpen,
  isPrivileged,
  branches,
  branchesError,
  selectedBranchId,
  onSelectBranch,
  cashierHasBranch,
}: {
  openingFloat: string
  onOpeningFloat: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  isPending: boolean
  canOpen: boolean
  isPrivileged: boolean
  branches: Branch[]
  branchesError: string | null
  selectedBranchId: string
  onSelectBranch: (id: string) => void
  cashierHasBranch: boolean
}) {
  return (
    <div className="bg-nx-surface border border-nx-border rounded-nx-card p-6 space-y-4">
      <div className="flex items-start gap-3 select-none">
        <div className="w-10 h-10 rounded-full bg-nx-green/10 flex items-center justify-center text-nx-green shrink-0">
          <Play className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-[15px] text-nx-text">No active till session</h3>
          <p className="text-[12px] text-nx-text-sec">
            {isPrivileged
              ? 'Choose a branch and enter the starting cash float to open a drawer session.'
              : 'Enter the starting cash float to open a new drawer session.'}
          </p>
        </div>
      </div>

      {/* Branch selector — owner/manager with available branches */}
      {isPrivileged && branches.length > 0 && (
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-nx-text-muted uppercase tracking-wider">
            Branch *
          </label>
          <select
            required
            value={selectedBranchId}
            onChange={(e) => onSelectBranch(e.target.value)}
            className="w-full bg-nx-elevated border border-nx-border text-nx-text text-[13px] px-3 py-2.5 rounded-nx-btn focus:outline-none focus:border-nx-green cursor-pointer"
          >
            <option value="">Choose a branch to open a till session</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Owner/manager but no active branches configured (or RLS hid them) */}
      {isPrivileged && branches.length === 0 && (
        <div className="flex items-start gap-2 bg-nx-amber/5 border border-nx-amber/20 rounded-nx-card px-3 py-2">
          <LockKeyhole className="w-4 h-4 text-nx-amber flex-shrink-0 mt-0.5" />
          <p className="text-[12px] text-nx-amber">
            {branchesError ?? 'No active branches found. Activate a branch in branch settings first.'}
          </p>
        </div>
      )}

      {/* Cashier with no assigned branch */}
      {!isPrivileged && !cashierHasBranch && (
        <div className="flex items-start gap-2 bg-nx-amber/5 border border-nx-amber/20 rounded-nx-card px-3 py-2">
          <LockKeyhole className="w-4 h-4 text-nx-amber flex-shrink-0 mt-0.5" />
          <p className="text-[12px] text-nx-amber">
            No branch is assigned to your profile. Ask an owner to assign a branch first.
          </p>
        </div>
      )}

      <form onSubmit={onSubmit} className="flex flex-col sm:flex-row items-end gap-4 pt-2">
        <div className="space-y-1 flex-1 w-full">
          <label className="text-[11px] font-bold text-nx-text-muted uppercase tracking-wider">
            Opening Float *
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-data font-bold text-nx-text-sec text-[13px]">
              TSh
            </span>
            <input
              type="number"
              required
              min={0}
              step="1"
              inputMode="numeric"
              value={openingFloat}
              onChange={(e) => onOpeningFloat(e.target.value)}
              placeholder="e.g. 100000"
              className="w-full bg-nx-elevated border border-nx-border text-nx-text font-data text-[13px] pl-12 pr-3 py-2.5 rounded-nx-btn focus:outline-none focus:border-nx-green tabular-nums"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={isPending || !canOpen}
          className="bg-nx-green hover:bg-nx-green/90 disabled:opacity-60 text-black font-semibold text-[13px] px-6 py-3 rounded-nx-btn flex items-center justify-center gap-2"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Opening…
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Open Till
            </>
          )}
        </button>
      </form>
    </div>
  )
}

function OpenSessionPanel({
  session,
  counted,
  onCounted,
  closeNotes,
  onCloseNotes,
  onSubmit,
  isPending,
}: {
  session: TillSession
  counted: string
  onCounted: (v: string) => void
  closeNotes: string
  onCloseNotes: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  isPending: boolean
}) {
  const opening = Number(session.opening_float)
  const counted_n = counted === '' ? null : Number(counted)
  const previewDiff = counted_n === null || Number.isNaN(counted_n) ? null : counted_n - opening

  return (
    <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5 space-y-6">
      <div className="flex items-center justify-between border-b border-nx-border pb-4 select-none">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-nx-green animate-pulse" />
          <div>
            <h3 className="font-bold text-[14px] text-nx-text">Till session open</h3>
            <p className="text-[11px] text-nx-text-sec">
              Opened {fmtDateTime(session.opened_at)}
            </p>
          </div>
        </div>
        <span className="text-[11px] font-data text-nx-text-muted">{session.id.slice(-8)}</span>
      </div>

      {/* Balances */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="Opening Float" value={tzs(opening)} />
        <Stat
          label="Opening Float Only"
          value={tzs(opening)}
          hint="Cash sale linkage activates in G1.2."
        />
        <Stat
          label="Unreconciled Difference (preview)"
          value={previewDiff === null ? '—' : tzs(previewDiff)}
          tone={
            previewDiff === null || previewDiff === 0
              ? 'neutral'
              : previewDiff > 0
                ? 'amber'
                : 'red'
          }
          hint="G1.1 compares counted cash against opening float only."
        />
      </div>

      {/* Close form */}
      <form onSubmit={onSubmit} className="space-y-4 pt-1">
        <h4 className="font-bold text-[12px] text-nx-text-muted uppercase tracking-wider select-none">
          Close &amp; reconcile
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-nx-text-muted uppercase tracking-wider">
              Counted cash in drawer *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-data font-bold text-nx-text-sec text-[13px]">
                TSh
              </span>
              <input
                type="number"
                required
                min={0}
                step="1"
                inputMode="numeric"
                value={counted}
                onChange={(e) => onCounted(e.target.value)}
                placeholder="Counted physical cash"
                className="w-full bg-nx-elevated border border-nx-border text-nx-text font-data text-[13px] pl-12 pr-3 py-2.5 rounded-nx-btn focus:outline-none focus:border-nx-green tabular-nums"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-nx-text-muted uppercase tracking-wider">
              Notes (optional)
            </label>
            <input
              type="text"
              value={closeNotes}
              onChange={(e) => onCloseNotes(e.target.value)}
              placeholder="e.g. Returned 20,000 to manager"
              className="w-full bg-nx-elevated border border-nx-border text-nx-text text-[13px] px-3 py-2.5 rounded-nx-btn focus:outline-none focus:border-nx-green"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="bg-nx-green hover:bg-nx-green/90 disabled:opacity-60 text-black font-semibold text-[13px] px-6 py-2.5 rounded-nx-btn flex items-center gap-2"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Closing…
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Close till
            </>
          )}
        </button>
      </form>
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string
  value: string
  hint?: string
  tone?: 'neutral' | 'amber' | 'red' | 'green'
}) {
  const toneClass =
    tone === 'red'
      ? 'text-nx-red'
      : tone === 'amber'
        ? 'text-nx-amber'
        : tone === 'green'
          ? 'text-nx-green'
          : 'text-nx-text'
  return (
    <div className="bg-nx-elevated/40 border border-nx-border/50 p-4 rounded-nx-card">
      <span className="text-[10px] text-nx-text-muted uppercase font-bold tracking-wider">
        {label}
      </span>
      <h4 className={`font-data font-bold text-[18px] mt-1.5 tabular-nums ${toneClass}`}>
        {value}
      </h4>
      {hint && <p className="text-[11px] text-nx-text-muted mt-1.5">{hint}</p>}
    </div>
  )
}

function RecentSessionsTable({
  sessions,
  cashierNames,
}: {
  sessions: TillSession[]
  cashierNames: Record<string, string>
}) {
  return (
    <div className="bg-nx-surface border border-nx-border rounded-nx-card overflow-hidden">
      <div className="p-4 border-b border-nx-border flex justify-between items-center select-none">
        <h3 className="font-bold text-[14px] text-nx-text">Recent till sessions</h3>
        <span className="text-[11px] text-nx-text-sec font-data">
          {sessions.length} record{sessions.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[820px]">
          <thead>
            <tr className="bg-nx-elevated border-b border-nx-border text-[11px] font-bold text-nx-text-sec uppercase tracking-wider">
              <th className="py-3 px-4">Operator</th>
              <th className="py-3 px-4">Opened</th>
              <th className="py-3 px-4">Closed</th>
              <th className="py-3 px-4 text-right">Opening Float</th>
              <th className="py-3 px-4 text-right">Counted</th>
              <th className="py-3 px-4 text-right">Unreconciled</th>
              <th className="py-3 px-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-nx-border/50 text-[13px]">
            {sessions.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-nx-text-muted">
                  No till sessions recorded yet.
                </td>
              </tr>
            )}
            {sessions.map((s) => {
              const variance = s.variance === null ? null : Number(s.variance)
              const tone =
                variance === null
                  ? 'text-nx-text-sec'
                  : variance === 0
                    ? 'text-nx-text-sec'
                    : variance > 0
                      ? 'text-nx-amber'
                      : 'text-nx-red'
              const statusBadge =
                s.status === 'open'
                  ? 'bg-nx-green/10 text-nx-green'
                  : s.status === 'disputed'
                    ? 'bg-nx-red/10 text-nx-red'
                    : 'bg-nx-elevated text-nx-text-sec border border-nx-border'
              return (
                <tr key={s.id}>
                  <td className="py-3 px-4 font-semibold text-nx-text">
                    {cashierNames[s.cashier_id] ?? 'Operator'}
                  </td>
                  <td className="py-3 px-4 text-nx-text-sec font-data">
                    {fmtDateTime(s.opened_at)}
                  </td>
                  <td className="py-3 px-4 text-nx-text-sec font-data">
                    {fmtDateTime(s.closed_at)}
                  </td>
                  <td className="py-3 px-4 text-right font-data tabular-nums text-nx-text-sec">
                    {tzs(s.opening_float)}
                  </td>
                  <td className="py-3 px-4 text-right font-data tabular-nums text-nx-text">
                    {tzs(s.actual_cash_counted)}
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-data tabular-nums font-bold ${tone}`}
                  >
                    {variance === null ? '—' : tzs(variance)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${statusBadge}`}
                    >
                      {s.status}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
