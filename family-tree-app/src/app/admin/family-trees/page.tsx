'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Users, GitFork, Loader2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { FamilyTreeOrganogram } from '@/components/FamilyTreeOrganogram';
import type { Profile } from '@/types';

interface FamilyTree {
  id: string;
  organization_id: string;
  name: string;
  parent_user_id: string;
  created_at: string;
}

interface FamilyTreeChild {
  id: string;
  family_tree_id: string;
  child_user_id: string;
  created_at: string;
}

export default function FamilyTreesPage() {
  const supabase = createClient();
  const [trees, setTrees] = useState<FamilyTree[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
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
      setProfileId(user.id);
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

  const loadEmployees = async () => {
    if (!orgId) return;
    const { data } = await supabase
      .from('profiles')
      .select('user_id, display_name, email, employee_code, role')
      .eq('organization_id', orgId)
      .order('display_name');
    setEmployees((data || []) as Profile[]);
  };

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase.from('family_trees').update(form).eq('id', editing.id);
        if (error) throw error;
        toast.success('Family tree updated');
      } else {
        const { error } = await supabase.from('family_trees').insert({ ...form, organization_id: orgId });
        if (error) throw error;
        toast.success('Family tree created');
      }
      setDialogOpen(false);
      loadTrees();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('family_trees').delete().eq('id', id);
    if (error) { toast.error('Delete failed'); return; }
    toast.success('Family tree deleted');
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
      const { error } = await supabase.from('family_tree_children').insert({
        family_tree_id: selectedTree.id,
        child_user_id: userId,
      }).maybeSingle();
      if (error) { toast.error('Failed to add child'); return; }
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
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Create Family Tree</Button>
      </div>

      {loading ? (
        <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
      ) : trees.length === 0 ? (
        <Card><CardContent className="p-6 text-center"><GitFork className="h-8 w-8 mx-auto text-muted-foreground mb-2" /><p className="text-muted-foreground">No family trees created yet</p></CardContent></Card>
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
                  <TableCell className="text-sm text-muted-foreground">
                    {getParentName(tree)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openOrganogram(tree)} title="View organogram">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openChildren(tree)} title="Manage children">
                        <Users className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(tree)}>
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(tree.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
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
        <DialogContent>
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
              <Select value={form.parent_user_id} onValueChange={(v) => setForm({ ...form, parent_user_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select parent user..." />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.user_id} value={emp.user_id}>
                      {emp.display_name} {emp.employee_code ? `(${emp.employee_code})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.parent_user_id}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedTree} onOpenChange={(o) => { if (!o) setSelectedTree(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Children: {selectedTree?.name}</DialogTitle>
            <DialogDescription>Select team members who clock in as part of this family tree.</DialogDescription>
          </DialogHeader>
          {assignLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <ScrollArea className="h-80">
              <div className="space-y-2">
                {filteredEmployees.map((emp) => (
                  <label key={emp.user_id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer">
                    <Checkbox
                      checked={childAssignments.has(emp.user_id)}
                      onCheckedChange={(c) => toggleChild(emp.user_id, c === true)}
                    />
                    <div>
                      <p className="text-sm font-medium">{emp.display_name}</p>
                      <p className="text-xs text-muted-foreground">{emp.email}</p>
                    </div>
                  </label>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewTree} onOpenChange={(o) => { if (!o) setViewTree(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewTree?.name}</DialogTitle>
          </DialogHeader>
          {viewLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
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
            <p className="text-muted-foreground text-center py-4">Parent user not found</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
