import { Link, useLocation } from 'react-router-dom';
import {
  Users,
  FileText,
  Building2,
  ScrollText,
  Lightbulb,
  Camera,
  Film,
  Calendar,
  RefreshCw,
  LayoutDashboard,
  LogOut,
  Settings,
  FolderOpen,
  Command,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import type { AppRole } from '@/types/crm';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: AppRole[];
}

const navItems: NavItem[] = [
  { title: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['admin', 'sales', 'strategy', 'editor', 'social_media'] },
  { title: 'Owner Ops', href: '/owner-dashboard', icon: Command, roles: ['admin'] },
  { title: 'Leads', href: '/leads', icon: Users, roles: ['admin', 'sales'] },
  { title: 'Proposals', href: '/proposals', icon: FileText, roles: ['admin', 'sales'] },
  { title: 'Clients', href: '/clients', icon: Building2, roles: ['admin', 'sales', 'strategy'] },
  { title: 'Contracts', href: '/contracts', icon: ScrollText, roles: ['admin', 'sales'] },
  { title: 'Strategy', href: '/strategy', icon: Lightbulb, roles: ['admin', 'strategy'] },
  { title: 'Shoots', href: '/shoots', icon: Camera, roles: ['admin', 'strategy'] },
  { title: 'Reels', href: '/reels', icon: Film, roles: ['admin', 'editor', 'strategy'] },
  { title: 'Calendar', href: '/calendar', icon: Calendar, roles: ['admin', 'social_media', 'strategy'] },
  { title: 'Cycles', href: '/cycles', icon: RefreshCw, roles: ['admin', 'strategy'] },
  { title: 'Files', href: '/files', icon: FolderOpen, roles: ['admin', 'sales', 'strategy', 'editor', 'social_media'] },
];

export function AppSidebar() {
  const location = useLocation();
  const { profile, roles, signOut, hasAnyRole } = useAuth();

  const filteredNavItems = navItems.filter(item => hasAnyRole(item.roles));

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
            M
          </div>
          <div>
            <h1 className="font-semibold text-sidebar-foreground">Montaz Medias</h1>
            <p className="text-xs text-muted-foreground">CRM Dashboard</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin">
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground text-xs uppercase tracking-wider px-4">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.href}
                    className="transition-colors"
                  >
                    <Link to={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {hasAnyRole(['admin']) && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground text-xs uppercase tracking-wider px-4">
              Admin
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname === '/settings'}>
                    <Link to="/settings">
                      <Settings className="h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {getInitials(profile?.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-sidebar-foreground">
              {profile?.full_name || 'User'}
            </p>
            <p className="text-xs text-muted-foreground truncate capitalize">
              {roles[0]?.replace('_', ' ') || 'No role'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
