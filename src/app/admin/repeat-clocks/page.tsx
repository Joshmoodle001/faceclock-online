'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, Users, Repeat, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Profile, RepeatClockRule } from '@/types';

export default function RepeatClocksPage() {
  const supabase = createClient();
  const [rules, setRules] = useState<RepeatClockRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RepeatClockRule | null>(null);
  const [form, setForm] = useState({ name: '', interval_minutes: 60 });
  const [saving, setSaving] = useState(false);
  const [selectedRule, setSelectedRule] = useState<RepeatClockRule | null>(null);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [assignments, setAssignments] = useState<Set<string>>(new Set());
  const [assignLoading, setAssignLoading] = useState(false);
  const [applyAllDialog, setApplyAllDialog] = useState(false);
  const [removeAllDialog, setRemoveAllDialog] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase.from('profiles').select('organization_id').eq('user_id', user.id).single();
      if (prof) setOrgId(prof.organization_id);
    };
    init();
  }, []);

  useEffect(() => { if (orgId) loadRules(); }, [orgId]);

  const loadRules = async () => {
    if (!orgId) return;
    const { data } = await supabase.from('repeat_clock_rules').select('*').eq('organization_id', orgId).order('created_at', { ascending: false });
    setRules(data || []);
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', interval_minutes: 60 });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase.from('repeat_clock_rules').update(form).eq('id', editing.id);
        if (error) throw error;
        toast.success('Repeat clock rule updated');
      } else {
        const { error } = await supabase.from('repeat_clock_rules').insert({ ...form, organization_id: orgId });
        if (error) throw error;
        toast.success('Repeat clock rule created');
      }
      setDialogOpen(false);
      loadRules();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('repeat_clock_rules').delete().eq('id', id);
    if (error) { toast.error('Delete failed'); return; }
    toast.success('Repeat clock rule deleted');
    loadRules();
  };

  const toggleActive = async (rule: RepeatClockRule) => {
    const { error } = await supabase.from('repeat_clock_rules').update({ active: !rule.active }).eq('id', rule.id);
    if (error) { toast.error('Update failed'); return; }
    toast.success(rule.active ? 'Rule deactivated' : 'Rule activated');
    loadRules();
  };

  const openAssignments = async (rule: RepeatClockRule) => {
    setSelectedRule(rule);
    setAssignLoading(true);
    const { data: emps } = await supabase
      .from('profiles')
      .select('user_id, display_name, email, employee_code, role')
      .eq('organization_id', rule.organization_id)
      .order('display_name');
    setEmployees((emps || []) as Profile[]);

    const { data: assigned } = await supabase
      .from('user_repeat_clock_assignments')
      .select('user_id')
      .eq('rule_id', rule.id);
    setAssignments(new Set((assigned || []).map((a: { user_id: string }) => a.user_id)));
    setAssignLoading(false);
  };

  const toggleAssignment = async (userId: string, checked: boolean) => {
    if (!selectedRule || !orgId) return;
    const newSet = new Set(assignments);
    if (checked) {
      newSet.add(userId);
      await supabase.from('user_repeat_clock_assignments').insert({
        rule_id: selectedRule.id,
        user_id: userId,
        organization_id: orgId,
      }).maybeSingle();
    } else {
      newSet.delete(userId);
      await supabase.from('user_repeat_clock_assignments')
        .delete()
        .eq('rule_id', selectedRule.id)
        .eq('user_id', userId);
    }
    setAssignments(newSet);
  };

  const applyToAll = async () => {
    if (!selectedRule || !orgId) return;
    setApplyAllDialog(false);
    const unassigned = employees.filter(e => !assignments.has(e.user_id));
    for (const emp of unassigned) {
      await supabase.from('user_repeat_clock_assignments').insert({
        rule_id: selectedRule.id,
        user_id: emp.user_id,
        organization_id: orgId,
      }).maybeSingle();
    }
    setAssignments(new Set(employees.map(e => e.user_id)));
    toast.success(`Assigned to all ${unassigned.length} employees`);
  };

  const removeFromAll = async () => {
    if (!selectedRule || !orgId) return;
    setRemoveAllDialog(false);
    await supabase.from('user_repeat_clock_assignments')
      .delete()
      .eq('rule_id', selectedRule.id);
    setAssignments(new Set());
    toast.success('Removed from all employees');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Repeat Clocks</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Add Rule</Button>
      </div>

      {loading ? (
        <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
      ) : rules.length === 0 ? (
        <Card><CardContent className="p-6 text-center"><Repeat className="h-8 w-8 mx-auto text-muted-foreground mb-2" /><p className="text-muted-foreground">No repeat clock rules created yet</p></CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Interval</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned Employees</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    Every {rule.interval_minutes} minute{rule.interval_minutes !== 1 ? 's' : ''}
                  </TableCell>
                  <TableCell>
                    <Badge variant={rule.active ? 'success' : 'secondary'}>
                      {rule.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => openAssignments(rule)}>
                      <Users className="h-4 w-4 mr-2" /> Manage
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(rule); setForm({ name: rule.name, interval_minutes: rule.interval_minutes }); setDialogOpen(true); }}>
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id)}>
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
            <DialogTitle>{editing ? 'Edit Repeat Clock Rule' : 'Add Repeat Clock Rule'}</DialogTitle>
            <DialogDescription>
              Configure a rule that forces employees to re-clock-in at regular intervals during their shift.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Rule Name</Label>
              <Input placeholder="e.g. Hourly Re-Verification" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Interval (minutes)</Label>
              <Input type="number" min={1} placeholder="60" value={form.interval_minutes} onChange={(e) => setForm({ ...form, interval_minutes: parseInt(e.target.value) || 0 })} />
              <p className="text-xs text-muted-foreground">Employees will be prompted to re-clock-in every X minutes.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name || form.interval_minutes < 1}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedRule} onOpenChange={(o) => { if (!o) setSelectedRule(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign: {selectedRule?.name}</DialogTitle>
            <DialogDescription>Select employees who must re-clock-in at the configured interval.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mb-4">
            <Button size="sm" variant="outline" onClick={() => setApplyAllDialog(true)}>Apply to All</Button>
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => setRemoveAllDialog(true)}>Remove from All</Button>
          </div>
          {assignLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <ScrollArea className="h-80">
              <div className="space-y-2">
                {employees.map((emp) => (
                  <label key={emp.user_id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer">
                    <Checkbox checked={assignments.has(emp.user_id)} onCheckedChange={(c) => toggleAssignment(emp.user_id, c === true)} />
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

      <Dialog open={applyAllDialog} onOpenChange={setApplyAllDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply to All Employees?</DialogTitle>
            <DialogDescription>
              This will assign this repeat clock rule to every active employee in your organization. Are you sure?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyAllDialog(false)}>Cancel</Button>
            <Button onClick={applyToAll}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={removeAllDialog} onOpenChange={setRemoveAllDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove from All Employees?</DialogTitle>
            <DialogDescription>
              This will remove this repeat clock rule from every employee. Are you sure?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveAllDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={removeFromAll}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
