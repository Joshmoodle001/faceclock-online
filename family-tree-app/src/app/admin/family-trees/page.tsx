'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FamilyTreeOrganogram } from '@/components/FamilyTreeOrganogram';
import {
  Button, Card, CardContent, Input, Label, Badge, Skeleton,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Checkbox, ScrollArea,
} from '@/components/ui';
import type { FamilyTree, FamilyTreeChild, Profile } from '@/types';

export default function FamilyTreesPage() {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const [trees, setTrees] = useState<FamilyTree[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const isSuper = role === 'super_admin';

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FamilyTree | null>(null);
  const [form, setForm] = useState({ name: '', parent_user_id: '' });
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<Profile[]>([]);

  const [selectedTree, setSelectedTree] = useState<FamilyTree | null>(null);
  const [children, setChildren] = useState<FamilyTreeChild[]>([]);
  const [childAssignments, setChildAssignments] = useState<Set<string>>(new Set());
  const [assignLoading, setAssignLoading] = useState(false);

  const [viewTree, setViewTree] = useState<FamilyTree | null>(null);
  const [viewChildren, setViewChildren] = useState<FamilyTreeChild[]>([]);
  const [viewParent, setViewParent] = useState<Profile | null>(null);
  const [viewChildProfiles, setViewChildProfiles] = useState<Map<string, Profile>>(new Map());
  const [viewLoading, setViewLoading] = useState(false);
  const [recentClockEvents, setRecentClockEvents] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase.from('profiles').select('organization_id, role').eq('user_id', user.id).single();
      if (prof) { setOrgId(prof.organization_id); setRole(prof.role); }
    };
    init();
  }, []);

  useEffect(() => { if (isSuper || orgId) loadTrees(); }, [orgId, isSuper]);

  const loadTrees = async () => {
    if (!isSuper && !orgId) return;
    let query = supabase.from('family_trees').select('*').order('created_at', { ascending: false });
    if (!isSuper && orgId) query = query.eq('organization_id', orgId);
    const { data } = await query;
    setTrees(data || []);
    setLoading(false);
  };

  const loadEmployees = async () => {
    if (!orgId) return;
    const { data } = await supabase
      .from('profiles')
      .select('user_id, display_name, email, employee_code, role')
      .eq('organization_id', orgId)
      .order('display_name');
    setEmployees((data || []) as Profile[]);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', parent_user_id: '' });
    loadEmployees();
    setDialogOpen(true);
  };

  const openEdit = (tree: FamilyTree) => {
    setEditing(tree);
    setForm({ name: tree.name, parent_user_id: tree.parent_user_id });
    loadEmployees();
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase.from('family_trees').update(form).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('family_trees').insert({ ...form, organization_id: orgId });
        if (error) throw error;
      }
      setDialogOpen(false);
      loadTrees();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('family_trees').delete().eq('id', id);
    loadTrees();
  };

  const openChildren = async (tree: FamilyTree) => {
    setSelectedTree(tree);
    setAssignLoading(true);
    if (employees.length === 0) await loadEmployees();

    const { data: kids } = await supabase
      .from('family_tree_children')
      .select('*')
      .eq('family_tree_id', tree.id);
    setChildren(kids || []);
    setChildAssignments(new Set((kids || []).map((k: FamilyTreeChild) => k.child_user_id)));
    setAssignLoading(false);
  };

  const toggleChild = async (userId: string, checked: boolean) => {
    if (!selectedTree) return;
    const newSet = new Set(childAssignments);
    if (checked) {
      newSet.add(userId);
      await supabase.from('family_tree_children').insert({
        family_tree_id: selectedTree.id,
        child_user_id: userId,
      }).maybeSingle();
    } else {
      newSet.delete(userId);
      await supabase.from('family_tree_children')
        .delete()
        .eq('family_tree_id', selectedTree.id)
        .eq('child_user_id', userId);
    }
    setChildAssignments(newSet);
  };

  const openOrganogram = async (tree: FamilyTree) => {
    setViewTree(tree);
    setViewLoading(true);
    const { data: kids } = await supabase
      .from('family_tree_children')
      .select('*')
      .eq('family_tree_id', tree.id);
    setViewChildren(kids || []);

    const { data: parent } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', tree.parent_user_id)
      .single();
    setViewParent(parent as Profile || null);

    const allIds = [tree.parent_user_id, ...(kids || []).map((k: FamilyTreeChild) => k.child_user_id)];
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('*')
      .in('user_id', allIds);
    const profMap = new Map<string, Profile>();
    (allProfiles || []).forEach((p: Profile) => profMap.set(p.user_id, p));
    setViewChildProfiles(profMap);

    const today = new Date().toISOString().split('T')[0];
    const { data: events } = await supabase
      .from('clock_events')
      .select('user_id')
      .in('user_id', allIds)
      .gte('occurred_at', today)
      .eq('event_type', 'clock_in')
      .not('decision', 'eq', 'rejected');
    const clockedMap = new Map<string, boolean>();
    (events || []).forEach((e: { user_id: string }) => clockedMap.set(e.user_id, true));
    setRecentClockEvents(clockedMap);
    setViewLoading(false);
  };

  const getParentName = (tree: FamilyTree) => {
    const p = employees.find(e => e.user_id === tree.parent_user_id);
    return p?.display_name || '(deleted user)';
  };

  const filteredEmployees = employees.filter(e => e.user_id !== (selectedTree?.parent_user_id || editing?.parent_user_id));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Family Trees</h1>
        <Button onClick={openCreate}>
          <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Create Family Tree
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
      ) : trees.length === 0 ? (
        <Card><CardContent className="p-6 text-center"><svg className="h-8 w-8 mx-auto text-gray-400 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="2"/><path d="M12 7v6"/><circle cx="12" cy="17" r="2"/></svg><p className="text-gray-500">No family trees created yet</p></CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trees.map((tree) => (
                <TableRow key={tree.id}>
                  <TableCell className="font-medium">{tree.name}</TableCell>
                  <TableCell className="text-sm text-gray-500">{getParentName(tree)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openOrganogram(tree)}>
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openChildren(tree)}>
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(tree)}>
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(tree.id)}>
                        <svg className="h-4 w-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Family Tree' : 'Create Family Tree'}</DialogTitle>
          <DialogDescription>
            Define a parent and assign children for family-style drop-off clock-ins.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tree Name</Label>
            <Input placeholder="e.g. Smith Family" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Parent / Guardian</Label>
            <select
              value={form.parent_user_id}
              onChange={(e) => setForm({ ...form, parent_user_id: e.target.value })}
              className="border rounded-md px-3 py-2 text-sm bg-white w-full"
            >
              <option value="">Select parent user...</option>
              {employees.map((emp) => (
                <option key={emp.user_id} value={emp.user_id}>
                  {emp.display_name} {emp.employee_code ? `(${emp.employee_code})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.name || !form.parent_user_id}>Save</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={!!selectedTree} onOpenChange={(o) => { if (!o) setSelectedTree(null); }}>
        <DialogHeader>
          <DialogTitle>Children: {selectedTree?.name}</DialogTitle>
          <DialogDescription>Select team members who clock in as part of this family tree.</DialogDescription>
        </DialogHeader>
        {assignLoading ? (
          <div className="flex items-center justify-center py-8">
            <svg className="h-6 w-6 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="31.4 31.4"/></svg>
          </div>
        ) : (
          <ScrollArea className="h-80">
            <div className="space-y-2">
              {filteredEmployees.map((emp) => (
                <label key={emp.user_id} className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer">
                  <Checkbox
                    checked={childAssignments.has(emp.user_id)}
                    onCheckedChange={(c) => toggleChild(emp.user_id, c)}
                  />
                  <div>
                    <p className="text-sm font-medium">{emp.display_name}</p>
                    <p className="text-xs text-gray-500">{emp.email}</p>
                  </div>
                </label>
              ))}
            </div>
          </ScrollArea>
        )}
      </Dialog>

      <Dialog open={!!viewTree} onOpenChange={(o) => { if (!o) setViewTree(null); }}>
        <DialogHeader>
          <DialogTitle>{viewTree?.name}</DialogTitle>
        </DialogHeader>
        {viewLoading ? (
          <div className="flex items-center justify-center py-8">
            <svg className="h-6 w-6 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="31.4 31.4"/></svg>
          </div>
        ) : viewParent ? (
          <FamilyTreeOrganogram
            parentName={viewParent.display_name}
            parentCode={viewParent.employee_code}
            parentClockedIn={recentClockEvents.has(viewParent.user_id)}
            members={viewChildren.map((c) => {
              const cp = viewChildProfiles.get(c.child_user_id);
              return {
                user_id: c.child_user_id,
                display_name: cp?.display_name || '(deleted)',
                employee_code: cp?.employee_code,
                clocked_in: recentClockEvents.has(c.child_user_id),
              };
            })}
          />
        ) : (
          <p className="text-gray-500 text-center py-4">Parent user not found</p>
        )}
      </Dialog>
    </div>
  );
}
