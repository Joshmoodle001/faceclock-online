'use client';

import { Badge } from '@/components/ui/badge';
import { Shield, Globe, Smartphone, Monitor } from 'lucide-react';
import type { AttestationLevel } from '@/types';

interface DeviceTrustBadgeProps {
  level: AttestationLevel;
}

export function DeviceTrustBadge({ level }: DeviceTrustBadgeProps) {
  const config = {
    web: { icon: Globe, label: 'Web', variant: 'secondary' as const },
    passkey_verified: { icon: Shield, label: 'Passkey', variant: 'success' as const },
    play_integrity: { icon: Smartphone, label: 'Android', variant: 'success' as const },
    app_attest: { icon: Monitor, label: 'Apple', variant: 'success' as const },
  };

  const c = config[level] || config.web;
  const Icon = c.icon;

  return (
    <Badge variant={c.variant} className="text-xs flex items-center gap-1">
      <Icon className="h-3 w-3" />
      {c.label}
    </Badge>
  );
}
