'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useTheme } from 'next-themes';
import {
  User,
  Mail,
  Phone,
  Badge as BadgeIcon,
  Shield,
  MapPin,
  Monitor,
  Smartphone,
  Moon,
  Sun,
  LogOut,
  Loader2,
} from 'lucide-react';
import type { Profile, Device } from '@/types';
import { toast } from 'sonner';
import { DeviceTrustBadge } from '@/components/DeviceTrustBadge';

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const { theme, setTheme } = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    const { data: pData } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    setProfile(pData);

    const { data: dData } = await supabase
      .from('devices')
      .select('*')
      .eq('user_id', user.id)
      .order('last_seen_at', { ascending: false });
    setDevices(dData || []);
    setLoading(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleBlockDevice = async (deviceId: string, blocked: boolean) => {
    const { error } = await supabase
      .from('devices')
      .update({ blocked })
      .eq('id', deviceId);
    if (error) {
      toast.error('Failed to update device');
      return;
    }
    setDevices((prev) => prev.map((d) => (d.id === deviceId ? { ...d, blocked } : d)));
    toast.success(blocked ? 'Device blocked' : 'Device unblocked');
  };

  if (loading) {
    return (
      <div className="p-6 max-w-lg mx-auto space-y-6">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!profile) return null;

  const initials = profile.display_name?.charAt(0)?.toUpperCase() || 'U';

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto space-y-6">
      {/* Profile header */}
      <Card>
        <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
          <Avatar className="h-20 w-20">
            <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-xl font-bold">{profile.display_name}</h2>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
          </div>
          <Badge variant="secondary">{profile.role}</Badge>
        </CardContent>
      </Card>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <BadgeIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground w-24">Employee Code</span>
            <span>{profile.employee_code || '--'}</span>
          </div>
          <Separator />
          <div className="flex items-center gap-3 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground w-24">Email</span>
            <span>{profile.email}</span>
          </div>
          <Separator />
          <div className="flex items-center gap-3 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground w-24">Phone</span>
            <span>{profile.phone || '--'}</span>
          </div>
          <Separator />
          <div className="flex items-center gap-3 text-sm">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground w-24">Role</span>
            <Badge variant="outline">{profile.role}</Badge>
          </div>
          <Separator />
          <div className="flex items-center gap-3 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground w-24">Status</span>
            <Badge variant={profile.employment_status === 'active' ? 'success' : 'secondary'}>
              {profile.employment_status}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Devices */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Devices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {devices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No devices registered</p>
          ) : (
            devices.map((device) => (
              <div key={device.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{device.device_name || device.platform || 'Unknown device'}</p>
                    <p className="text-xs text-muted-foreground">
                      {device.platform} &middot; {device.browser} &middot; Last seen: {device.last_seen_at ? new Date(device.last_seen_at).toLocaleDateString() : 'Never'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <DeviceTrustBadge level={device.attestation_level} />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleBlockDevice(device.id, !device.blocked)}
                  >
                    {device.blocked ? 'Unblock' : 'Block'}
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              <Label htmlFor="dark-mode">Dark Mode</Label>
            </div>
            <Switch
              id="dark-mode"
              checked={theme === 'dark'}
              onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
            />
          </div>
        </CardContent>
      </Card>

      <Button variant="destructive" className="w-full" onClick={signOut}>
        <LogOut className="h-4 w-4 mr-2" /> Sign Out
      </Button>
    </div>
  );
}
