'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Terminal,
  ShieldCheck,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react'
import { signupTenant } from '@/lib/actions/signup'
import { createClient } from '@/lib/supabase/client'

const PLAN_HIGHLIGHTS = [
  '14-day free trial — no credit card',
  'Offline-first POS terminal included',
  'Multi-branch inventory from day one',
  'M-Pesa & Tigo Pesa reconciliation',
]

export default function SignupPage() {
  const [businessName, setBusinessName] = useState('')
  const [slug, setSlug] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  // Auto-generate slug from business name
  const handleBusinessNameChange = (val: string) => {
    setBusinessName(val)
    const generatedSlug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')
    setSlug(generatedSlug)
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append('businessName', businessName)
    formData.append('slug', slug)
    formData.append('fullName', fullName)
    formData.append('email', email)
    formData.append('password', password)

    try {
      const result = await signupTenant(null, formData)

      if (result.error) {
        setError(result.error)
        setLoading(false)
        return
      }

      setSuccess(true)

      // Auto sign-in to pass tenant context down to the app
      const { error: loginErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (loginErr) {
        router.push('/login?registered=true')
      } else {
        router.push('/app/dashboard')
        router.refresh()
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0E0D0B] flex relative overflow-hidden">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            'linear-gradient(#00C9E4 1px, transparent 1px), linear-gradient(90deg, #00C9E4 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* ── LEFT PANEL — value proposition ── */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 bg-[#0A0908] border-r border-[#1E1B17] p-12 relative z-10">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[#00C9E4] flex items-center justify-center">
            <Terminal className="w-3.5 h-3.5 text-[#0E0D0B]" />
          </div>
          <span className="font-display font-bold text-[#FAF6EE]">
            NEX<span className="text-[#00C9E4]">POS</span>
          </span>
        </div>

        {/* Value prop */}
        <div>
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-4 h-px bg-[#00C9E4]" />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#00C9E4]">
              Free 14-Day Trial
            </span>
          </div>
          <h2 className="font-display text-3xl font-bold text-[#FAF6EE] mb-4 leading-tight">
            Your Retail OS
            <br />
            Deployed in
            <br />
            <span className="text-[#00C9E4]">60 Seconds</span>
          </h2>
          <p className="text-[#5A534C] text-sm leading-relaxed mb-10">
            Provision a fully isolated multi-tenant environment with POS, inventory,
            credit, and reporting — ready to use immediately after registration.
          </p>

          <ul className="space-y-4">
            {PLAN_HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <div className="w-5 h-5 border border-[#00C9E4]/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-[#00C9E4]" />
                </div>
                <span className="text-[13px] text-[#A19B94] leading-snug">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom decoration */}
        <div className="border border-[#1E1B17] p-5">
          <div className="font-data text-[9px] text-[#3A3530] uppercase tracking-widest mb-3">
            // system.provision — pending
          </div>
          <div className="space-y-2">
            {['tenant_db', 'rls_policies', 'branch_init', 'auth_user'].map((item, i) => (
              <div key={item} className="flex items-center justify-between">
                <span className="font-data text-[10px] text-[#5A534C]">{item}</span>
                <span className="font-data text-[9px] text-[#3A3530]">WAITING</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL — form ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative z-10">
        <div className="w-full max-w-lg">
          {/* Back */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[#5A534C] hover:text-[#A19B94] transition-colors duration-150 mb-10 group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Back to Platform</span>
          </Link>

          {/* Form card */}
          <div className="bg-[#0D0C0A] border border-[#1E1B17]">
            {/* Header */}
            <div className="px-8 py-6 border-b border-[#1E1B17] flex items-center justify-between">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#5A534C] mb-0.5">
                  NEXPOS — Tenant Onboarding
                </div>
                <div className="text-[10px] text-[#3A3530]">Self-serve business registration</div>
              </div>
              <div className="lg:hidden flex items-center gap-1.5">
                <div className="w-2 h-2 bg-[#00C9E4]" />
                <span className="font-data text-[9px] text-[#00C9E4] uppercase tracking-widest">SECURE</span>
              </div>
            </div>

            <div className="p-8">
              <div className="mb-8">
                <h1 className="font-display text-2xl font-bold text-[#FAF6EE] mb-1.5">
                  Create Your Workspace
                </h1>
                <p className="text-[13px] text-[#5A534C]">
                  Register your business and deploy your retail operating system.
                </p>
              </div>

              <form onSubmit={handleSignup} className="space-y-5" id="signup-form">
                {/* Error */}
                {error && (
                  <div className="border border-red-500/20 bg-red-500/5 px-4 py-3 flex items-start gap-3">
                    <div className="w-1 shrink-0 bg-red-500/60 self-stretch" />
                    <p className="text-red-400 text-[12px] leading-relaxed">{error}</p>
                  </div>
                )}

                {/* Success */}
                {success && (
                  <div className="border border-[#00C9E4]/20 bg-[#00C9E4]/5 px-4 py-3 flex items-center gap-3">
                    <ShieldCheck className="w-4 h-4 text-[#00C9E4] shrink-0" />
                    <p className="text-[#00C9E4] text-[12px]">
                      Workspace created. Redirecting to dashboard...
                    </p>
                  </div>
                )}

                {/* Business name + Slug */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="signup-business-name"
                      className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#5A534C] mb-2"
                    >
                      Business Name
                    </label>
                    <input
                      id="signup-business-name"
                      type="text"
                      value={businessName}
                      onChange={(e) => handleBusinessNameChange(e.target.value)}
                      className="w-full bg-[#0A0908] border border-[#292521] text-[#FAF6EE] text-sm px-4 py-3 focus:outline-none focus:border-[#00C9E4] transition-colors duration-150 placeholder-[#3A3530]"
                      placeholder="e.g. Kariakoo Shoes"
                      required
                      disabled={loading || success}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="signup-slug"
                      className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#5A534C] mb-2"
                    >
                      URL Slug
                    </label>
                    <input
                      id="signup-slug"
                      type="text"
                      value={slug}
                      onChange={(e) =>
                        setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-'))
                      }
                      className="w-full bg-[#0A0908] border border-[#292521] text-[#FAF6EE] text-sm px-4 py-3 focus:outline-none focus:border-[#00C9E4] transition-colors duration-150 placeholder-[#3A3530] font-data"
                      placeholder="kariakoo-shoes"
                      required
                      disabled={loading || success}
                    />
                    {slug && (
                      <span className="font-data text-[9px] text-[#3A3530] mt-1 block">
                        /catalog/{slug}
                      </span>
                    )}
                  </div>
                </div>

                {/* Full Name */}
                <div>
                  <label
                    htmlFor="signup-fullname"
                    className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#5A534C] mb-2"
                  >
                    Administrator Name
                  </label>
                  <input
                    id="signup-fullname"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-[#0A0908] border border-[#292521] text-[#FAF6EE] text-sm px-4 py-3 focus:outline-none focus:border-[#00C9E4] transition-colors duration-150 placeholder-[#3A3530]"
                    placeholder="Your full name"
                    required
                    disabled={loading || success}
                  />
                </div>

                {/* Email */}
                <div>
                  <label
                    htmlFor="signup-email"
                    className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#5A534C] mb-2"
                  >
                    Business Email
                  </label>
                  <input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#0A0908] border border-[#292521] text-[#FAF6EE] text-sm px-4 py-3 focus:outline-none focus:border-[#00C9E4] transition-colors duration-150 placeholder-[#3A3530]"
                    placeholder="admin@yourbusiness.com"
                    required
                    disabled={loading || success}
                    autoComplete="email"
                  />
                </div>

                {/* Password */}
                <div>
                  <label
                    htmlFor="signup-password"
                    className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#5A534C] mb-2"
                  >
                    Secure Password
                  </label>
                  <div className="relative">
                    <input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#0A0908] border border-[#292521] text-[#FAF6EE] text-sm px-4 py-3 pr-11 focus:outline-none focus:border-[#00C9E4] transition-colors duration-150 placeholder-[#3A3530]"
                      placeholder="Min. 6 characters"
                      required
                      disabled={loading || success}
                      minLength={6}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A534C] hover:text-[#A19B94] transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <button
                  id="signup-submit"
                  type="submit"
                  disabled={loading || success}
                  className="w-full bg-[#00C9E4] text-[#0E0D0B] font-bold uppercase tracking-[0.1em] text-[11px] px-6 py-4 flex items-center justify-center gap-2 hover:bg-[#00C9E4]/90 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] mt-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Provisioning Workspace...
                    </>
                  ) : success ? (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      Workspace Created
                    </>
                  ) : (
                    <>
                      Deploy Workspace
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Footer */}
            <div className="px-8 py-5 border-t border-[#1E1B17] flex items-center justify-between">
              <p className="text-[11px] text-[#3A3530]">
                Already registered?{' '}
                <Link href="/login" className="text-[#00C9E4] hover:text-[#00C9E4]/80 transition-colors">
                  Staff Login
                </Link>
              </p>
              <div className="font-data text-[9px] text-[#3A3530] uppercase tracking-widest">
                Supabase RLS
              </div>
            </div>
          </div>

          {/* Trust strip */}
          <div className="mt-6 flex items-center justify-center gap-6 flex-wrap">
            {['Encrypted Transit', 'Isolated DB', 'GDPR Ready'].map((label) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-1 h-1 bg-[#3A3530]" />
                <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#3A3530]">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
