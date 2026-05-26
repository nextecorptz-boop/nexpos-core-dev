import { requireAuth } from '@/lib/auth/session'
import WorkspaceNav from '@/components/workspace/workspace-nav'
import AppHeader from '@/components/workspace/app-header'
import { redirect } from 'next/navigation'

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireAuth()
  
  if (!user.is_active) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-nx-bg text-nx-text">
      {/* Grouped Sidebar navigation */}
      <WorkspaceNav user={user} />
      
      {/* Main content wrapper */}
      <main className="lg:pl-60 min-h-[calc(100vh-4rem)] lg:min-h-screen flex flex-col pt-16 lg:pt-0">
        {/* Top bar with active branch info, network status, and user info */}
        <AppHeader user={user} />
        
        {/* Child page container */}
        <div className="p-6 lg:p-8 flex-grow">
          {children}
        </div>
      </main>
    </div>
  )
}
