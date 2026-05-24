'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface PermissionPromptProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}

export function PermissionPrompt({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: PermissionPromptProps) {
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
            <div className="mt-3">
              <Button size="sm" onClick={onAction}>
                {actionLabel}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
