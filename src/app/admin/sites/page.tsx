'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { LocationMapPicker } from '@/components/LocationMapPicker';
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
import { Plus, Search, Pencil, Trash2, MapPin, Users, X } from 'lucide-react';
import type { Site, Profile } from '@/types';
import { toast } from 'sonner';
import { makePointGeog, parseWktPoint } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export default function SitesPage() {
  const supabase = createClient();
  const [sites, setSites] = useState<Site[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Site | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [assignedUsers, setAssignedUsers] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: '', address: '', latitude: -26.2041, longitude: 28.0473,
    timezone: 'Africa/Johannesburg', active: true,
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

  useEffect(() => { loadSites(); }, [search]);

  const loadSites = async () => {
    let query = supabase.from('sites').select('*, center_geog').order('name');
    if (search) query = query.ilike('name', `%${search}%`);
    const { data } = await query;
    setSites((data || []).map((s) => {
      const coords = (s as unknown as { center_geog?: string }).center_geog ? parseWktPoint((s as unknown as { center_geog?: string }).center_geog!) : null;
      return { ...s, latitude: coords?.latitude ?? 0, longitude: coords?.longitude ?? 0 };
    }) as Site[]);
    setLoading(false);
  };

  const loadEmployees = async () => {
    if (!orgId) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('organization_id', orgId)
      .order('display_name');
    setEmployees(data || []);
  };

  const loadAssignedUsers = async (siteId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('home_site_id', siteId);
    setAssignedUsers((data || []).map((p) => p.user_id));
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', address: '', latitude: -26.2041, longitude: 28.0473, timezone: 'Africa/Johannesburg', active: true });
    setAssignedUsers([]);
    loadEmployees();
    setDialogOpen(true);
  };

  const openEdit = (s: Site) => {
    setEditing(s);
    const parsed = (s as unknown as { center_geog?: string }).center_geog;
    const coords = parsed ? parseWktPoint(parsed) : null;
    setForm({
      name: s.name, address: s.address || '',
      latitude: coords?.latitude ?? -26.2041, longitude: coords?.longitude ?? 28.0473,
      timezone: s.timezone || 'Africa/Johannesburg', active: s.active,
    });
    loadEmployees();
    loadAssignedUsers(s.id);
    setDialogOpen(true);
  };

  const toggleUser = (userId: string) => {
    setAssignedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);
    const payload = {
      organization_id: orgId, name: form.name, address: form.address,
      center_geog: makePointGeog(form.longitude, form.latitude),
      timezone: form.timezone, active: form.active,
    };

    let siteId = editing?.id;
    if (editing) {
      const { error } = await supabase.from('sites').update(payload).eq('id', editing.id);
      if (error) { toast.error('Update failed'); setSaving(false); return; }
      toast.success('Site updated');
    } else {
      const { data, error } = await supabase.from('sites').insert(payload).select('id').single();
      if (error) { toast.error('Create failed'); setSaving(false); return; }
      siteId = data.id;
      toast.success('Site created');
    }

    if (siteId) {
      const { data: allOrgUsers } = await supabase
        .from('profiles')
        .select('user_id, home_site_id')
        .eq('organization_id', orgId);

      for (const u of allOrgUsers || []) {
        const shouldAssign = assignedUsers.includes(u.user_id);
        const currentSite = u.home_site_id;
        if (shouldAssign && currentSite !== siteId) {
          await supabase.from('profiles').update({ home_site_id: siteId }).eq('user_id', u.user_id);
        } else if (!shouldAssign && currentSite === siteId) {
          await supabase.from('profiles').update({ home_site_id: null }).eq('user_id', u.user_id);
        }
      }
    }

    setDialogOpen(false);
    setSaving(false);
    loadSites();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this site? Users assigned here will lose their site assignment.')) return;
    await supabase.from('profiles').update({ home_site_id: null }).eq('home_site_id', id);
    const { error } = await supabase.from('sites').delete().eq('id', id);
    if (error) { toast.error('Delete failed'); return; }
    toast.success('Site deleted');
    loadSites();
  };

  const getAssignedCount = (siteId: string) => employees.filter((e) => e.home_site_id === siteId).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sites</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Create Site</Button>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search sites..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
      ) : sites.length === 0 ? (
        <Card><CardContent className="p-6 text-center"><MapPin className="h-8 w-8 mx-auto text-muted-foreground mb-2" /><p className="text-muted-foreground">No sites found</p></CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Coordinates</TableHead>
                <TableHead>People</TableHead>
                <TableHead>Timezone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sites.map((site) => (
                <TableRow key={site.id}>
                  <TableCell className="font-medium">{site.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{site.address || '--'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}</TableCell>
                  <TableCell><Badge variant="secondary"><Users className="h-3 w-3 mr-1" />{getAssignedCount(site.id)}</Badge></TableCell>
                  <TableCell>{site.timezone || '--'}</TableCell>
                  <TableCell><Badge variant={site.active ? 'success' : 'secondary'}>{site.active ? 'Active' : 'Inactive'}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(site)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(site.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Site' : 'Create Site'}</DialogTitle>
            <DialogDescription>Search for a location on the map or type an address</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addr">Address</Label>
                <Input id="addr" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
            </div>

            <div>
              <Label>Location</Label>
              <LocationMapPicker
                latitude={form.latitude}
                longitude={form.longitude}
                onLocationChange={(lat, lng) => setForm({ ...form, latitude: lat, longitude: lng })}
                height="300px"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tz2">Timezone</Label>
                <Select value={form.timezone} onValueChange={(v) => setForm({ ...form, timezone: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Africa/Johannesburg">Africa/Johannesburg</SelectItem>
                    <SelectItem value="Africa/Lagos">Africa/Lagos</SelectItem>
                    <SelectItem value="Africa/Cairo">Africa/Cairo</SelectItem>
                    <SelectItem value="America/New_York">America/New_York</SelectItem>
                    <SelectItem value="Europe/London">Europe/London</SelectItem>
                    <SelectItem value="Asia/Dubai">Asia/Dubai</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 pb-2">
                <Switch id="active" checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                <Label htmlFor="active">Active</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Users className="h-4 w-4" /> Assign Employees</Label>
              <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-1">
                {employees.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No employees found</p>
                ) : employees.map((emp) => (
                  <label
                    key={emp.user_id}
                    className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                      assignedUsers.includes(emp.user_id) ? 'bg-primary/10' : 'hover:bg-accent'
                    }`}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {(emp.display_name || emp.email || '??').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{emp.display_name || 'Unnamed'}</p>
                      <p className="text-xs text-muted-foreground truncate">{emp.email} &middot; {emp.role}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={assignedUsers.includes(emp.user_id)}
                      onChange={() => toggleUser(emp.user_id)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
