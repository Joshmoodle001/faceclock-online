'use client';

import { Clock, LogOut, Coffee, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ClockEventType } from '@/types';

interface ClockActionButtonProps {
  isClockedIn: boolean;
  onClick: (eventType: ClockEventType) => void;
  disabled?: boolean;
  loading?: boolean;
}

export function ClockActionButton({
  isClockedIn,
  onClick,
  disabled = false,
  loading = false,
}: ClockActionButtonProps) {
  if (!isClockedIn) {
    return (
      <Button
        size="lg"
        className="w-full h-16 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/25 animate-pulse"
        onClick={() => onClick('clock_in')}
        disabled={disabled || loading}
      >
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
        ) : (
          <Clock className="h-6 w-6 mr-2" />
        )}
        Clock In
      </Button>
    );
  }

  return (
    <Button
      size="lg"
      className="w-full h-16 text-lg font-bold bg-destructive hover:bg-destructive/90 shadow-lg shadow-destructive/25"
      onClick={() => onClick('clock_out')}
      disabled={disabled || loading}
    >
      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
      ) : (
        <LogOut className="h-6 w-6 mr-2" />
      )}
      Clock Out
    </Button>
  );
}
