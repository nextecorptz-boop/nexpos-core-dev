'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Terminal, ShieldCheck, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      // Get user profile to determine redirect
      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()

      if (profile && profile.role === 'cashier') {
        router.push('/app/pos')
      } else {
        router.push('/app/dashboard')
      }
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Invalid login credentials. Please check your email and password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0E0D0B] flex items-center justify-center px-6 relative overflow-hidden">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            'linear-gradient(#00C9E4 1px, transparent 1px), linear-gradient(90deg, #00C9E4 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      {/* Cyan glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-[#00C9E4]/4 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[#5A534C] hover:text-[#A19B94] transition-colors duration-150 mb-10 group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Back to Platform</span>
        </Link>

        {/* Card */}
        <div className="bg-[#0D0C0A] border border-[#1E1B17]">
          {/* Card header */}
          <div className="px-8 py-6 border-b border-[#1E1B17] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 bg-[#00C9E4] flex items-center justify-center shrink-0">
                <Terminal className="w-3.5 h-3.5 text-[#0E0D0B]" />
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#5A534C]">
                  NEXPOS — Staff Authentication
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-[#00C9E4] animate-pulse" />
              <span className="font-data text-[9px] text-[#00C9E4] uppercase tracking-widest">SECURE</span>
            </div>
          </div>

          <div className="p-8">
            <div className="mb-8">
              <h1 className="font-display text-2xl font-bold text-[#FAF6EE] mb-1.5">
                Workspace Access
              </h1>
              <p className="text-[13px] text-[#5A534C]">
                Sign in to your retail operating system.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5" id="login-form">
              {/* Error alert */}
              {error && (
                <div className="border border-red-500/20 bg-red-500/5 px-4 py-3 flex items-start gap-3">
                  <div className="w-1 h-full bg-red-500/60 shrink-0 mt-0.5" />
                  <p className="text-red-400 text-[12px] leading-relaxed">{error}</p>
                </div>
              )}

              {/* Email */}
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#5A534C] mb-2"
                >
                  Email Address
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0A0908] border border-[#292521] text-[#FAF6EE] text-sm px-4 py-3 focus:outline-none focus:border-[#00C9E4] transition-colors duration-150 placeholder-[#3A3530]"
                  placeholder="operator@business.com"
                  required
                  autoComplete="email"
                />
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="login-password"
                  className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#5A534C] mb-2"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#0A0908] border border-[#292521] text-[#FAF6EE] text-sm px-4 py-3 pr-11 focus:outline-none focus:border-[#00C9E4] transition-colors duration-150 placeholder-[#3A3530]"
                    placeholder="••••••••••"
                    required
                    autoComplete="current-password"
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
                id="login-submit"
                type="submit"
                disabled={loading}
                className="w-full bg-[#00C9E4] text-[#0E0D0B] font-bold uppercase tracking-[0.1em] text-[11px] px-6 py-4 flex items-center justify-center gap-2 hover:bg-[#00C9E4]/90 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Sign In to Workspace
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Card footer */}
          <div className="px-8 py-5 border-t border-[#1E1B17] flex items-center justify-between">
            <p className="text-[11px] text-[#3A3530]">
              Need access?{' '}
              <Link href="/signup" className="text-[#00C9E4] hover:text-[#00C9E4]/80 transition-colors">
                Register your business
              </Link>
            </p>
            <div className="font-data text-[9px] text-[#3A3530] uppercase tracking-widest">
              AES-256
            </div>
          </div>
        </div>

        {/* Trust indicators */}
        <div className="mt-8 flex items-center justify-center gap-8">
          {[
            'Multi-Tenant RLS',
            'Session Encryption',
            'RBAC Protected',
          ].map((label) => (
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
  )
}
