import { requireAuth } from '@/lib/auth/session'
import { redirect } from 'next/navigation'

export default async function AppIndexPage() {
  const user = await requireAuth()
  
  // Redirect based on role
  if (user.role === 'cashier') {
    redirect('/app/pos')
  } else {
    redirect('/app/dashboard')
  }
}
