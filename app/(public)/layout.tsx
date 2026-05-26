import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'NEXPOS — Enterprise Retail Operating System for Tanzania',
    template: '%s | NEXPOS',
  },
  description:
    'Multi-branch POS, real-time inventory, credit registry, and M-Pesa reconciliation — built for Tanzanian retail businesses.',
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
