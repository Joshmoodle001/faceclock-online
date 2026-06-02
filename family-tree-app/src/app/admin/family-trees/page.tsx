'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FamilyTreeOrganogram } from '@/components/FamilyTreeOrganogram'

interface Tree { id: string; organization_id: string; name: string; parent_user_id: string; created_at: string }
interface TreeChild { id: string; family_tree_id: string; child_user_id: string }
interface Emp { user_id: string; display_name: string; email?: string; employee_code?: string }

export default function FamilyTreesPage() {
  const supabase = createClient()
  const [trees, setTrees] = useState<Tree[]>([])
  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [employees, setEmployees] = useState<Emp[]>([])
  const [dialog, setDialog] = useState(false)
  const [editTree, setEditTree] = useState<Tree | null>(null)
  const [formName, setFormName] = useState('')
  const [formParent, setFormParent] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  const [selectedTree, setSelectedTree] = useState<Tree | null>(null)
  const [children, setChildren] = useState<TreeChild[]>([])
  const [childAssignments, setChildAssignments] = useState<Set<string>>(new Set())
  const [childrenLoading, setChildrenLoading] = useState(false)

  const [viewTree, setViewTree] = useState<Tree | null>(null)
  const [viewData, setViewData] = useState<any>(null)
  const [viewLoading, setViewLoading] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser(); if (!user) return
      const { data: prof } = await supabase.from('profiles').select('organization_id').eq('user_id', user.id).maybeSingle()
      if (!prof?.organization_id) { setLoading(false); return }
      setOrgId(prof.organization_id)
      loadTrees(prof.organization_id)
      const { data: emps } = await supabase.from('profiles').select('user_id,display_name,email,employee_code').eq('organization_id', prof.organization_id).order('display_name')
      setEmployees((emps || []) as Emp[])
      setLoading(false)
    }
    init()
  }, [])

  const loadTrees = async (oid: string) => {
    const { data } = await supabase.from('family_trees').select('*').eq('organization_id', oid).order('created_at', { ascending: false })
    setTrees((data || []) as Tree[])
  }

  const openAdd = () => { setEditTree(null); setFormName(''); setFormParent(''); setMsg(null); setDialog(true) }
  const openEdit = (t: Tree) => { setEditTree(t); setFormName(t.name); setFormParent(t.parent_user_id); setMsg(null); setDialog(true) }

  const save = async () => {
    if (!orgId || !formName || !formParent) { setMsg({ type: 'error', text: 'Name and parent required' }); return }
    setSaving(true); setMsg(null)
    try {
      if (editTree) {
        await supabase.from('family_trees').update({ name: formName, parent_user_id: formParent }).eq('id', editTree.id)
        setMsg({ type: 'success', text: 'Updated' })
      } else {
        await supabase.from('family_trees').insert({ name: formName, parent_user_id: formParent, organization_id: orgId })
        setMsg({ type: 'success', text: 'Created' })
      }
      setDialog(false); loadTrees(orgId)
    } catch (err: any) { setMsg({ type: 'error', text: err.message || 'Failed' })
    } finally { setSaving(false) }
  }

  const remove = async (t: Tree) => { if (confirm(`Delete ${t.name}?`)) { await supabase.from('family_trees').delete().eq('id', t.id); loadTrees(orgId!) } }

  const manageChildren = async (tree: Tree) => {
    setSelectedTree(tree); setChildrenLoading(true)
    const { data: kids } = await supabase.from('family_tree_children').select('*').eq('family_tree_id', tree.id)
    setChildren(kids || [])
    setChildAssignments(new Set((kids || []).map((k: TreeChild) => k.child_user_id)))
    setChildrenLoading(false)
  }

  const toggleChild = async (userId: string, add: boolean) => {
    if (!selectedTree) return
    const newSet = new Set(childAssignments)
    if (add) { newSet.add(userId); await supabase.from('family_tree_children').insert({ family_tree_id: selectedTree.id, child_user_id: userId }).maybeSingle() }
    else { newSet.delete(userId); await supabase.from('family_tree_children').delete().eq('family_tree_id', selectedTree.id).eq('child_user_id', userId) }
    setChildAssignments(newSet)
  }

  const viewOrganogram = async (tree: Tree) => {
    setViewTree(tree); setViewLoading(true)
    const { data: kids } = await supabase.from('family_tree_children').select('*').eq('family_tree_id', tree.id)
    const allIds = [tree.parent_user_id, ...(kids || []).map((k: TreeChild) => k.child_user_id)]
    const { data: profiles } = await supabase.from('profiles').select('user_id,display_name,employee_code').in('user_id', allIds)
    const profMap = new Map((profiles || []).map((p: any) => [p.user_id, p]))
    const today = new Date().toISOString().split('T')[0]
    const { data: events } = await supabase.from('clock_events').select('user_id').in('user_id', allIds).gte('occurred_at', today).eq('event_type', 'clock_in')
    const clocked = new Set((events || []).map((e: any) => e.user_id))
    const parent = profMap.get(tree.parent_user_id)
    setViewData({
      parentName: parent?.display_name || '(deleted)',
      parentCode: parent?.employee_code,
      parentClockedIn: clocked.has(tree.parent_user_id),
      members: (kids || []).map((k: TreeChild) => { const p = profMap.get(k.child_user_id); return { user_id: k.child_user_id, display_name: p?.display_name || '(deleted)', employee_code: p?.employee_code, clocked_in: clocked.has(k.child_user_id) } }),
    })
    setViewLoading(false)
  }

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>

  const getParentName = (t: Tree) => employees.find(e => e.user_id === t.parent_user_id)?.display_name || '(deleted)'
  const filteredEmployees = employees.filter(e => e.user_id !== (selectedTree?.parent_user_id || editTree?.parent_user_id))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Family Trees</h1>
        <button onClick={openAdd} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700">Create Family Tree</button>
      </div>
      {msg && <div className={`text-sm p-3 rounded-lg ${msg.type === 'error' ? 'text-red-600 bg-red-50' : 'text-green-700 bg-green-50'}`}>{msg.text}</div>}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50"><th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Name</th><th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Parent</th><th className="w-32 px-4 py-3" /></tr></thead>
          <tbody className="divide-y">
            {trees.length === 0 ? <tr><td colSpan={3} className="p-8 text-center text-gray-500">No family trees</td></tr> :
            trees.map(t => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{t.name}</td>
                <td className="px-4 py-3 text-gray-500">{getParentName(t)}</td>
                <td className="px-4 py-3 flex gap-1">
                  <button onClick={() => viewOrganogram(t)} className="p-1 text-gray-400 hover:text-blue-600"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
                  <button onClick={() => manageChildren(t)} className="p-1 text-gray-400 hover:text-blue-600"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/></svg></button>
                  <button onClick={() => openEdit(t)} className="p-1 text-gray-400 hover:text-blue-600"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/></svg></button>
                  <button onClick={() => remove(t)} className="p-1 text-gray-400 hover:text-red-600"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
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
            <h2 className="text-lg font-semibold">{editTree ? 'Edit' : 'Create'} Family Tree</h2>
            <div><label className="text-sm font-medium">Tree Name</label><input type="text" value={formName} onChange={e => setFormName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" /></div>
            <div><label className="text-sm font-medium">Parent / Guardian</label><select value={formParent} onChange={e => setFormParent(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm mt-1 bg-white"><option value="">Select...</option>{employees.map(e => <option key={e.user_id} value={e.user_id}>{e.display_name} {e.employee_code ? `(${e.employee_code})` : ''}</option>)}</select></div>
            <div className="flex justify-end gap-2"><button onClick={() => setDialog(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button><button onClick={save} disabled={saving || !formName || !formParent} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button></div>
          </div>
        </div>
      )}

      {selectedTree && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-lg font-semibold">Children: {selectedTree.name}</h2>
            {childrenLoading ? <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-4 border-blue-600 border-t-transparent rounded-full" /></div> :
            <div className="max-h-80 overflow-y-auto space-y-2">
              {filteredEmployees.map(e => (
                <label key={e.user_id} className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={childAssignments.has(e.user_id)} onChange={ev => toggleChild(e.user_id, ev.target.checked)} className="h-4 w-4" />
                  <div><p className="text-sm font-medium">{e.display_name}</p><p className="text-xs text-gray-500">{e.email}</p></div>
                </label>
              ))}
            </div>}
            <button onClick={() => setSelectedTree(null)} className="w-full border rounded-lg py-2 text-sm hover:bg-gray-50">Close</button>
          </div>
        </div>
      )}

      {viewTree && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-lg font-semibold">{viewTree.name}</h2>
            {viewLoading ? <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-4 border-blue-600 border-t-transparent rounded-full" /></div> :
            viewData ? <FamilyTreeOrganogram {...viewData} /> : <p className="text-gray-500 text-center py-4">No data</p>}
            <button onClick={() => setViewTree(null)} className="w-full border rounded-lg py-2 text-sm hover:bg-gray-50">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
