'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'

export default function EmployeesPage() {
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const [employees, setEmployees] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showDialog, setShowDialog] = useState(false)
  const [editing, setEditing] = useState<Profile | null>(null)
  const [form, setForm] = useState({ display_name: '', email: '', employee_code: '', password: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    loadEmployees()
  }, [])

  const loadEmployees = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: prof } = await supabase
      .from('profiles')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!prof?.organization_id) { setLoading(false); return }
    let query = supabase
      .from('profiles')
      .select('*')
      .eq('organization_id', prof.organization_id)
      .order('display_name')
    if (search) query = query.ilike('display_name', `%${search}%`)
    const { data } = await query
    setEmployees((data || []) as Profile[])
    setLoading(false)
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ display_name: '', email: '', employee_code: '', password: '' })
    setError(null)
    setSuccess(null)
    setShowDialog(true)
  }

  const openEdit = (emp: Profile) => {
    setEditing(emp)
    setForm({ display_name: emp.display_name, email: emp.email || '', employee_code: emp.employee_code || '', password: '' })
    setError(null)
    setSuccess(null)
    setShowDialog(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data: prof } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!prof?.organization_id) throw new Error('No organization')

      if (editing) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ display_name: form.display_name, employee_code: form.employee_code })
          .eq('user_id', editing.user_id)
        if (updateError) throw updateError
        setSuccess('Employee updated')
      } else {
        if (!form.email || !form.password || !form.display_name) {
          setError('Name, email, and password are required')
          setSaving(false)
          return
        }
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
        const res = await fetch(`${baseUrl}/api/employees`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: form.email,
            password: form.password,
            display_name: form.display_name,
            employee_code: form.employee_code,
            organization_id: prof.organization_id,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to create employee')
        }
        setSuccess('Employee created')
      }
      setShowDialog(false)
      loadEmployees()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (emp: Profile) => {
    if (!confirm(`Remove ${emp.display_name}?`)) return
    await supabase.from('profiles').delete().eq('user_id', emp.user_id)
    loadEmployees()
  }

  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => loadEmployees(), 300)
      return () => clearTimeout(t)
    }
  }, [search])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Employees</h1>
        <button
          onClick={openCreate}
          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Employee
        </button>
      </div>

      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input
          type="text"
          placeholder="Search employees..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</div>
      )}
      {success && (
        <div className="text-sm text-green-700 bg-green-50 p-3 rounded-lg">{success}</div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Email</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Employee Code</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="w-24 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {employees.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-500">No employees found</td></tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp.user_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{emp.display_name}</td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{emp.email}</td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{emp.employee_code || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${emp.role === 'employee' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {emp.role || 'employee'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(emp)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button onClick={() => handleDelete(emp)} className="p-1.5 text-gray-400 hover:text-red-600 rounded">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-semibold">{editing ? 'Edit Employee' : 'Add Employee'}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Display Name</label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                />
              </div>
              {!editing && (
                <>
                  <div>
                    <label className="text-sm font-medium">Email</label>
                    <input
                      type="email"
                      placeholder="john@company.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Password</label>
                    <input
                      type="password"
                      placeholder="Min 6 characters"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="text-sm font-medium">Employee Code</label>
                <input
                  type="text"
                  placeholder="EMP001"
                  value={form.employee_code}
                  onChange={(e) => setForm({ ...form, employee_code: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowDialog(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
