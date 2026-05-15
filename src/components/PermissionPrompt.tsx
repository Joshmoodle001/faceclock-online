'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface PermissionPromptProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  onDismiss: () => void;
}

export function PermissionPrompt({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  onDismiss,
}: PermissionPromptProps) {
  return (
    <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
            <div className="flex items-center gap-2 mt-3">
              <Button size="sm" onClick={onAction}>
                {actionLabel}
              </Button>
              <Button size="sm" variant="ghost" onClick={onDismiss}>
                Dismiss
              </Button>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="shrink-0 rounded-full p-1 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
