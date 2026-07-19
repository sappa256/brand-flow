import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useTheme } from 'next-themes';
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
  Sun,
  Moon,
  ChevronDown,
  TrendingUp,
  ClipboardList,
  Video,
  Cpu,
  CreditCard,
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
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { AppRole } from '@/types/crm';
import logo from '@/assets/logo.png';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: AppRole[];
}

interface NavGroup {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
  roles: AppRole[];
}

const navGroups: NavGroup[] = [
  {
    title: 'Sales',
    icon: TrendingUp,
    roles: ['admin', 'sales'],
    items: [
      { title: 'Leads', href: '/leads', icon: Users, roles: ['admin', 'sales'] },
      { title: 'Proposals', href: '/proposals', icon: FileText, roles: ['admin', 'sales'] },
      { title: 'Clients', href: '/clients', icon: Building2, roles: ['admin', 'sales', 'strategy'] },
      { title: 'Contracts', href: '/contracts', icon: ScrollText, roles: ['admin', 'sales'] },
    ],
  },
  {
    title: 'Planning',
    icon: ClipboardList,
    roles: ['admin', 'strategy'],
    items: [
      { title: 'Strategy', href: '/strategy', icon: Lightbulb, roles: ['admin', 'strategy'] },
      { title: 'Cycles', href: '/cycles', icon: RefreshCw, roles: ['admin', 'strategy'] },
    ],
  },
  {
    title: 'Content',
    icon: Video,
    roles: ['admin', 'strategy', 'editor', 'social_media'],
    items: [
      { title: 'Shoots', href: '/shoots', icon: Camera, roles: ['admin', 'strategy'] },
      { title: 'Reels', href: '/reels', icon: Film, roles: ['admin', 'editor', 'strategy'] },
      { title: 'Calendar', href: '/calendar', icon: Calendar, roles: ['admin', 'social_media', 'strategy'] },
    ],
  },
];

const standaloneItems: NavItem[] = [
  { title: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['admin', 'sales', 'strategy', 'editor', 'social_media'] },
  { title: 'Analytics', href: '/analytics', icon: TrendingUp, roles: ['admin'] },
  { title: 'Automation', href: '/automation', icon: Cpu, roles: ['admin'] },
  { title: 'Billing', href: '/billing', icon: CreditCard, roles: ['admin'] },
  { title: 'Owner Ops', href: '/owner-dashboard', icon: Command, roles: ['admin'] },
  { title: 'Files', href: '/files', icon: FolderOpen, roles: ['admin', 'sales', 'strategy', 'editor', 'social_media'] },
];

export function AppSidebar() {
  const location = useLocation();
  const { profile, roles, signOut, hasAnyRole, organizations, currentOrganization, setActiveOrganization } = useAuth();
  const { theme, setTheme } = useTheme();
  const { isMobile, setOpenMobile } = useSidebar();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Sales: true,
    Planning: true,
    Content: true,
  });

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const toggleGroup = (groupTitle: string) => {
    setOpenGroups(prev => ({ ...prev, [groupTitle]: !prev[groupTitle] }));
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const isGroupActive = (group: NavGroup) => {
    return group.items.some(item => location.pathname === item.href);
  };

  const filteredStandaloneItems = standaloneItems.filter(item => hasAnyRole(item.roles));
  const filteredGroups = navGroups
    .filter(group => hasAnyRole(group.roles))
    .map(group => ({
      ...group,
      items: group.items.filter(item => hasAnyRole(item.roles)),
    }))
    .filter(group => group.items.length > 0);

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="border-b border-sidebar-border p-4 space-y-3">
        <Link 
          to="/" 
          className="flex items-center gap-3 group cursor-pointer"
        >
          <div className="relative overflow-hidden rounded-xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
            <img 
              src={logo} 
              alt="Montaz Medias Logo" 
              className="h-10 w-10 object-contain drop-shadow-lg transition-all duration-300 group-hover:drop-shadow-2xl"
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
          </div>
          <div className="transition-all duration-300 group-hover:translate-x-1">
            <h1 className="font-semibold text-sidebar-foreground transition-colors duration-300 group-hover:text-primary leading-tight">
              {currentOrganization?.name || 'Brand Flow'}
            </h1>
            <p className="text-[10px] text-muted-foreground">Workspace Command</p>
          </div>
        </Link>

        {organizations.length > 1 && (
          <div className="pt-1">
            <Select 
              value={currentOrganization?.id || ''} 
              onValueChange={setActiveOrganization}
            >
              <SelectTrigger className="w-full bg-background/50 border-sidebar-border h-8 text-xs text-muted-foreground focus:ring-0">
                <SelectValue placeholder="Switch Workspace" />
              </SelectTrigger>
              <SelectContent className="bg-sidebar border-sidebar-border text-white text-xs">
                {organizations.map(org => (
                  <SelectItem key={org.id} value={org.id} className="focus:bg-primary/20 focus:text-white">
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin">
        {/* Standalone Items */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredStandaloneItems.map((item, index) => {
                const isActive = location.pathname === item.href;
                const isHovered = hoveredItem === item.href;
                
                return (
                  <SidebarMenuItem 
                    key={item.href}
                    className="animate-fade-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={cn(
                        "relative overflow-hidden transition-all duration-300 ease-out",
                        "hover:translate-x-1 hover:bg-sidebar-accent",
                        isActive && "bg-primary/10 text-primary font-medium"
                      )}
                      onMouseEnter={() => setHoveredItem(item.href)}
                      onMouseLeave={() => setHoveredItem(null)}
                    >
                      <Link to={item.href} className="relative z-10 flex items-center gap-3">
                        <item.icon 
                          className={cn(
                            "h-4 w-4 transition-all duration-300",
                            (isHovered || isActive) && "scale-110 text-primary",
                            isHovered && "rotate-6"
                          )} 
                        />
                        <span className={cn(
                          "transition-all duration-300",
                          isHovered && "translate-x-0.5"
                        )}>
                          {item.title}
                        </span>
                        
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full animate-scale-in" />
                        )}
                        
                        {isHovered && !isActive && (
                          <span className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent animate-fade-in" />
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Grouped Navigation */}
        {filteredGroups.map((group) => (
          <SidebarGroup key={group.title}>
            <Collapsible
              open={openGroups[group.title]}
              onOpenChange={() => toggleGroup(group.title)}
            >
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel 
                  className={cn(
                    "flex items-center justify-between cursor-pointer px-4 py-2 hover:bg-sidebar-accent rounded-md transition-colors",
                    isGroupActive(group) && "text-primary"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <group.icon className={cn(
                      "h-4 w-4",
                      isGroupActive(group) && "text-primary"
                    )} />
                    <span className="text-xs uppercase tracking-wider font-medium">
                      {group.title}
                    </span>
                  </div>
                  <ChevronDown className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    openGroups[group.title] && "rotate-180"
                  )} />
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuSub>
                      {group.items.map((item) => {
                        const isActive = location.pathname === item.href;
                        const isHovered = hoveredItem === item.href;
                        
                        return (
                          <SidebarMenuSubItem key={item.href}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={isActive}
                              className={cn(
                                "relative transition-all duration-300 ease-out",
                                "hover:translate-x-1 hover:bg-sidebar-accent",
                                isActive && "bg-primary/10 text-primary font-medium"
                              )}
                              onMouseEnter={() => setHoveredItem(item.href)}
                              onMouseLeave={() => setHoveredItem(null)}
                            >
                              <Link to={item.href} className="flex items-center gap-3">
                                <item.icon 
                                  className={cn(
                                    "h-4 w-4 transition-all duration-300",
                                    (isHovered || isActive) && "scale-110 text-primary"
                                  )} 
                                />
                                <span>{item.title}</span>
                                
                                {isActive && (
                                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-primary rounded-r-full" />
                                )}
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        ))}

        {hasAnyRole(['admin']) && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground text-xs uppercase tracking-wider px-4">
              Admin & SaaS
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location.pathname === '/org-settings'}
                    className={cn(
                      "relative overflow-hidden transition-all duration-300 ease-out",
                      "hover:translate-x-1 hover:bg-sidebar-accent",
                      location.pathname === '/org-settings' && "bg-primary/10 text-primary font-medium"
                    )}
                    onMouseEnter={() => setHoveredItem('/org-settings')}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <Link to="/org-settings" className="relative z-10 flex items-center gap-3">
                      <Building2 
                        className={cn(
                          "h-4 w-4 transition-all duration-500",
                          location.pathname === '/org-settings' && "text-primary"
                        )} 
                      />
                      <span>Org Settings</span>
                      
                      {location.pathname === '/org-settings' && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full animate-scale-in" />
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location.pathname === '/settings'}
                    className={cn(
                      "relative overflow-hidden transition-all duration-300 ease-out",
                      "hover:translate-x-1 hover:bg-sidebar-accent",
                      location.pathname === '/settings' && "bg-primary/10 text-primary font-medium"
                    )}
                    onMouseEnter={() => setHoveredItem('/settings')}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <Link to="/settings" className="relative z-10 flex items-center gap-3">
                      <Settings 
                        className={cn(
                          "h-4 w-4 transition-all duration-500",
                          hoveredItem === '/settings' && "rotate-90 text-primary",
                          location.pathname === '/settings' && "text-primary"
                        )} 
                      />
                      <span>User Settings</span>
                      
                      {location.pathname === '/settings' && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full animate-scale-in" />
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4 space-y-3">
        <div className="flex items-center gap-3 group">
          <Avatar className="h-9 w-9 transition-all duration-300 group-hover:scale-105 group-hover:ring-2 group-hover:ring-primary/30">
            <AvatarFallback className="bg-primary/10 text-primary text-sm transition-colors duration-300 group-hover:bg-primary/20">
              {getInitials(profile?.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 transition-all duration-300 group-hover:translate-x-0.5">
            <p className="text-sm font-medium truncate text-sidebar-foreground">
              {profile?.full_name || 'User'}
            </p>
            <p className="text-xs text-muted-foreground truncate capitalize">
              {roles[0]?.replace('_', ' ') || 'No role'}
            </p>
          </div>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-300 hover:scale-110"
              >
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all duration-500 dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all duration-500 dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</p>
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={signOut}
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-300 hover:scale-110 hover:rotate-6"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Sign out</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
