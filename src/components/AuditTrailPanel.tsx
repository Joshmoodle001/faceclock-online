'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Clock, User, Info } from 'lucide-react';
import { formatTimestamp } from '@/lib/utils';
import type { AuditLog } from '@/types';

interface AuditTrailPanelProps {
  entries: AuditLog[];
  loading?: boolean;
}

export function AuditTrailPanel({ entries, loading }: AuditTrailPanelProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse flex gap-3">
            <div className="h-8 w-8 rounded-full bg-muted" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-3/4 bg-muted rounded" />
              <div className="h-3 w-1/2 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        <Info className="h-6 w-6 mx-auto mb-2" />
        No audit trail entries
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-96">
      <div className="relative space-y-0">
        {entries.map((entry, i) => (
          <div key={entry.id} className="relative pl-8 pb-4">
            {i < entries.length - 1 && (
              <div className="absolute left-3.5 top-3 bottom-0 w-px bg-border" />
            )}
            <div className="absolute left-0 top-1.5 h-7 w-7 rounded-full bg-muted flex items-center justify-center">
              <Clock className="h-3 w-3 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">{entry.actor_user_id.slice(0, 8)}</span>
                <Badge variant="outline" className="text-xs">{entry.action}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {entry.entity_type} / {entry.entity_id.slice(0, 8)}
              </p>
              <p className="text-xs text-muted-foreground">{formatTimestamp(entry.created_at)}</p>
              {entry.metadata_json && Object.keys(entry.metadata_json).length > 0 && (
                <pre className="text-xs text-muted-foreground bg-muted p-2 rounded mt-1 overflow-auto max-h-20">
                  {JSON.stringify(entry.metadata_json, null, 1)}
                </pre>
              )}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
