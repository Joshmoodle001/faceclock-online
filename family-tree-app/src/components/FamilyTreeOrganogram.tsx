'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Users } from 'lucide-react';

interface OrganogramMember {
  user_id: string;
  display_name: string;
  employee_code?: string;
  clocked_in: boolean;
  drop_off_location?: string;
}

interface FamilyTreeOrganogramProps {
  parentName: string;
  parentCode?: string;
  parentClockedIn: boolean;
  members: OrganogramMember[];
  title?: string;
}

export function FamilyTreeOrganogram({
  parentName,
  parentCode,
  parentClockedIn,
  members,
  title,
}: FamilyTreeOrganogramProps) {
  return (
    <Card className="border-primary/20">
      <CardContent className="p-4 space-y-3">
        {title && <h3 className="text-sm font-semibold text-center">{title}</h3>}

        <div className="flex justify-center">
          <div className="text-center p-3 rounded-lg bg-primary/10 border border-primary/20 min-w-[200px]">
            <User className="h-6 w-6 mx-auto text-primary mb-1" />
            <p className="font-semibold text-sm">{parentName}</p>
            {parentCode && <p className="text-xs text-muted-foreground">{parentCode}</p>}
            <Badge variant={parentClockedIn ? 'success' : 'secondary'} className="mt-1 text-xs">
              {parentClockedIn ? 'Clocked In' : 'Not Clocked In'}
            </Badge>
          </div>
        </div>

        {members.length > 0 && (
          <>
            <div className="flex justify-center">
              <div className="w-px h-4 bg-border" />
            </div>
            <div className="border-t border-border pt-3">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <Users className="h-3 w-3" />
                Team Members ({members.filter(c => c.clocked_in).length}/{members.length} clocked in)
              </p>
              <div className="space-y-2">
                {members.map((child) => (
                  <div
                    key={child.user_id}
                    className={`p-2.5 rounded-lg border text-sm ${
                      child.clocked_in
                        ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800'
                        : 'bg-muted/50 border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${child.clocked_in ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
                        <span className="font-medium truncate">{child.display_name}</span>
                        {child.employee_code && (
                          <span className="text-xs text-muted-foreground shrink-0">{child.employee_code}</span>
                        )}
                      </div>
                      <Badge variant={child.clocked_in ? 'success' : 'secondary'} className="text-xs shrink-0 ml-2">
                        {child.clocked_in ? 'Clocked In' : 'Pending'}
                      </Badge>
                    </div>
                    {child.clocked_in && child.drop_off_location && (
                      <p className="text-xs text-muted-foreground mt-1 ml-4">
                        Drop-off: {child.drop_off_location}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
