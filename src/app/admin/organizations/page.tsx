'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Search, Pencil, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import type { Organization } from '@/types';
import { toast } from 'sonner';

export default function OrganizationsPage() {
  const router = useRouter();
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push('/login'); return; }
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();
        if (!profile || profile.role !== 'super_admin') { router.push('/admin/dashboard'); return; }
      } catch {
        router.push('/login');
        return;
      }
      setLoading(false);
      loadOrgs();
    };
    init();
  }, []);

  useEffect(() => {
    if (!loading) loadOrgs();
  }, [search]);

  const loadOrgs = async () => {
    let query = supabase.from('organizations').select('*').order('name');
    if (search) query = query.ilike('name', `%${search}%`);
    const { data } = await query;
    setOrgs(data || []);
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', slug: '', default_timezone: 'Africa/Johannesburg', currency: 'ZAR', status: 'active' });
    setAdminForm({ email: '', displayName: '', password: '' });
    setDialogOpen(true);
  };

  const openEdit = (org: Organization) => {
    setEditing(org);
    setForm({ name: org.name, slug: org.slug, default_timezone: org.default_timezone, currency: org.currency, status: org.status });
    setAdminForm({ email: '', displayName: '', password: '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase.from('organizations').update(form).eq('id', editing.id);
        if (error) throw new Error(error.message);
        toast.success('Organization updated');
      } else {
        const slug = form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
        if (!adminForm.email || !adminForm.displayName || !adminForm.password) {
          toast.error('Admin email, name, and password are required');
          setSaving(false);
          return;
        }
        const res = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orgName: form.name,
            slug,
            default_timezone: form.default_timezone,
            currency: form.currency,
            email: adminForm.email,
            password: adminForm.password,
            displayName: adminForm.displayName,
          }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Failed to create organization');
        toast.success('Organization and admin account created');
      }
      setDialogOpen(false);
      loadOrgs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this organization? This action cannot be undone.')) return;
    const { error } = await supabase.from('organizations').delete().eq('id', id);
    if (error) { toast.error('Delete failed'); return; }
    toast.success('Organization deleted');
    loadOrgs();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Organizations</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Create</Button>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search organizations..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
      ) : orgs.length === 0 ? (
        <Card><CardContent className="p-6 text-center"><AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" /><p className="text-muted-foreground">No organizations found</p></CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Timezone</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgs.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium">{org.name}</TableCell>
                  <TableCell>{org.slug}</TableCell>
                  <TableCell>{org.default_timezone}</TableCell>
                  <TableCell>{org.currency}</TableCell>
                  <TableCell><Badge variant={org.status === 'active' ? 'success' : 'secondary'}>{org.status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(org)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(org.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[85vh]">
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Organization' : 'Create Organization'}</DialogTitle>
              <DialogDescription>{editing ? 'Update organization details' : 'Create a new organization and its main admin account'}</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: editing ? form.slug : e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tz">Timezone</Label>
              <Select value={form.default_timezone} onValueChange={(v) => setForm({ ...form, default_timezone: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Africa/Johannesburg">Africa/Johannesburg</SelectItem>
                  <SelectItem value="Africa/Lagos">Africa/Lagos</SelectItem>
                  <SelectItem value="Africa/Nairobi">Africa/Nairobi</SelectItem>
                  <SelectItem value="Africa/Cairo">Africa/Cairo</SelectItem>
                  <SelectItem value="America/New_York">America/New_York</SelectItem>
                  <SelectItem value="Europe/London">Europe/London</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ZAR">ZAR (R)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (&euro;)</SelectItem>
                  <SelectItem value="GBP">GBP (&pound;)</SelectItem>
                  <SelectItem value="NGN">NGN (&#8358;)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!editing && (
              <>
                <Separator />
                <p className="text-sm font-medium">Main Admin Account</p>
                <p className="text-xs text-muted-foreground -mt-3">This account will be the org_admin for this organization.</p>
                <div className="space-y-2">
                  <Label htmlFor="adminName">Admin Name</Label>
                  <Input id="adminName" placeholder="John Doe" value={adminForm.displayName} onChange={(e) => setAdminForm({ ...adminForm, displayName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminEmail">Admin Email</Label>
                  <Input id="adminEmail" type="email" placeholder="admin@company.com" value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminPassword">Admin Password</Label>
                  <Input id="adminPassword" type="password" placeholder="••••••••" value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} />
                </div>
              </>
            )}
            </div>
            </ScrollArea>
            <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
