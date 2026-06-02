'use client';

import { Badge } from '@/components/ui/badge';

interface RiskScoreBadgeProps {
  score: number;
  label?: string;
}

export function RiskScoreBadge({ score, label }: RiskScoreBadgeProps) {
  const variant: 'success' | 'warning' | 'destructive' =
    score <= 30 ? 'success' :
    score <= 60 ? 'warning' :
    'destructive';

  const colorClass =
    score <= 30 ? 'text-emerald-600' :
    score <= 60 ? 'text-amber-600' :
    score <= 80 ? 'text-orange-600' :
    'text-red-600';

  return (
    <Badge variant={variant} className={`${colorClass} text-xs font-mono`}>
      {label && <span className="mr-1">{label}:</span>}
      {Math.round(score)}
    </Badge>
  );
}
