'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Emp {
  user_id: string; display_name: string; email?: string; employee_code?: string; role?: string
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Emp[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState(false)
  const [editing, setEditing] = useState<Emp | null>(null)
  const [form, setForm] = useState({ display_name: '', email: '', employee_code: '', password: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  const supabase = createClient()

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: prof } = await supabase.from('profiles').select('organization_id').eq('user_id', user.id).maybeSingle()
    if (!prof?.organization_id) { setLoading(false); return }
    let q = supabase.from('profiles').select('*').eq('organization_id', prof.organization_id).order('display_name')
    if (search) q = q.ilike('display_name', `%${search}%`)
    const { data } = await q
    setEmployees((data || []) as Emp[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (!loading) { const t = setTimeout(load, 300); return () => clearTimeout(t) } }, [search])

  const openAdd = () => { setEditing(null); setForm({ display_name: '', email: '', employee_code: '', password: '' }); setMsg(null); setDialog(true) }
  const openEdit = (e: Emp) => { setEditing(e); setForm({ display_name: e.display_name, email: e.email || '', employee_code: e.employee_code || '', password: '' }); setMsg(null); setDialog(true) }

  const save = async () => {
    setSaving(true); setMsg(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data: prof } = await supabase.from('profiles').select('organization_id').eq('user_id', user.id).maybeSingle()
      const orgId = prof?.organization_id; if (!orgId) throw new Error('No organization')

      if (editing) {
        await supabase.from('profiles').update({ display_name: form.display_name, employee_code: form.employee_code }).eq('user_id', editing.user_id)
        setMsg({ type: 'success', text: 'Updated' })
      } else {
        if (!form.email || !form.password || !form.display_name) { setMsg({ type: 'error', text: 'All fields required' }); setSaving(false); return }
        const res = await fetch('/api/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: form.email, password: form.password, display_name: form.display_name, employee_code: form.employee_code, organization_id: orgId }) })
        if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
        setMsg({ type: 'success', text: 'Employee created' })
      }
      setDialog(false); load()
    } catch (err: any) { setMsg({ type: 'error', text: err.message || 'Failed' })
    } finally { setSaving(false) }
  }

  const remove = async (e: Emp) => { if (confirm(`Delete ${e.display_name}?`)) { await supabase.from('profiles').delete().eq('user_id', e.user_id); load() } }

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Employees</h1>
        <button onClick={openAdd} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700">Add Employee</button>
      </div>
      <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="w-full border rounded-lg px-4 py-2 text-sm" />
      {msg && <div className={`text-sm p-3 rounded-lg ${msg.type === 'error' ? 'text-red-600 bg-red-50' : 'text-green-700 bg-green-50'}`}>{msg.text}</div>}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50"><th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Name</th><th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Email</th><th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Code</th><th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Role</th><th className="w-20 px-4 py-3" /></tr></thead>
          <tbody className="divide-y">
            {employees.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-gray-500">No employees</td></tr> :
            employees.map(e => (
              <tr key={e.user_id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{e.display_name}</td>
                <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{e.email}</td>
                <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{e.employee_code || '—'}</td>
                <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{e.role || 'employee'}</span></td>
                <td className="px-4 py-3 flex gap-1">
                  <button onClick={() => openEdit(e)} className="p-1 text-gray-400 hover:text-blue-600"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/></svg></button>
                  <button onClick={() => remove(e)} className="p-1 text-gray-400 hover:text-red-600"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                </td>
              </tr>
            ))
            }
          </tbody>
        </table>
      </div>
      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-semibold">{editing ? 'Edit' : 'Add'} Employee</h2>
            <div className="space-y-3">
              <div><label className="text-sm font-medium">Name</label><input type="text" value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" /></div>
              {!editing && <><div><label className="text-sm font-medium">Email</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" /></div>
              <div><label className="text-sm font-medium">Password</label><input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" /></div></>}
              <div><label className="text-sm font-medium">Employee Code</label><input type="text" value={form.employee_code} onChange={e => setForm({ ...form, employee_code: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" /></div>
            </div>
            <div className="flex justify-end gap-2"><button onClick={() => setDialog(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button><button onClick={save} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
