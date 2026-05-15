'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Search, Pencil, Trash2, AlertCircle } from 'lucide-react';
import type { Organization } from '@/types';
import { toast } from 'sonner';

export default function OrganizationsPage() {
  const supabase = createClient();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Organization | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', default_timezone: 'Africa/Johannesburg', currency: 'ZAR', status: 'active' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadOrgs(); }, [search]);

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
    setDialogOpen(true);
  };

  const openEdit = (org: Organization) => {
    setEditing(org);
    setForm({ name: org.name, slug: org.slug, default_timezone: org.default_timezone, currency: org.currency, status: org.status });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    if (editing) {
      const { error } = await supabase.from('organizations').update(form).eq('id', editing.id);
      if (error) { toast.error('Update failed'); setSaving(false); return; }
      toast.success('Organization updated');
    } else {
      const { error } = await supabase.from('organizations').insert(form);
      if (error) { toast.error('Create failed'); setSaving(false); return; }
      toast.success('Organization created');
    }
    setDialogOpen(false);
    setSaving(false);
    loadOrgs();
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Organization' : 'Create Organization'}</DialogTitle>
            <DialogDescription>{editing ? 'Update organization details' : 'Add a new organization'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.slug}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
