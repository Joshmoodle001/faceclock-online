'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Save, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [general, setGeneral] = useState({ name: '', timezone: 'Africa/Johannesburg', currency: 'ZAR' });
  const [locationPolicy, setLocationPolicy] = useState({ required_accuracy_m: 25, geo_grace_distance_m: 10, live_tracking_enabled: false });
  const [biometricPolicy, setBiometricPolicy] = useState({ retention_days: 90, required_liveness_threshold: 0.7, required_match_threshold: 0.75 });
  const [payrollPolicy, setPayrollPolicy] = useState({ overtime_threshold_minutes: 480, rounding_interval_minutes: 15 });
  const [securityPolicy, setSecurityPolicy] = useState({ risk_threshold_low: 30, risk_threshold_medium: 60, risk_threshold_high: 80, session_expiry_minutes: 480 });

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase.from('profiles').select('organization_id').eq('user_id', user.id).single();
      if (!prof) { setLoading(false); return; }
      setOrgId(prof.organization_id);

      const { data: org } = await supabase.from('organizations').select('*').eq('id', prof.organization_id).single();
      if (org) {
        setGeneral({ name: org.name, timezone: org.default_timezone, currency: org.currency });
        const loc = org.location_policy_json as Record<string, unknown> || {};
        const bio = org.biometric_policy_json as Record<string, unknown> || {};
        const pay = org.payroll_policy_json as Record<string, unknown> || {};
        setLocationPolicy({
          required_accuracy_m: (loc.required_accuracy_m as number) || 25,
          geo_grace_distance_m: (loc.geo_grace_distance_m as number) || 10,
          live_tracking_enabled: (loc.live_tracking_enabled as boolean) || false,
        });
        setBiometricPolicy({
          retention_days: (bio.retention_days as number) || 90,
          required_liveness_threshold: (bio.required_liveness_threshold as number) || 0.7,
          required_match_threshold: (bio.required_match_threshold as number) || 0.75,
        });
        setPayrollPolicy({
          overtime_threshold_minutes: (pay.overtime_threshold_minutes as number) || 480,
          rounding_interval_minutes: (pay.rounding_interval_minutes as number) || 15,
        });
      }
      setLoading(false);
    };
    init();
  }, []);

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);
    const { error } = await supabase.from('organizations').update({
      name: general.name,
      default_timezone: general.timezone,
      currency: general.currency,
      location_policy_json: locationPolicy,
      biometric_policy_json: biometricPolicy,
      payroll_policy_json: payrollPolicy,
    }).eq('id', orgId);
    if (error) { toast.error('Save failed'); setSaving(false); return; }
    toast.success('Settings saved');
    setSaving(false);
  };

  if (loading) {
    return <div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Settings</h1>
        <Button onClick={handleSave} disabled={saving || !orgId}>
          <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">General</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Organization Name</Label>
            <Input value={general.name} onChange={(e) => setGeneral({ ...general, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select value={general.timezone} onValueChange={(v) => setGeneral({ ...general, timezone: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Africa/Johannesburg">Africa/Johannesburg</SelectItem>
                  <SelectItem value="Africa/Lagos">Africa/Lagos</SelectItem>
                  <SelectItem value="America/New_York">America/New_York</SelectItem>
                  <SelectItem value="Europe/London">Europe/London</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={general.currency} onValueChange={(v) => setGeneral({ ...general, currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ZAR">ZAR (R)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (&euro;)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Location Policy</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Required Accuracy (m)</Label>
              <Input type="number" value={locationPolicy.required_accuracy_m} onChange={(e) => setLocationPolicy({ ...locationPolicy, required_accuracy_m: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Geo Grace Distance (m)</Label>
              <Input type="number" value={locationPolicy.geo_grace_distance_m} onChange={(e) => setLocationPolicy({ ...locationPolicy, geo_grace_distance_m: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="live" checked={locationPolicy.live_tracking_enabled} onCheckedChange={(v) => setLocationPolicy({ ...locationPolicy, live_tracking_enabled: v })} />
            <Label htmlFor="live">Enable Live Tracking</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Biometric Policy</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Retention (days)</Label>
              <Input type="number" value={biometricPolicy.retention_days} onChange={(e) => setBiometricPolicy({ ...biometricPolicy, retention_days: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Liveness Threshold</Label>
              <Input type="number" step="0.05" min="0" max="1" value={biometricPolicy.required_liveness_threshold} onChange={(e) => setBiometricPolicy({ ...biometricPolicy, required_liveness_threshold: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Match Threshold</Label>
              <Input type="number" step="0.05" min="0" max="1" value={biometricPolicy.required_match_threshold} onChange={(e) => setBiometricPolicy({ ...biometricPolicy, required_match_threshold: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Payroll Policy</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Overtime Threshold (min/day)</Label>
              <Input type="number" value={payrollPolicy.overtime_threshold_minutes} onChange={(e) => setPayrollPolicy({ ...payrollPolicy, overtime_threshold_minutes: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Rounding Interval (min)</Label>
              <Input type="number" value={payrollPolicy.rounding_interval_minutes} onChange={(e) => setPayrollPolicy({ ...payrollPolicy, rounding_interval_minutes: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Security</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Risk Threshold - Low</Label>
              <Input type="number" min="0" max="100" value={securityPolicy.risk_threshold_low} onChange={(e) => setSecurityPolicy({ ...securityPolicy, risk_threshold_low: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Risk Threshold - Medium</Label>
              <Input type="number" min="0" max="100" value={securityPolicy.risk_threshold_medium} onChange={(e) => setSecurityPolicy({ ...securityPolicy, risk_threshold_medium: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Session Expiry (min)</Label>
              <Input type="number" value={securityPolicy.session_expiry_minutes} onChange={(e) => setSecurityPolicy({ ...securityPolicy, session_expiry_minutes: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
