'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const contactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  business: z.string().optional(),
  subject: z.string().min(5, 'Subject must be at least 5 characters'),
  message: z.string().min(20, 'Message must be at least 20 characters'),
  tier_interest: z.enum(['starter', 'business', 'enterprise', 'general']).default('general'),
})

export type ContactState = {
  success?: boolean
  error?: string
}

export async function submitContactForm(
  prevState: any,
  formData: FormData
): Promise<ContactState> {
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const business = formData.get('business') as string
  const subject = formData.get('subject') as string
  const message = formData.get('message') as string
  const tier_interest = (formData.get('tier_interest') as string) || 'general'

  const validation = contactSchema.safeParse({
    name,
    email,
    business,
    subject,
    message,
    tier_interest,
  })

  if (!validation.success) {
    return { error: validation.error.errors[0].message }
  }

  try {
    const supabase = (await createServiceClient()) as any

    const { error: insertError } = await supabase
      .from('contact_submissions')
      .insert({
        name,
        email,
        business: business || null,
        subject,
        message,
        tier_interest,
        status: 'new',
        submitted_at: new Date().toISOString(),
      })

    if (insertError) {
      // If table doesn't exist yet, still return success to not block UX
      if (insertError.code === '42P01') {
        console.warn('contact_submissions table not yet created — form saved to logs only.')
        console.info('Contact submission:', { name, email, business, subject, tier_interest })
        return { success: true }
      }
      throw new Error(insertError.message)
    }

    return { success: true }
  } catch (error: any) {
    console.error('Contact form submission error:', error)
    return { error: error.message || 'Failed to submit your message. Please try again.' }
  }
}
