'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Search, MoreHorizontal, UserCog, AlertCircle } from 'lucide-react';
import type { Profile } from '@/types';
import { toast } from 'sonner';

export default function EmployeesPage() {
  const supabase = createClient();
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [form, setForm] = useState({
    display_name: '', email: '', phone: '', employee_code: '',
    role: 'employee' as Profile['role'],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase.from('profiles').select('organization_id').eq('user_id', user.id).single();
      if (prof) setOrgId(prof.organization_id);
    };
    init();
  }, []);

  useEffect(() => { loadEmployees(); }, [search]);

  const loadEmployees = async () => {
    let query = supabase.from('profiles').select('*').order('display_name');
    if (search) query = query.ilike('display_name', `%${search}%`);
    const { data } = await query;
    setEmployees(data as Profile[] || []);
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ display_name: '', email: '', phone: '', employee_code: '', role: 'employee' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase.from('profiles').update(form).eq('user_id', editing.user_id);
        if (error) throw error;
        toast.success('Employee updated');
      } else {
        const { error: signUpError, data } = await supabase.auth.admin.createUser({
          email: form.email, email_confirm: true, user_metadata: { display_name: form.display_name },
        });
        if (signUpError) throw signUpError;
        const { error: profError } = await supabase.from('profiles').insert({
          user_id: data.user!.id, organization_id: orgId, ...form,
          employment_status: 'active',
        });
        if (profError) throw profError;
        toast.success('Employee created');
      }
      setDialogOpen(false);
      loadEmployees();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (userId: string, status: Profile['employment_status']) => {
    const { error } = await supabase.from('profiles').update({ employment_status: status }).eq('user_id', userId);
    if (error) { toast.error('Update failed'); return; }
    toast.success(`Status updated to ${status}`);
    loadEmployees();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Employees</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Add Employee</Button>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search employees..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
      ) : employees.length === 0 ? (
        <Card><CardContent className="p-6 text-center"><UserCog className="h-8 w-8 mx-auto text-muted-foreground mb-2" /><p className="text-muted-foreground">No employees found</p></CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp) => (
                <TableRow key={emp.user_id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{emp.display_name?.charAt(0)?.toUpperCase() || '?'}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{emp.display_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{emp.employee_code || '--'}</TableCell>
                  <TableCell className="text-sm">{emp.email}</TableCell>
                  <TableCell><Badge variant="outline">{emp.role}</Badge></TableCell>
                  <TableCell><Badge variant={emp.employment_status === 'active' ? 'success' : emp.employment_status === 'suspended' ? 'warning' : 'secondary'}>{emp.employment_status}</Badge></TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditing(emp); setForm({ display_name: emp.display_name, email: emp.email, phone: emp.phone || '', employee_code: emp.employee_code || '', role: emp.role }); setDialogOpen(true); }}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateStatus(emp.user_id, 'active')}>Set Active</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateStatus(emp.user_id, 'suspended')}>Suspend</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateStatus(emp.user_id, 'terminated')}>Terminate</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
            <DialogTitle>{editing ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
            <DialogDescription>{editing ? 'Update employee details' : 'Create a new employee account'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
            </div>
            {!editing && (
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Employee Code</Label>
              <Input value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Profile['role'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="org_admin">Org Admin</SelectItem>
                  <SelectItem value="finance_admin">Finance Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.display_name}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
