'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LayoutDashboard, Building2, MapPin, Circle, Users, Camera, Monitor,
  Clock, CalendarCheck, CheckSquare, Map, Wallet, FileText, Settings,
  LogOut, ChevronLeft, ChevronRight, Menu, X, Moon, Sun,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import type { Profile, Role } from '@/types';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: Role[];
}

const navItems: NavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['super_admin', 'org_admin', 'manager'] },
  { href: '/admin/organizations', label: 'Organizations', icon: Building2, roles: ['super_admin'] },
  { href: '/admin/sites', label: 'Sites', icon: MapPin, roles: ['super_admin', 'org_admin'] },
  { href: '/admin/geofences', label: 'Geofences', icon: Circle, roles: ['super_admin', 'org_admin'] },
  { href: '/admin/employees', label: 'Employees', icon: Users, roles: ['super_admin', 'org_admin', 'manager'] },
  { href: '/admin/enrollments', label: 'Enrollments', icon: Camera, roles: ['super_admin', 'org_admin', 'manager'] },
  { href: '/admin/devices', label: 'Devices', icon: Monitor, roles: ['super_admin', 'org_admin'] },
  { href: '/admin/clock-events', label: 'Clock Events', icon: Clock, roles: ['super_admin', 'org_admin', 'manager'] },
  { href: '/admin/attendance', label: 'Attendance', icon: CalendarCheck, roles: ['super_admin', 'org_admin', 'manager'] },
  { href: '/admin/approvals', label: 'Approvals', icon: CheckSquare, roles: ['super_admin', 'org_admin', 'manager'] },
  { href: '/admin/live-map', label: 'Live Map', icon: Map, roles: ['super_admin', 'org_admin', 'manager'] },
  { href: '/admin/payroll', label: 'Payroll', icon: Wallet, roles: ['super_admin', 'org_admin', 'finance_admin'] },
  { href: '/admin/audit-logs', label: 'Audit Logs', icon: FileText, roles: ['super_admin'] },
  { href: '/admin/settings', label: 'Settings', icon: Settings, roles: ['super_admin', 'org_admin'] },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const supabase = createClient();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) { router.push('/login'); return; }
      if (data) {
        setProfile(data as Profile);
        if (data.role === 'employee') { router.push('/app/clock'); return; }
      }
      setLoading(false);
    };
    init();
  }, [router, supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const filteredNav = navItems.filter((item) => profile && item.roles.includes(profile.role));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="space-y-4 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
        </div>
      </div>
    );
  }

  const initials = profile?.display_name?.charAt(0)?.toUpperCase() || 'A';

  return (
    <div className="min-h-screen flex">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 flex flex-col border-r bg-sidebar transition-all duration-200 ${
          collapsed ? 'w-16' : 'w-60'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b">
          {!collapsed && <span className="font-bold text-lg">FaceAttend</span>}
          <Button variant="ghost" size="icon" onClick={() => { setCollapsed(!collapsed); setMobileOpen(false); }}>
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        <ScrollArea className="flex-1 py-2">
          <nav className="space-y-1 px-2">
            {filteredNav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                    active
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                  } ${collapsed && 'justify-center'}`}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        <div className="border-t p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className={`w-full flex items-center gap-3 ${collapsed && 'justify-center'}`}>
                <Avatar className="h-8 w-8">
                  <AvatarImage src="" alt={profile?.display_name} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <div className="text-left text-sm truncate">
                    <p className="font-medium truncate">{profile?.display_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{profile?.role}</p>
                  </div>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="right">
              <DropdownMenuLabel>{profile?.display_name}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                {theme === 'dark' ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                <LogOut className="h-4 w-4 mr-2" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="md:hidden flex items-center justify-between h-16 px-4 border-b">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <span className="font-bold">FaceAttend</span>
          <div className="w-10" />
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
