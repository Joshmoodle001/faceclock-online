'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { DeviceTrustBadge } from '@/components/DeviceTrustBadge';
import { Search, Monitor, Smartphone, AlertCircle } from 'lucide-react';
import type { Device } from '@/types';
import { toast } from 'sonner';

export default function DevicesPage() {
  const supabase = createClient();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');

  useEffect(() => { loadDevices(); }, [search, platformFilter]);

  const loadDevices = async () => {
    let query = supabase.from('devices').select('*, profiles(display_name)').order('last_seen_at', { ascending: false });
    if (platformFilter !== 'all') query = query.eq('platform', platformFilter);
    const { data } = await query;
    setDevices(data || []);
    setLoading(false);
  };

  const toggleBlock = async (id: string, blocked: boolean) => {
    const { error } = await supabase.from('devices').update({ blocked }).eq('id', id);
    if (error) { toast.error('Update failed'); return; }
    toast.success(blocked ? 'Device blocked' : 'Device unblocked');
    loadDevices();
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Device Management</h1>

      <div className="flex gap-4">
        <div className="flex items-center gap-2 max-w-sm flex-1">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search devices..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Platform" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            <SelectItem value="ios">iOS</SelectItem>
            <SelectItem value="android">Android</SelectItem>
            <SelectItem value="web">Web</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
      ) : devices.length === 0 ? (
        <Card><CardContent className="p-6 text-center"><Smartphone className="h-8 w-8 mx-auto text-muted-foreground mb-2" /><p className="text-muted-foreground">No devices found</p></CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Device Name</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Attestation</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.map((dev) => {
                const p = dev as unknown as { profiles?: { display_name?: string } };
                const userName = p?.profiles?.display_name || dev.user_id?.slice(0, 8);
                return (
                  <TableRow key={dev.id}>
                    <TableCell className="font-medium">{userName as string}</TableCell>
                    <TableCell className="text-sm">{dev.device_name || dev.device_type || '--'}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        {dev.platform === 'ios' || dev.platform === 'android' ? <Smartphone className="h-3 w-3" /> : <Monitor className="h-3 w-3" />}
                        {dev.platform || 'web'}
                      </span>
                    </TableCell>
                    <TableCell><DeviceTrustBadge level={dev.attestation_level} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {dev.last_seen_at ? new Date(dev.last_seen_at).toLocaleString() : 'Never'}
                    </TableCell>
                    <TableCell><Badge variant={dev.blocked ? 'destructive' : 'success'}>{dev.blocked ? 'Blocked' : 'Active'}</Badge></TableCell>
                    <TableCell>
                      <Button size="sm" variant={dev.blocked ? 'outline' : 'ghost'} onClick={() => toggleBlock(dev.id, !dev.blocked)}>
                        {dev.blocked ? 'Unblock' : 'Block'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
