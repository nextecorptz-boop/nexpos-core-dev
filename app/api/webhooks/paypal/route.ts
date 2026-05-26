import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const payload = await req.json()
    const eventType = payload.event_type
    const resource = payload.resource

    console.log(`[PayPal Webhook] Received event: ${eventType}`, {
      subscription_id: resource?.id,
      plan_id: resource?.plan_id,
      custom_id: resource?.custom_id || resource?.custom
    })

    const supabase = (await createServiceClient()) as any

    // Retrieve PayPal Plan IDs from env
    const basicPlanId = process.env.PAYPAL_BASIC_PLAN_ID || 'PAYPAL_BASIC_PLAN_ID'
    const proPlanId = process.env.PAYPAL_PRO_PLAN_ID || 'PAYPAL_PRO_PLAN_ID'

    if (eventType === 'BILLING.SUBSCRIPTION.ACTIVATED') {
      const subscriptionId = resource.id
      const planId = resource.plan_id
      const payerId = resource.subscriber?.payer_id || null
      const tenantId = resource.custom_id || resource.custom

      // Map paypal plan_id to DB plan_id
      let mappedPlan = 'basic'
      if (planId === proPlanId) {
        mappedPlan = 'pro'
      } else if (planId === basicPlanId) {
        mappedPlan = 'basic'
      }

      if (tenantId) {
        const { error } = await supabase
          .from('tenants')
          .update({
            paypal_subscription_id: subscriptionId,
            paypal_payer_id: payerId,
            status: 'active',
            plan_id: mappedPlan,
            updated_at: new Date().toISOString()
          })
          .eq('id', tenantId)

        if (error) {
          console.error(`[PayPal Webhook] Error updating tenant ${tenantId} for activation:`, error)
          return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
        }
        console.log(`[PayPal Webhook] Tenant ${tenantId} activated. Subscription: ${subscriptionId}, Plan: ${mappedPlan}`)
      } else {
        // Fallback: Seek by subscription_id
        const { data: tenant, error: searchError } = await supabase
          .from('tenants')
          .select('id')
          .eq('paypal_subscription_id', subscriptionId)
          .maybeSingle()

        if (searchError || !tenant) {
          console.warn(`[PayPal Webhook] No tenant found for subscription ${subscriptionId}`)
          return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
        }

        const { error } = await supabase
          .from('tenants')
          .update({
            paypal_payer_id: payerId,
            status: 'active',
            plan_id: mappedPlan,
            updated_at: new Date().toISOString()
          })
          .eq('id', tenant.id)

        if (error) {
          console.error(`[PayPal Webhook] Error updating tenant ${tenant.id} for activation fallback:`, error)
          return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
        }
        console.log(`[PayPal Webhook] Tenant ${tenant.id} updated to active. Plan: ${mappedPlan}`)
      }
    } 
    else if (
      eventType === 'BILLING.SUBSCRIPTION.CANCELLED' ||
      eventType === 'BILLING.SUBSCRIPTION.EXPIRED' ||
      eventType === 'BILLING.SUBSCRIPTION.SUSPENDED'
    ) {
      const subscriptionId = resource.id

      // Find tenant by subscription_id
      const { data: tenant, error: searchError } = await supabase
        .from('tenants')
        .select('id')
        .eq('paypal_subscription_id', subscriptionId)
        .maybeSingle()

      if (searchError || !tenant) {
        console.warn(`[PayPal Webhook] No tenant found for subscription cancellation/suspension: ${subscriptionId}`)
        return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
      }

      const { error } = await supabase
        .from('tenants')
        .update({
          status: 'suspended',
          updated_at: new Date().toISOString()
        })
        .eq('id', tenant.id)

      if (error) {
        console.error(`[PayPal Webhook] Error suspending tenant ${tenant.id}:`, error)
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
      }
      console.log(`[PayPal Webhook] Tenant ${tenant.id} suspended. Subscription: ${subscriptionId} (${eventType})`)
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('[PayPal Webhook] Handler error:', error)
    return NextResponse.json({ error: error.message || 'Webhook processing failed' }, { status: 500 })
  }
}
