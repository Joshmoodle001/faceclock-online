'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle,
} from '@/components/ui/drawer';
import { Mail, Phone, Badge as BadgeIcon, MapPin, Clock, User, ExternalLink } from 'lucide-react';
import type { Profile } from '@/types';

interface EmployeeProfileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: Profile | null;
  loading?: boolean;
}

export function EmployeeProfileDrawer({ open, onOpenChange, employee, loading }: EmployeeProfileDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Employee Details</DrawerTitle>
        </DrawerHeader>
        <div className="p-4 space-y-6">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-16 w-16 rounded-full mx-auto" />
              <Skeleton className="h-4 w-32 mx-auto" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : !employee ? (
            <p className="text-center text-muted-foreground">No employee data</p>
          ) : (
            <>
              <div className="flex flex-col items-center text-center space-y-2">
                <Avatar className="h-16 w-16">
                  <AvatarImage src="" alt={employee.display_name} />
                  <AvatarFallback className="text-lg">
                    {employee.display_name?.charAt(0)?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-lg font-bold">{employee.display_name}</p>
                  <p className="text-sm text-muted-foreground">{employee.email}</p>
                </div>
                <Badge variant="outline">{employee.role}</Badge>
                <Badge variant={employee.employment_status === 'active' ? 'success' : 'secondary'}>
                  {employee.employment_status}
                </Badge>
              </div>

              <Separator />

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <BadgeIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground w-28">Employee Code</span>
                  <span>{employee.employee_code || '--'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground w-28">Email</span>
                  <span>{employee.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground w-28">Phone</span>
                  <span>{employee.phone || '--'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground w-28">Role</span>
                  <Badge variant="outline">{employee.role}</Badge>
                </div>
                {employee.team_id && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground w-28">Team</span>
                    <span>{employee.team_id.slice(0, 8)}</span>
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" asChild>
                  <a href={`/admin/employees`}>
                    <ExternalLink className="h-4 w-4 mr-2" /> View Profile
                  </a>
                </Button>
              </div>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
