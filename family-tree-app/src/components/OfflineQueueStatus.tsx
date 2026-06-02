'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WifiOff, RefreshCw, CheckCircle2, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

const OFFLINE_QUEUE_KEY = 'faceattend_offline_queue';

interface QueuedEvent {
  client_event_id: string;
  event_type: string;
  occurred_at: string;
  latitude?: number;
  longitude?: number;
  accuracy_m?: number;
}

export function OfflineQueueStatus() {
  const [queue, setQueue] = useState<QueuedEvent[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    setQueue(stored);
  }, []);

  const syncQueue = async () => {
    setSyncing(true);
    const stored: QueuedEvent[] = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    if (stored.length === 0) { setSyncing(false); return; }

    let successCount = 0;
    for (const event of stored) {
      try {
        const { error } = await supabase.functions.invoke('submit-clock-event', {
          body: { ...event, timestamp: new Date().toISOString() },
        });
        if (!error) successCount++;
      } catch { /* skip failed */ }
    }

    if (successCount === stored.length) {
      localStorage.removeItem(OFFLINE_QUEUE_KEY);
      setQueue([]);
      setLastSynced(new Date());
      toast.success(`Synced ${successCount} offline events`);
    } else {
      const remaining = stored.slice(successCount);
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
      setQueue(remaining);
      toast.success(`Synced ${successCount}/${stored.length} events`);
    }
    setSyncing(false);
  };

  if (queue.length === 0 && !lastSynced) return null;

  return (
    <Card className="border-amber-200">
      <CardContent className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <WifiOff className="h-4 w-4 text-amber-600" />
          <span className="text-sm">
            {queue.length > 0
              ? `${queue.length} event(s) queued offline`
              : lastSynced
              ? `Last synced: ${lastSynced.toLocaleTimeString()}`
              : ''}
          </span>
          {queue.length > 0 && (
            <Badge variant="warning" className="text-xs">{queue.length}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastSynced && queue.length === 0 && (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          )}
          {queue.length > 0 && (
            <Button size="sm" variant="outline" onClick={syncQueue} disabled={syncing}>
              {syncing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
              Sync
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
