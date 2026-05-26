import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { UserCog, Shield } from 'lucide-react'

export default async function UsersPage() {
  const user = await requireRole(['owner'])
  const supabase = await createClient()

  const { data: users } = await supabase
    .from('profiles')
    .select('*, branch:branches(name)')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-5xl font-bold text-nx-text mb-2">User Management</h1>
        <p className="text-nx-text-sec">Manage staff accounts and permissions</p>
      </div>

      <div className="glass-card p-6">
        <h2 className="font-display text-2xl font-bold text-nx-text mb-6">Staff Members</h2>
        
        {users && users.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-nx-border">
                <tr>
                  <th className="text-left py-3 px-4 font-label uppercase text-xs tracking-wider text-nx-text-sec">Name</th>
                  <th className="text-left py-3 px-4 font-label uppercase text-xs tracking-wider text-nx-text-sec">Email</th>
                  <th className="text-left py-3 px-4 font-label uppercase text-xs tracking-wider text-nx-text-sec">Role</th>
                  <th className="text-left py-3 px-4 font-label uppercase text-xs tracking-wider text-nx-text-sec">Branch</th>
                  <th className="text-center py-3 px-4 font-label uppercase text-xs tracking-wider text-nx-text-sec">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u.id} className="border-b border-nx-border/50">
                    <td className="py-4 px-4 text-nx-text font-medium">{u.full_name}</td>
                    <td className="py-4 px-4 text-nx-text-sec">{u.email}</td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-2 bg-nx-gold/10 text-nx-gold px-3 py-1 text-xs font-label uppercase tracking-wider">
                        {u.role === 'owner' && <Shield className="w-3 h-3" />}
                        {u.role}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-nx-text-sec">{u.branch?.name || 'All Branches'}</td>
                    <td className="py-4 px-4 text-center">
                      {u.is_active ? (
                        <span className="inline-block w-3 h-3 rounded-full bg-nx-gold"></span>
                      ) : (
                        <span className="inline-block w-3 h-3 rounded-full bg-nx-hover"></span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <UserCog className="w-16 h-16 text-nx-text-sec mx-auto mb-4" />
            <p className="text-nx-text-sec">No users found</p>
          </div>
        )}
      </div>

      <div className="glass-card p-6 mt-8 border-l-4 border-nx-gold">
        <h3 className="font-display text-xl font-bold text-nx-text mb-4">Add New User</h3>
        <p className="text-nx-text-sec mb-4">
          To add new staff members:
        </p>
        <ol className="text-nx-text-sec space-y-2 list-decimal list-inside">
          <li>Go to Supabase Dashboard → Authentication → Users</li>
          <li>Click "Add User" and enter their email/password</li>
          <li>Copy the generated User ID</li>
          <li>Run this SQL query (replace placeholders):
            <div className="bg-nx-surface p-4 mt-2 font-mono text-sm text-nx-text overflow-x-auto">
              INSERT INTO profiles (id, full_name, email, role, branch_id, is_active, created_by)<br />
              VALUES ('USER_ID', 'Full Name', 'email@example.com', 'cashier', 'BRANCH_ID', true, '{user.id}');
            </div>
          </li>
        </ol>
      </div>
    </div>
  )
}
