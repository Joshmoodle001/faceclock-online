'use client';

import { CheckCircle2, AlertTriangle, XCircle, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ClockResult } from '@/types';

interface ClockResultCardProps {
  result: ClockResult;
}

export function ClockResultCard({ result }: ClockResultCardProps) {
  const { decision, message, risk_scores } = result;

  const config = {
    accepted: {
      icon: CheckCircle2,
      color: 'text-emerald-500',
      bg: 'bg-emerald-50 dark:bg-emerald-950/20',
      border: 'border-emerald-200',
    },
    review_required: {
      icon: AlertTriangle,
      color: 'text-amber-500',
      bg: 'bg-amber-50 dark:bg-amber-950/20',
      border: 'border-amber-200',
    },
    rejected: {
      icon: XCircle,
      color: 'text-destructive',
      bg: 'bg-destructive/5',
      border: 'border-destructive/50',
    },
  };

  const c = config[decision];

  return (
    <Card className={`${c.bg} ${c.border}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <c.icon className={`h-8 w-8 ${c.color}`} />
          <div>
            <p className="font-semibold">
              {decision === 'accepted' ? 'Clock recorded' :
               decision === 'review_required' ? 'Under review' :
               'Clock rejected'}
            </p>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
        </div>
        {risk_scores && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            <Badge variant="outline" className="text-xs">
              Location: {risk_scores.location}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Device: {risk_scores.device}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Face: {risk_scores.face_match}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Liveness: {risk_scores.liveness}
            </Badge>
            <Badge variant="outline" className="text-xs font-bold">
              Final: {risk_scores.final}
            </Badge>
          </div>
        )}
        {decision === 'review_required' && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> Your supervisor has been notified
          </p>
        )}
      </CardContent>
    </Card>
  );
}
