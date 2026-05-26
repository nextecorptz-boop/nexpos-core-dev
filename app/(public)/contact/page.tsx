'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Terminal,
  ShieldCheck,
  Mail,
  Building2,
  MessageSquare,
} from 'lucide-react'
import { submitContactForm, type ContactState } from '@/lib/actions/contact'

const TIER_OPTIONS = [
  { value: 'general', label: 'General Inquiry' },
  { value: 'starter', label: 'Starter Plan — TZS 46,000/mo' },
  { value: 'business', label: 'Business Plan — TZS 97,000/mo' },
  { value: 'enterprise', label: 'Growth Enterprise — TZS 184,000/mo' },
]

const CONTACT_CHANNELS = [
  {
    label: 'Dar es Salaam HQ',
    value: 'Kariakoo, Dar es Salaam',
    icon: Building2,
  },
  {
    label: 'Enterprise Sales',
    value: 'sales@nexpos.tz',
    icon: Mail,
  },
  {
    label: 'Technical Support',
    value: 'support@nexpos.tz',
    icon: MessageSquare,
  },
]

export default function ContactPage() {
  const [state, setState] = useState<ContactState>({})
  const [isPending, setIsPending] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsPending(true)
    setState({})
    const formData = new FormData(e.currentTarget)
    try {
      const result = await submitContactForm(null, formData)
      setState(result)
    } catch (err: any) {
      setState({ error: err.message || 'Submission failed. Please try again.' })
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0E0D0B] text-[#FAF6EE]">
      {/* Background grid */}
      <div
        className="fixed inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(#00C9E4 1px, transparent 1px), linear-gradient(90deg, #00C9E4 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Nav bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0E0D0B]/90 backdrop-blur-sm border-b border-[#1E1B17]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-[#00C9E4] flex items-center justify-center">
                <Terminal className="w-3.5 h-3.5 text-[#0E0D0B]" />
              </div>
              <span className="font-display font-bold text-[#FAF6EE]">
                NEX<span className="text-[#00C9E4]">POS</span>
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-[#5A534C] hover:text-[#A19B94] transition-colors group"
              >
                <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Back</span>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-32 pb-24 relative z-10">
        {/* Page header */}
        <div className="mb-20">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-6 h-px bg-[#C9A84C]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C9A84C]">
              Enterprise Sales &amp; Support
            </span>
          </div>
          <h1 className="font-display text-4xl lg:text-7xl font-bold text-[#FAF6EE] leading-tight max-w-2xl">
            Let's Build
            <br />
            Your <span className="text-[#C9A84C]">Retail OS</span>
          </h1>
          <p className="text-[#A19B94] text-base lg:text-lg max-w-xl mt-6 leading-relaxed">
            Custom enterprise requirements, multi-cluster deployments, or general inquiries — our
            engineering and sales team will respond within one business day.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-0 border border-[#1E1B17]">
          {/* ── LEFT: Form ── */}
          <div className="lg:col-span-2 border-r border-[#1E1B17]">
            {state.success ? (
              /* Success state */
              <div className="p-12 lg:p-16 flex flex-col items-center justify-center min-h-[500px] text-center">
                <div className="w-16 h-16 border border-[#00C9E4]/30 bg-[#00C9E4]/5 flex items-center justify-center mb-8">
                  <ShieldCheck className="w-8 h-8 text-[#00C9E4]" />
                </div>
                <h2 className="font-display text-3xl font-bold text-[#FAF6EE] mb-4">
                  Message Received
                </h2>
                <p className="text-[#A19B94] text-sm max-w-md leading-relaxed mb-10">
                  Your inquiry has been logged into our sales queue. A member of our team will
                  respond to <span className="text-[#FAF6EE]">your email</span> within one business day.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link
                    href="/signup"
                    className="inline-flex items-center justify-center gap-2 bg-[#00C9E4] text-[#0E0D0B] font-bold uppercase tracking-[0.1em] text-[11px] px-8 py-4 hover:bg-[#00C9E4]/90 transition-all"
                  >
                    Start Free Trial Now
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    href="/"
                    className="inline-flex items-center justify-center gap-2 border border-[#292521] text-[#FAF6EE] font-semibold uppercase tracking-[0.1em] text-[11px] px-8 py-4 hover:bg-[#161412] transition-all"
                  >
                    Back to Home
                  </Link>
                </div>
              </div>
            ) : (
              /* Contact form */
              <form onSubmit={handleSubmit} id="contact-form" className="p-8 lg:p-12">
                <div className="mb-8">
                  <h2 className="font-display text-xl font-bold text-[#FAF6EE] mb-1">
                    Submit an Inquiry
                  </h2>
                  <p className="text-[12px] text-[#5A534C]">
                    All fields marked are required.
                  </p>
                </div>

                {/* Error */}
                {state.error && (
                  <div className="border border-red-500/20 bg-red-500/5 px-4 py-3 flex items-start gap-3 mb-6">
                    <div className="w-1 shrink-0 bg-red-500/60 self-stretch" />
                    <p className="text-red-400 text-[12px] leading-relaxed">{state.error}</p>
                  </div>
                )}

                <div className="space-y-6">
                  {/* Name + Email */}
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label
                        htmlFor="contact-name"
                        className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#5A534C] mb-2"
                      >
                        Full Name *
                      </label>
                      <input
                        id="contact-name"
                        name="name"
                        type="text"
                        required
                        disabled={isPending}
                        className="w-full bg-[#0A0908] border border-[#292521] text-[#FAF6EE] text-sm px-4 py-3 focus:outline-none focus:border-[#00C9E4] transition-colors duration-150 placeholder-[#3A3530]"
                        placeholder="Your full name"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="contact-email"
                        className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#5A534C] mb-2"
                      >
                        Email Address *
                      </label>
                      <input
                        id="contact-email"
                        name="email"
                        type="email"
                        required
                        disabled={isPending}
                        className="w-full bg-[#0A0908] border border-[#292521] text-[#FAF6EE] text-sm px-4 py-3 focus:outline-none focus:border-[#00C9E4] transition-colors duration-150 placeholder-[#3A3530]"
                        placeholder="admin@yourbusiness.com"
                      />
                    </div>
                  </div>

                  {/* Business + Tier interest */}
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label
                        htmlFor="contact-business"
                        className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#5A534C] mb-2"
                      >
                        Business Name
                      </label>
                      <input
                        id="contact-business"
                        name="business"
                        type="text"
                        disabled={isPending}
                        className="w-full bg-[#0A0908] border border-[#292521] text-[#FAF6EE] text-sm px-4 py-3 focus:outline-none focus:border-[#00C9E4] transition-colors duration-150 placeholder-[#3A3530]"
                        placeholder="Optional"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="contact-tier"
                        className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#5A534C] mb-2"
                      >
                        Plan Interest
                      </label>
                      <select
                        id="contact-tier"
                        name="tier_interest"
                        disabled={isPending}
                        defaultValue="general"
                        className="w-full bg-[#0A0908] border border-[#292521] text-[#FAF6EE] text-sm px-4 py-3 focus:outline-none focus:border-[#00C9E4] transition-colors duration-150 appearance-none cursor-pointer"
                      >
                        {TIER_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value} className="bg-[#0D0C0A]">
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Subject */}
                  <div>
                    <label
                      htmlFor="contact-subject"
                      className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#5A534C] mb-2"
                    >
                      Subject *
                    </label>
                    <input
                      id="contact-subject"
                      name="subject"
                      type="text"
                      required
                      disabled={isPending}
                      className="w-full bg-[#0A0908] border border-[#292521] text-[#FAF6EE] text-sm px-4 py-3 focus:outline-none focus:border-[#00C9E4] transition-colors duration-150 placeholder-[#3A3530]"
                      placeholder="e.g. Enterprise deployment for 10 branches"
                    />
                  </div>

                  {/* Message */}
                  <div>
                    <label
                      htmlFor="contact-message"
                      className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#5A534C] mb-2"
                    >
                      Message *
                    </label>
                    <textarea
                      id="contact-message"
                      name="message"
                      rows={6}
                      required
                      disabled={isPending}
                      className="w-full bg-[#0A0908] border border-[#292521] text-[#FAF6EE] text-sm px-4 py-3 focus:outline-none focus:border-[#00C9E4] transition-colors duration-150 placeholder-[#3A3530] resize-none"
                      placeholder="Describe your business, branch count, and specific requirements..."
                    />
                  </div>

                  {/* Submit */}
                  <button
                    id="contact-submit"
                    type="submit"
                    disabled={isPending}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#C9A84C] text-[#0E0D0B] font-bold uppercase tracking-[0.1em] text-[11px] px-10 py-4 hover:bg-[#C9A84C]/90 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        Send Inquiry
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* ── RIGHT: Contact info ── */}
          <div className="bg-[#0A0908] flex flex-col">
            {/* Contact channels */}
            <div className="p-8 lg:p-10 border-b border-[#1E1B17]">
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#5A534C] mb-8">
                Direct Channels
              </div>
              <div className="space-y-8">
                {CONTACT_CHANNELS.map((channel) => {
                  const Icon = channel.icon
                  return (
                    <div key={channel.label}>
                      <div className="flex items-center gap-3 mb-2">
                        <Icon className="w-4 h-4 text-[#00C9E4]" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#5A534C]">
                          {channel.label}
                        </span>
                      </div>
                      <p className="text-[13px] text-[#A19B94] pl-7">{channel.value}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Response SLA */}
            <div className="p-8 lg:p-10 border-b border-[#1E1B17]">
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#5A534C] mb-6">
                Response SLA
              </div>
              <div className="space-y-3">
                {[
                  { tier: 'General Inquiry', sla: '1 business day' },
                  { tier: 'Business / Starter', sla: '4–8 business hours' },
                  { tier: 'Enterprise Tier', sla: '2 business hours' },
                ].map((row) => (
                  <div key={row.tier} className="flex items-center justify-between border border-[#1E1B17] px-4 py-2.5">
                    <span className="font-data text-[10px] text-[#5A534C]">{row.tier}</span>
                    <span className="font-data text-[10px] text-[#A19B94]">{row.sla}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA: Free trial */}
            <div className="p-8 lg:p-10 mt-auto">
              <div className="border border-[#1E1B17] p-6">
                <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#3A3530] mb-3">
                  Ready to deploy immediately?
                </div>
                <p className="text-[12px] text-[#5A534C] mb-5 leading-relaxed">
                  Skip the inquiry — launch your workspace in 60 seconds with the free trial.
                </p>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 border border-[#292521] text-[#FAF6EE] font-bold uppercase tracking-[0.1em] text-[10px] px-5 py-2.5 hover:bg-[#161412] hover:border-[#41362D] transition-all duration-200"
                >
                  Free Trial
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#1E1B17] py-10 bg-[#0A0908]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#00C9E4] flex items-center justify-center">
              <Terminal className="w-3 h-3 text-[#0E0D0B]" />
            </div>
            <span className="font-display font-bold text-sm text-[#FAF6EE]">
              NEX<span className="text-[#00C9E4]">POS</span>
            </span>
          </Link>
          <p className="font-data text-[9px] text-[#3A3530] uppercase tracking-widest">
            © 2025 NEXPOS / Nextec Corp
          </p>
        </div>
      </footer>
    </div>
  )
}
