'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Plus, Search, Pencil, Trash2, Circle, AlertCircle } from 'lucide-react';
import type { Geofence } from '@/types';
import { toast } from 'sonner';
import { makePointGeog, parseWktPoint } from '@/lib/utils';

export default function GeofencesPage() {
  const supabase = createClient();
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Geofence | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    site_id: '', name: '', type: 'circle' as 'circle' | 'polygon',
    latitude: 0, longitude: 0, radius_m: 100,
    polygon_coordinates: '' as string,
    accuracy_threshold_m: 25, grace_distance_m: 10,
    active: true,
  });

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase.from('profiles').select('organization_id').eq('user_id', user.id).single();
      if (prof) setOrgId(prof.organization_id);
      const { data: s } = await supabase.from('sites').select('id,name');
      setSites(s || []);
    };
    init();
  }, []);

  useEffect(() => { loadGeofences(); }, [search]);

  const loadGeofences = async () => {
    let query = supabase.from('geofences').select('*, sites(name), center_geog').order('name');
    if (search) query = query.ilike('name', `%${search}%`);
    const { data } = await query;
    setGeofences((data || []).map((g) => {
      const coords = (g as unknown as { center_geog?: string }).center_geog ? parseWktPoint((g as unknown as { center_geog?: string }).center_geog!) : null;
      return { ...g, latitude: coords?.latitude, longitude: coords?.longitude };
    }) as Geofence[]);
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ site_id: '', name: '', type: 'circle', latitude: 0, longitude: 0, radius_m: 100, polygon_coordinates: '', accuracy_threshold_m: 25, grace_distance_m: 10, active: true });
    setDialogOpen(true);
  };

  const openEdit = (g: Geofence) => {
    setEditing(g);
    const parsed = (g as unknown as { center_geog?: string }).center_geog;
    const coords = parsed ? parseWktPoint(parsed) : null;
    setForm({
      site_id: g.site_id, name: g.name, type: g.type,
      latitude: coords?.latitude ?? 0, longitude: coords?.longitude ?? 0,
      radius_m: g.radius_m || 100,
      polygon_coordinates: g.polygon_coordinates ? JSON.stringify(g.polygon_coordinates) : '',
      accuracy_threshold_m: g.accuracy_threshold_m, grace_distance_m: g.grace_distance_m,
      active: g.active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);
    const payload: Record<string, unknown> = {
      organization_id: orgId, site_id: form.site_id, name: form.name,
      type: form.type,
      center_geog: form.type === 'circle' ? makePointGeog(form.longitude, form.latitude) : null,
      radius_m: form.radius_m, accuracy_threshold_m: form.accuracy_threshold_m,
      grace_distance_m: form.grace_distance_m, active: form.active,
    };
    if (form.type === 'polygon' && form.polygon_coordinates) {
      try {
        const coords = JSON.parse(form.polygon_coordinates) as [number, number][];
        payload.polygon_geom = `SRID=4326;POLYGON((${coords.map((c) => c.join(' ')).join(', ')}))`;
      } catch { toast.error('Invalid polygon coordinates JSON'); setSaving(false); return; }
    }
    if (editing) {
      const { error } = await supabase.from('geofences').update(payload).eq('id', editing.id);
      if (error) { toast.error('Update failed'); setSaving(false); return; }
      toast.success('Geofence updated');
    } else {
      const { error } = await supabase.from('geofences').insert(payload);
      if (error) { toast.error('Create failed'); setSaving(false); return; }
      toast.success('Geofence created');
    }
    setDialogOpen(false);
    setSaving(false);
    loadGeofences();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this geofence?')) return;
    const { error } = await supabase.from('geofences').delete().eq('id', id);
    if (error) { toast.error('Delete failed'); return; }
    toast.success('Geofence deleted');
    loadGeofences();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Geofences</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Create Geofence</Button>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search geofences..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
      ) : geofences.length === 0 ? (
        <Card><CardContent className="p-6 text-center"><Circle className="h-8 w-8 mx-auto text-muted-foreground mb-2" /><p className="text-muted-foreground">No geofences found</p></CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Radius (m)</TableHead>
                <TableHead>Accuracy</TableHead>
                <TableHead>Grace</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {geofences.map((gf) => (
                <TableRow key={gf.id}>
                  <TableCell className="font-medium">{gf.name}</TableCell>
                  <TableCell className="text-sm">{(gf as unknown as { sites?: { name?: string } })?.sites?.name ?? gf.site_id?.slice(0, 8)}</TableCell>
                  <TableCell><Badge variant="outline">{gf.type}</Badge></TableCell>
                  <TableCell>{gf.radius_m ?? '--'}</TableCell>
                  <TableCell>{gf.accuracy_threshold_m}m</TableCell>
                  <TableCell>{gf.grace_distance_m}m</TableCell>
                  <TableCell><Badge variant={gf.active ? 'success' : 'secondary'}>{gf.active ? 'Active' : 'Inactive'}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(gf)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(gf.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Geofence' : 'Create Geofence'}</DialogTitle>
            <DialogDescription>Define geofence boundary parameters</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gfname">Name</Label>
              <Input id="gfname" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Site</Label>
              <Select value={form.site_id} onValueChange={(v) => setForm({ ...form, site_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
                <SelectContent>
                  {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as 'circle' | 'polygon' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="circle">Circle</SelectItem>
                  <SelectItem value="polygon">Polygon</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.type === 'circle' && (
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Latitude</Label>
                  <Input type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Longitude</Label>
                  <Input type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Radius (m)</Label>
                  <Input type="number" value={form.radius_m} onChange={(e) => setForm({ ...form, radius_m: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
            )}
            {form.type === 'polygon' && (
              <div className="space-y-2">
                <Label>Polygon Coordinates (JSON)</Label>
                <Input value={form.polygon_coordinates} onChange={(e) => setForm({ ...form, polygon_coordinates: e.target.value })} placeholder='[[lng,lat],[lng,lat],...]' />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Accuracy Threshold (m)</Label>
                <Input type="number" value={form.accuracy_threshold_m} onChange={(e) => setForm({ ...form, accuracy_threshold_m: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Grace Distance (m)</Label>
                <Input type="number" value={form.grace_distance_m} onChange={(e) => setForm({ ...form, grace_distance_m: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="gfactive" checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              <Label htmlFor="gfactive">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.site_id}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
