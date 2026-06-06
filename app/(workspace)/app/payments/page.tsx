import { requireRole } from '@/lib/auth/session'
import {
  SeerBitProviderCard,
  ActivationChecklist,
  PaymentMethodsList,
  WebhookStatus,
} from '@/components/workspace/payments'
import {
  DEFAULT_CHECKLIST,
  DEFAULT_METHODS,
  DEFAULT_WEBHOOK,
  type SeerbitStatus,
} from '@/lib/payments/seerbit'

export const dynamic = 'force-dynamic'

/**
 * NEXPOS Payments — SeerBit setup surface.
 *
 * Phase D scope: UI + state architecture only. No SeerBit API calls,
 * no secret-key handling. The page defaults to `not_connected` and is
 * gated to owners/managers (cashiers don't manage payment providers).
 *
 * When the real backend lands:
 *  - Resolve `status` from a Supabase row keyed by tenant_id.
 *  - Hydrate `checklist`/`methods`/`webhook` from that row instead of defaults.
 *  - Add server actions: connectProvider, runTestPayment, verifyWebhook, etc.
 *  - Keep secret-key handling exclusively in Edge Functions; never client.
 */
export default async function PaymentsPage() {
  await requireRole(['owner', 'manager'])

  // Phase-D default state. Each section is rendered from these constants;
  // when status moves off `not_connected` we'll flip checklist items + methods.
  const status: SeerbitStatus = 'not_connected'

  return (
    <div className="max-w-[1400px] mx-auto px-6 pb-12">
      <div className="flex items-center justify-between mb-8 pt-6 select-none">
        <div>
          <h1 className="font-ui text-[22px] font-bold text-nx-text leading-[1.3] mb-1">
            Payments
          </h1>
          <p className="text-nx-text-sec text-[12px]">
            Activate SeerBit to accept card, mobile money, and online checkout.
          </p>
        </div>
      </div>

      {/* Provider card with status chip */}
      <SeerBitProviderCard status={status} />

      {/* Activation checklist */}
      <div className="nx-section-head">
        <span className="nx-label">Activation checklist</span>
        <span className="nx-body-sm">
          {DEFAULT_CHECKLIST.filter((c) => c.state === 'done').length}{' '}
          / {DEFAULT_CHECKLIST.length}
        </span>
      </div>
      <ActivationChecklist items={DEFAULT_CHECKLIST} />

      {/* Payment methods */}
      <div className="nx-section-head">
        <span className="nx-label">Payment methods</span>
      </div>
      <PaymentMethodsList methods={DEFAULT_METHODS} />

      {/* Webhook status */}
      <div className="nx-section-head">
        <span className="nx-label">Webhook</span>
      </div>
      <WebhookStatus info={DEFAULT_WEBHOOK} />

      {/* Primary CTA — opens the setup wizard in a later phase.
          Disabled in Phase D because no backend exists yet. */}
      <button
        className="nx-btn-primary"
        style={{ margin: '20px 0 24px' }}
        disabled
        aria-disabled="true"
        title="SeerBit setup wizard ships in a later phase"
      >
        Connect SeerBit
      </button>
    </div>
  )
}
