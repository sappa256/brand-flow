import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Profile, Organization } from '@/types/crm';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  organizations: Organization[];
  currentOrganization: Organization | null;
  roles: string[];
  permissions: string[];
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  hasPermission: (permission: string) => boolean;
  setActiveOrganization: (orgId: string) => void;
  refreshOrganizations: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getLegacyPermissions = (role: string): string[] => {
  if (role === 'admin') return [
    'view_contracts', 'edit_contracts', 'manage_clients', 'assign_editors', 'approve_reels', 
    'manage_ai', 'manage_billing', 'upload_assets', 'view_audit_logs', 'view_leads', 'edit_leads', 
    'view_proposals', 'edit_proposals', 'view_strategies', 'edit_strategies', 'view_shoots', 'edit_shoots', 
    'view_reels', 'edit_reels', 'view_calendar', 'edit_calendar', 'view_cycles', 'edit_cycles'
  ];
  if (role === 'strategy') return [
    'view_strategies', 'edit_strategies', 'view_shoots', 'edit_shoots', 'view_reels', 'edit_reels', 
    'view_calendar', 'edit_calendar', 'view_cycles', 'edit_cycles', 'view_leads', 'view_proposals', 
    'manage_clients', 'upload_assets'
  ];
  if (role === 'sales') return [
    'view_leads', 'edit_leads', 'view_proposals', 'edit_proposals', 'view_contracts', 'edit_contracts', 
    'manage_clients', 'upload_assets'
  ];
  if (role === 'editor') return [
    'view_reels', 'edit_reels', 'upload_assets'
  ];
  return [];
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchProfileAndOrgs(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setOrganizations([]);
          setCurrentOrganization(null);
          setRoles([]);
          setPermissions([]);
          setIsLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfileAndOrgs(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfileAndOrgs = async (userId: string) => {
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData as Profile);
      }

      const { data: memberships, error } = await supabase
        .from('organization_members')
        .select('role, organization:organizations(*)')
        .eq('user_id', userId);

      if (error) throw error;

      if (memberships && memberships.length > 0) {
        const orgs = memberships
          .map(m => m.organization as unknown as Organization)
          .filter(Boolean);
        setOrganizations(orgs);
        
        const savedOrgId = localStorage.getItem('brand_flow_active_tenant');
        const activeOrg = orgs.find(o => o.id === savedOrgId) || orgs[0];
        
        setCurrentOrganization(activeOrg);
        localStorage.setItem('brand_flow_active_tenant', activeOrg.id);

        // Fetch permissions and dynamic roles
        const { data: userRolesData, error: rolesErr } = await supabase
          .from('user_roles')
          .select('role:roles(id, name, role_permissions(permission:permissions(name)))')
          .eq('user_id', userId)
          .eq('tenant_id', activeOrg.id);

        if (!rolesErr && userRolesData && userRolesData.length > 0) {
          const mappedRoles = userRolesData.map((ur: any) => ur.role?.name as string).filter(Boolean);
          if (mappedRoles.includes('Agency Owner') && !mappedRoles.includes('admin')) {
            mappedRoles.push('admin');
          }
          setRoles(mappedRoles);

          const permsSet = new Set<string>();
          userRolesData.forEach((ur: any) => {
            if (ur.role?.name === 'Super Admin') {
              permsSet.add('*');
            }
            ur.role?.role_permissions?.forEach((rp: any) => {
              if (rp.permission?.name) {
                permsSet.add(rp.permission.name);
              }
            });
          });
          setPermissions(Array.from(permsSet));
        } else {
          // Fallback to legacy membership roles
          const activeMember = memberships.find(m => (m.organization as any)?.id === activeOrg.id);
          if (activeMember) {
            setRoles([activeMember.role]);
            setPermissions(getLegacyPermissions(activeMember.role));
          } else {
            setRoles([]);
            setPermissions([]);
          }
        }
      } else {
        setOrganizations([]);
        setCurrentOrganization(null);
        setRoles([]);
        setPermissions([]);
      }
    } catch (error) {
      console.error('Error fetching profile/organizations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setActiveOrganization = async (orgId: string) => {
    if (!user) return;
    setIsLoading(true);
    try {
      localStorage.setItem('brand_flow_active_tenant', orgId);
      await fetchProfileAndOrgs(user.id);
    } catch (err) {
      console.error('Error switching active tenant:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshOrganizations = async () => {
    if (user) {
      await fetchProfileAndOrgs(user.id);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName }
      }
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setOrganizations([]);
    setCurrentOrganization(null);
    setRoles([]);
    setPermissions([]);
    localStorage.removeItem('brand_flow_active_tenant');
  };

  const hasRole = (role: string) => roles.includes(role);
  
  const hasAnyRole = (checkRoles: string[]) => 
    checkRoles.some(role => roles.includes(role));

  const hasPermission = (permission: string) => {
    return permissions.includes('*') || permissions.includes(permission);
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      organizations,
      currentOrganization,
      roles,
      permissions,
      isLoading,
      signIn,
      signUp,
      signOut,
      hasRole,
      hasAnyRole,
      hasPermission,
      setActiveOrganization,
      refreshOrganizations
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

