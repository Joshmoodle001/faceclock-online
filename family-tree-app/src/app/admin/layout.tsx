'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [orgName, setOrgName] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const check = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); setLoading(false); return }

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('user_id', user.id).maybeSingle()

      if (!prof) { router.push('/login'); setLoading(false); return }
      setProfile(prof)

      if (prof.organization_id) {
        const { data: org } = await supabase
          .from('organizations').select('name').eq('id', prof.organization_id).maybeSingle()
        if (org) setOrgName(org.name)
      }
      setLoading(false)
    }
    check()
  }, [])

  const handleSignOut = async () => {
    await createClient().auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>
  }

  const nav = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/employees', label: 'Employees' },
    { href: '/admin/family-trees', label: 'Family Trees' },
  ]

  const active = (href: string) => href === '/admin' ? pathname === href : pathname.startsWith(href)

  return (
    <div className="min-h-screen flex">
      {mobileOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-56 bg-white border-r flex flex-col transition-transform ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="h-14 px-4 border-b flex items-center">
          <div>
            <p className="font-bold text-sm">Family Tree Clock</p>
            {orgName && <p className="text-xs text-gray-500">{orgName}</p>}
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {nav.map(item => (
            <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${active(item.href) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-700">
              {profile?.display_name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <span className="truncate">{profile?.display_name}</span>
          </div>
          <button onClick={handleSignOut} className="text-xs text-gray-400 hover:text-red-500">Logout</button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="lg:hidden h-14 px-4 border-b bg-white flex items-center justify-between">
          <button onClick={() => setMobileOpen(true)}><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
          <span className="font-bold text-sm">Family Tree Clock</span>
          <div className="w-5" />
        </header>
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
