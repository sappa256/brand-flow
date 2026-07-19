import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Users, Shield, Settings as SettingsIcon, Plus, Trash2, Loader2, FileText, Download, Bell, Sparkles, UserPlus } from 'lucide-react';
import type { AppRole } from '@/types/crm';
import { Navigate } from 'react-router-dom';
import { generateContractPdf } from '@/lib/contractPdfGenerator';
import type { Contract, Client, PlanType } from '@/types/crm';
import { getAiConfig, saveAiConfig } from '@/lib/aiService';

interface NotificationPreferences {
  email_enabled: boolean;
  proposal_accepted: boolean;
  contract_renewal: boolean;
  shoot_scheduled: boolean;
  editing_delay: boolean;
  missed_post: boolean;
  client_at_risk: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  sales: 'Sales',
  strategy: 'Strategy',
  editor: 'Editor',
  social_media: 'Social Media',
  client: 'Client',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-destructive text-destructive-foreground',
  sales: 'bg-blue-500 text-white',
  strategy: 'bg-purple-500 text-white',
  editor: 'bg-orange-500 text-white',
  social_media: 'bg-green-500 text-white',
  client: 'bg-purple-600 text-white',
};

interface TeamMember {
  id: string;
  membershipId?: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  roles: AppRole[];
}

// Notification Log Table Component
function NotificationLogTable({ userId }: { userId?: string }) {
  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notification-log', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('email_notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!notifications || notifications.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">No notifications sent yet</p>;
  }

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <div className="inline-block min-w-full align-middle px-4 sm:px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Event</TableHead>
              <TableHead className="whitespace-nowrap">Subject</TableHead>
              <TableHead className="whitespace-nowrap">Status</TableHead>
              <TableHead className="whitespace-nowrap">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notifications.map((notification: any) => (
              <TableRow key={notification.id}>
                <TableCell className="capitalize whitespace-nowrap">
                  {notification.event_type.replace(/_/g, ' ')}
                </TableCell>
                <TableCell className="max-w-[150px] sm:max-w-[200px] truncate">
                  {notification.subject}
                </TableCell>
                <TableCell>
                  <Badge variant={notification.is_sent ? 'default' : 'secondary'}>
                    {notification.is_sent ? 'Sent' : 'Pending'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {new Date(notification.created_at).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function Settings() {
  const { hasRole, user, isLoading: authLoading, currentOrganization } = useAuth();
  const isAdmin = hasRole('admin');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // AI Config states
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai' | 'anthropic' | 'custom'>('gemini');
  const [aiModel, setAiModel] = useState<string>('gemini-1.5-flash');
  const [aiKey, setAiKey] = useState<string>('');
  const [aiBaseUrl, setAiBaseUrl] = useState<string>('');

  useEffect(() => {
    const config = getAiConfig();
    setAiProvider(config.provider);
    setAiModel(config.model);
    setAiKey(config.apiKey);
    setAiBaseUrl(config.baseUrl || '');
  }, []);

  const handleSaveAiConfig = () => {
    saveAiConfig({
      provider: aiProvider,
      model: aiModel,
      apiKey: aiKey,
      baseUrl: aiBaseUrl,
    });
    toast({
      title: "AI Configuration Saved",
      description: "Your local AI settings have been successfully updated.",
    });
  };

  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AppRole>('sales');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<AppRole>('sales');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editMemberName, setEditMemberName] = useState('');
  const [editMemberEmail, setEditMemberEmail] = useState('');
  const [editMemberRoles, setEditMemberRoles] = useState<AppRole[]>([]);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>({
    email_enabled: true,
    proposal_accepted: true,
    contract_renewal: true,
    shoot_scheduled: true,
    editing_delay: true,
    missed_post: true,
    client_at_risk: true,
  });
  
  // Contract settings state
  const [companySettings, setCompanySettings] = useState({
    companyName: 'Montaz Medias',
    tagline: 'Premium Marketing Agency',
    email: 'contracts@montazmedias.com',
    phone: '+91 98765 43210',
    website: 'www.montazmedias.com',
    address: 'Mumbai, Maharashtra, India',
    bankName: 'HDFC Bank',
    accountNumber: 'XXXX XXXX XXXX 1234',
    ifscCode: 'HDFC0001234',
    gstNumber: 'GST123456789',
  });
  
  const [contractTerms, setContractTerms] = useState({
    paymentTerms: 'Payment is due within 7 days of invoice date. Late payments will incur a 2% monthly interest charge.',
    cancellationPolicy: 'Either party may terminate this agreement with 30 days written notice. Early termination by Client requires payment of remaining contract value at 50%.',
    deliverables: 'All content deliverables remain property of Montaz Medias until full payment is received. Upon payment, perpetual usage rights are granted to the Client.',
    confidentiality: 'Both parties agree to maintain confidentiality of proprietary information shared during the engagement.',
    revisionPolicy: 'Each reel includes up to 2 rounds of revisions. Additional revisions will be billed at ₹2,000 per round.',
  });

  // Fetch notification preferences
  const { data: savedNotificationPrefs, isLoading: isLoadingPrefs } = useQuery({
    queryKey: ['notification-preferences', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('user_notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Update local state when saved preferences load
  useEffect(() => {
    if (savedNotificationPrefs) {
      setNotificationPrefs({
        email_enabled: savedNotificationPrefs.email_enabled,
        proposal_accepted: savedNotificationPrefs.proposal_accepted,
        contract_renewal: savedNotificationPrefs.contract_renewal,
        shoot_scheduled: savedNotificationPrefs.shoot_scheduled,
        editing_delay: savedNotificationPrefs.editing_delay,
        missed_post: savedNotificationPrefs.missed_post,
        client_at_risk: savedNotificationPrefs.client_at_risk,
      });
    }
  }, [savedNotificationPrefs]);

  // Save notification preferences mutation
  const saveNotificationPrefsMutation = useMutation({
    mutationFn: async (prefs: NotificationPreferences) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { error } = await supabase
        .from('user_notification_preferences')
        .upsert({
          user_id: user.id,
          ...prefs,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      toast({ title: 'Notification preferences saved' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to save preferences', description: error.message, variant: 'destructive' });
    },
  });

  // Fetch all team members with their roles
  const { data: teamMembers = [], isLoading } = useQuery({
    queryKey: ['team-members', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];

      // Fetch active members in this organization
      const { data: memberData, error: memberError } = await supabase
        .from('organization_members')
        .select('*, profile:profiles(*)')
        .eq('organization_id', currentOrganization.id);

      if (memberError) throw memberError;

      // Fetch all user roles
      const { data: allRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*, role:roles(*)');

      if (rolesError) throw rolesError;

      // Combine members with roles
      const members: TeamMember[] = (memberData || []).map(member => {
        const profile = member.profile;
        const profileId = member.user_id;
        return {
          id: profileId,
          membershipId: member.id,
          full_name: profile?.full_name || 'Anonymous Member',
          email: profile?.email || '',
          avatar_url: profile?.avatar_url || '',
          roles: (allRoles || [])
            .filter(r => r.user_id === profileId)
            .map(r => {
              const roleVal = r.role;
              if (roleVal && typeof roleVal === 'object') {
                const name = (roleVal as any).name;
                if (name === 'Agency Owner') return 'admin';
                if (name === 'Sales Manager') return 'sales';
                if (name === 'Strategist') return 'strategy';
                if (name === 'Video Editor') return 'editor';
                return name.toLowerCase().replace(' ', '_') as AppRole;
              }
              return r.role as AppRole;
            }).filter(Boolean),
        };
      });

      return members;
    },
    enabled: !authLoading && isAdmin && !!currentOrganization?.id,
  });

  // Add role mutation
  const addRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      if (!currentOrganization) throw new Error('No active organization');
      
      const { data: dbRoles, error: fetchErr } = await supabase
        .from('roles')
        .select('id, name');
      if (fetchErr) throw fetchErr;

      const matchedRole = dbRoles?.find(r => {
        const name = r.name.toLowerCase();
        if (role === 'admin') return name === 'agency owner' || name === 'admin';
        if (role === 'sales') return name === 'sales manager' || name === 'sales';
        if (role === 'strategy') return name === 'strategist' || name === 'strategy';
        if (role === 'editor') return name === 'video editor' || name === 'editor';
        if (role === 'social_media') return name === 'social media manager' || name === 'social_media';
        return false;
      });

      if (!matchedRole) throw new Error(`Role ${role} not found in database`);

      const { error } = await supabase
        .from('user_roles')
        .insert({ 
          user_id: userId, 
          role_id: matchedRole.id, 
          tenant_id: currentOrganization.id 
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast({ title: 'Role added successfully' });
      setIsRoleDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to add role', description: error.message, variant: 'destructive' });
    },
  });

  // Remove role mutation
  const removeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      if (!currentOrganization) throw new Error('No active organization');

      const { data: dbRoles, error: fetchErr } = await supabase
        .from('roles')
        .select('id, name');
      if (fetchErr) throw fetchErr;

      const matchedRole = dbRoles?.find(r => {
        const name = r.name.toLowerCase();
        if (role === 'admin') return name === 'agency owner' || name === 'admin';
        if (role === 'sales') return name === 'sales manager' || name === 'sales';
        if (role === 'strategy') return name === 'strategist' || name === 'strategy';
        if (role === 'editor') return name === 'video editor' || name === 'editor';
        if (role === 'social_media') return name === 'social media manager' || name === 'social_media';
        return false;
      });

      if (!matchedRole) throw new Error(`Role ${role} not found in database`);

      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role_id', matchedRole.id)
        .eq('tenant_id', currentOrganization.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast({ title: 'Role removed successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to remove role', description: error.message, variant: 'destructive' });
    },
  });

  // Fetch pending invitations
  const { data: teamInvitations = [] } = useQuery({
    queryKey: ['team-invitations', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      const { data, error } = await supabase
        .from('organization_invitations')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .eq('status', 'pending');
      if (error) throw error;
      return data || [];
    },
    enabled: !authLoading && !!currentOrganization?.id,
  });

  // Invite member mutation
  const inviteMemberMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: AppRole }) => {
      if (!currentOrganization) throw new Error('No active organization');

      const inviteToken = crypto.randomUUID();
      const expires = new Date();
      expires.setDate(expires.getDate() + 7);

      const { error } = await supabase
        .from('organization_invitations')
        .insert({
          organization_id: currentOrganization.id,
          email,
          role,
          token: inviteToken,
          expires_at: expires.toISOString(),
          status: 'pending'
        });

      if (error) throw error;

      return `${window.location.origin}/accept-invite?token=${inviteToken}`;
    },
    onSuccess: (inviteUrl) => {
      queryClient.invalidateQueries({ queryKey: ['team-invitations'] });
      setInviteEmail('');
      toast({ title: 'Invitation Generated', description: 'Invitation link copied to clipboard!' });
      navigator.clipboard.writeText(inviteUrl);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to invite member', description: error.message, variant: 'destructive' });
    },
  });

  // Remove member mutation
  const deleteMemberMutation = useMutation({
    mutationFn: async ({ memberId, userId }: { memberId: string; userId: string }) => {
      if (!currentOrganization) throw new Error('No active organization');

      // Delete roles mapping
      const { error: rolesError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('tenant_id', currentOrganization.id);

      if (rolesError) throw rolesError;

      // Delete from organization_members
      const { error: memberError } = await supabase
        .from('organization_members')
        .delete()
        .eq('id', memberId);

      if (memberError) throw memberError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast({ title: 'Member removed', description: 'The user membership has been canceled.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to remove member', description: error.message, variant: 'destructive' });
    },
  });

  // Cancel invitation mutation
  const cancelInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase
        .from('organization_invitations')
        .delete()
        .eq('id', inviteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-invitations'] });
      toast({ title: 'Invitation canceled' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to cancel invitation', description: error.message, variant: 'destructive' });
    },
  });

  // Edit member details mutation
  const editMemberMutation = useMutation({
    mutationFn: async ({ userId, name, email, roles }: { userId: string; name: string; email: string; roles: AppRole[] }) => {
      if (!currentOrganization) throw new Error('No active organization');

      // 1. Update profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: name, email })
        .eq('id', userId);
      if (profileError) throw profileError;

      // 2. Fetch all dynamic roles from the database to map AppRole to role_id
      const { data: dbRoles, error: rolesFetchError } = await supabase
        .from('roles')
        .select('id, name');
      if (rolesFetchError) throw rolesFetchError;

      const getRoleIdForAppRole = (appRole: AppRole) => {
        const matched = dbRoles?.find(r => {
          const rName = r.name.toLowerCase();
          if (appRole === 'admin') return rName === 'agency owner' || rName === 'admin';
          if (appRole === 'sales') return rName === 'sales manager' || rName === 'sales';
          if (appRole === 'strategy') return rName === 'strategist' || rName === 'strategy';
          if (appRole === 'editor') return rName === 'video editor' || rName === 'editor';
          if (appRole === 'social_media') return rName === 'social media manager' || rName === 'social_media';
          return false;
        });
        return matched?.id;
      };

      // 3. Fetch current roles of the user in this organization
      const { data: currentRolesData, error: getRolesError } = await supabase
        .from('user_roles')
        .select('*, role:roles(*)')
        .eq('user_id', userId)
        .eq('tenant_id', currentOrganization.id);
      if (getRolesError) throw getRolesError;

      const currentRoles = (currentRolesData || []).map(r => {
        const rName = r.role?.name;
        if (rName === 'Agency Owner') return 'admin';
        if (rName === 'Sales Manager') return 'sales';
        if (rName === 'Strategist') return 'strategy';
        if (rName === 'Video Editor') return 'editor';
        if (rName === 'Social Media Manager') return 'social_media';
        return (rName || '').toLowerCase().replace(' ', '_') as AppRole;
      }).filter(Boolean);

      // 4. Determine roles to add and delete
      const rolesToAdd = roles.filter(r => !currentRoles.includes(r));
      const rolesToDelete = currentRoles.filter(r => !roles.includes(r));

      // 5. Delete removed roles in this organization
      for (const role of rolesToDelete) {
        const roleId = getRoleIdForAppRole(role);
        if (roleId) {
          const { error: deleteRoleError } = await supabase
            .from('user_roles')
            .delete()
            .eq('user_id', userId)
            .eq('role_id', roleId)
            .eq('tenant_id', currentOrganization.id);
          if (deleteRoleError) throw deleteRoleError;
        }
      }

      // 6. Insert new roles in this organization
      for (const role of rolesToAdd) {
        const roleId = getRoleIdForAppRole(role);
        if (roleId) {
          const { error: addRoleError } = await supabase
            .from('user_roles')
            .insert({ 
              user_id: userId, 
              role_id: roleId, 
              tenant_id: currentOrganization.id 
            });
          if (addRoleError) throw addRoleError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      setIsEditDialogOpen(false);
      toast({ title: 'Member details updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update member details', description: error.message, variant: 'destructive' });
    },
  });

  const handleOpenEditDialog = (member: TeamMember) => {
    setSelectedMember(member);
    setEditMemberName(member.full_name || '');
    setEditMemberEmail(member.email || '');
    setEditMemberRoles(member.roles);
    setIsEditDialogOpen(true);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleAddRole = (member: TeamMember) => {
    setSelectedMember(member);
    // Find first role not already assigned
    const availableRole = (['admin', 'sales', 'strategy', 'editor', 'social_media'] as AppRole[])
      .find(r => !member.roles.includes(r));
    setSelectedRole(availableRole || 'sales');
    setIsRoleDialogOpen(true);
  };

  const handleRemoveRole = (userId: string, role: AppRole) => {
    removeRoleMutation.mutate({ userId, role });
  };

  return (
    <AppLayout title="User Settings">
      <div className="space-y-6">

        <Tabs defaultValue="team" className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1 p-1 w-full md:w-auto md:inline-flex">
            <TabsTrigger value="team" className="gap-1.5 text-xs md:text-sm px-2 md:px-3">
              <Users className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Team</span>
            </TabsTrigger>
            <TabsTrigger value="roles" className="gap-1.5 text-xs md:text-sm px-2 md:px-3">
              <Shield className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Roles</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-1.5 text-xs md:text-sm px-2 md:px-3">
              <Bell className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Notifications</span>
            </TabsTrigger>
            <TabsTrigger value="contracts" className="gap-1.5 text-xs md:text-sm px-2 md:px-3">
              <FileText className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Contracts</span>
            </TabsTrigger>
            <TabsTrigger value="preferences" className="gap-1.5 text-xs md:text-sm px-2 md:px-3">
              <SettingsIcon className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Preferences</span>
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-1.5 text-xs md:text-sm px-2 md:px-3">
              <Sparkles className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="hidden sm:inline">AI Config</span>
            </TabsTrigger>
          </TabsList>

          {/* Team Management Tab */}
          <TabsContent value="team" className="space-y-6">
            {/* Invite Panel */}
            <Card>
              <CardHeader>
                <CardTitle>Invite New Member</CardTitle>
                <CardDescription>Generate a secure invitation link to add members to this workspace.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <Input 
                    type="email" 
                    placeholder="teammember@domain.com" 
                    value={inviteEmail} 
                    onChange={(e) => setInviteEmail(e.target.value)} 
                    className="bg-background/40"
                  />
                </div>
                <div className="w-[200px]">
                  <Select value={inviteRole} onValueChange={(val) => setInviteRole(val as AppRole)}>
                    <SelectTrigger className="bg-background/40">
                      <SelectValue placeholder="Select Role" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(ROLE_LABELS) as [AppRole, string][]).map(([role, label]) => (
                        <SelectItem key={role} value={role}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={() => inviteMemberMutation.mutate({ email: inviteEmail, role: inviteRole })} 
                  className="bg-purple-600 hover:bg-purple-700 text-white" 
                  disabled={inviteMemberMutation.isPending || !inviteEmail || !inviteRole}
                >
                  {inviteMemberMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
                  Generate Invite
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>
                  View and manage all team members and their assigned roles
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-6 sm:mx-0">
                    <div className="inline-block min-w-full align-middle px-6 sm:px-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="whitespace-nowrap">Member</TableHead>
                            <TableHead className="whitespace-nowrap hidden sm:table-cell">Email</TableHead>
                            <TableHead className="whitespace-nowrap">Roles</TableHead>
                            <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {teamMembers.map((member) => (
                            <TableRow key={member.id}>
                              <TableCell>
                                <div className="flex items-center gap-2 sm:gap-3">
                                  <Avatar className="h-8 w-8 sm:h-9 sm:w-9 shrink-0">
                                    <AvatarFallback className="bg-primary/10 text-primary text-xs sm:text-sm">
                                      {getInitials(member.full_name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0">
                                    <span className="font-medium block truncate text-sm sm:text-base">
                                      {member.full_name || 'Unknown'}
                                    </span>
                                    <span className="text-xs text-muted-foreground truncate block sm:hidden">
                                      {member.email || '-'}
                                    </span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground hidden sm:table-cell">
                                {member.email || '-'}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {member.roles.length > 0 ? (
                                    member.roles.map((role) => (
                                      <Badge
                                        key={role}
                                        className={`${ROLE_COLORS[role] || 'bg-zinc-500 text-white'} cursor-pointer group relative text-xs`}
                                      >
                                        <span className="hidden sm:inline">{ROLE_LABELS[role] || role}</span>
                                        <span className="sm:hidden">{(ROLE_LABELS[role] || role).slice(0, 3)}</span>
                                        <button
                                          onClick={() => handleRemoveRole(member.id, role)}
                                          className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                          disabled={removeRoleMutation.isPending}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </Badge>
                                    ))
                                  ) : (
                                    <span className="text-muted-foreground text-xs sm:text-sm">No roles</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenEditDialog(member)}
                                    className="h-8 px-2 sm:px-3"
                                  >
                                    <SettingsIcon className="h-4 w-4 sm:mr-1" />
                                    <span className="hidden sm:inline">Edit</span>
                                  </Button>
                                  {member.id !== user?.id && member.id !== currentOrganization?.owner_id && member.membershipId && (
                                    <Button 
                                      size="icon" 
                                      variant="ghost" 
                                      onClick={() => {
                                        if (confirm("Are you sure you want to remove this member from the workspace?")) {
                                          deleteMemberMutation.mutate({ memberId: member.membershipId!, userId: member.id });
                                        }
                                      }}
                                      className="h-8 w-8 text-muted-foreground hover:text-red-400 text-right"
                                      disabled={deleteMemberMutation.isPending}
                                    >
                                      {deleteMemberMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {teamMembers.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                No team members found
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pending Invites */}
            {teamInvitations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Pending Workspace Invitations</CardTitle>
                  <CardDescription>Copy active links for team members to join. Link expires in 7 days.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Assigned Role</TableHead>
                        <TableHead>Expiration Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamInvitations.map((invite: any) => (
                        <TableRow key={invite.id}>
                          <TableCell>{invite.email}</TableCell>
                          <TableCell className="capitalize text-muted-foreground">{ROLE_LABELS[invite.role as AppRole] || invite.role}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {invite.expires_at ? new Date(invite.expires_at).toLocaleDateString() : 'N/A'}
                          </TableCell>
                          <TableCell className="text-right flex items-center justify-end gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                const inviteUrl = `${window.location.origin}/accept-invite?token=${invite.token}`;
                                navigator.clipboard.writeText(inviteUrl);
                                toast({ title: "Copied Link!", description: "Invitation link copied to clipboard!" });
                              }}
                              className="text-xs bg-background/50 hover:bg-purple-600 hover:text-white"
                            >
                              Copy Link
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => cancelInviteMutation.mutate(invite.id)}
                              className="text-xs text-red-400 hover:text-red-300"
                              disabled={cancelInviteMutation.isPending}
                            >
                              Cancel
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Roles Overview Tab */}
          <TabsContent value="roles" className="space-y-6">
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {(Object.entries(ROLE_LABELS) as [AppRole, string][]).map(([role, label]) => {
                const membersWithRole = teamMembers.filter(m => m.roles.includes(role));
                return (
                  <Card key={role}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base sm:text-lg">{label}</CardTitle>
                        <Badge className={ROLE_COLORS[role]}>{membersWithRole.length}</Badge>
                      </div>
                      <CardDescription className="text-xs sm:text-sm">
                        {role === 'admin' && 'Full access to all features and settings'}
                        {role === 'sales' && 'Manage leads, proposals, and contracts'}
                        {role === 'strategy' && 'Handle content strategy and planning'}
                        {role === 'editor' && 'Edit and produce video content'}
                        {role === 'social_media' && 'Manage calendar and publishing'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {membersWithRole.slice(0, 3).map((member) => (
                          <div key={member.id} className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {getInitials(member.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs sm:text-sm truncate">{member.full_name}</span>
                          </div>
                        ))}
                        {membersWithRole.length > 3 && (
                          <span className="text-xs sm:text-sm text-muted-foreground">
                            +{membersWithRole.length - 3} more
                          </span>
                        )}
                        {membersWithRole.length === 0 && (
                          <span className="text-xs sm:text-sm text-muted-foreground">No members</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Email Notification Preferences</CardTitle>
                <CardDescription>
                  Configure which email notifications you want to receive
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {isLoadingPrefs ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4 border-b">
                      <div className="space-y-0.5">
                        <Label className="text-base font-semibold">Email Notifications</Label>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          Master toggle to enable or disable all email notifications
                        </p>
                      </div>
                      <Switch 
                        checked={notificationPrefs.email_enabled}
                        onCheckedChange={(checked) => setNotificationPrefs(prev => ({ ...prev, email_enabled: checked }))}
                      />
                    </div>

                    <div className={`space-y-4 ${!notificationPrefs.email_enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <Label className="text-sm">Proposal Accepted</Label>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            Get notified when a proposal is accepted by a lead
                          </p>
                        </div>
                        <Switch 
                          checked={notificationPrefs.proposal_accepted}
                          onCheckedChange={(checked) => setNotificationPrefs(prev => ({ ...prev, proposal_accepted: checked }))}
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <Label className="text-sm">Contract Renewal Alerts</Label>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            Get notified when contracts enter month 5 (renewal phase)
                          </p>
                        </div>
                        <Switch 
                          checked={notificationPrefs.contract_renewal}
                          onCheckedChange={(checked) => setNotificationPrefs(prev => ({ ...prev, contract_renewal: checked }))}
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <Label className="text-sm">Shoot Scheduled</Label>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            Get notified when a new shoot is scheduled
                          </p>
                        </div>
                        <Switch 
                          checked={notificationPrefs.shoot_scheduled}
                          onCheckedChange={(checked) => setNotificationPrefs(prev => ({ ...prev, shoot_scheduled: checked }))}
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <Label className="text-sm">Editing Delay Alerts</Label>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            Get notified when reels are stuck in editing for over 48 hours
                          </p>
                        </div>
                        <Switch 
                          checked={notificationPrefs.editing_delay}
                          onCheckedChange={(checked) => setNotificationPrefs(prev => ({ ...prev, editing_delay: checked }))}
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <Label className="text-sm">Missed Post Alerts</Label>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            Get notified when a scheduled post is missed
                          </p>
                        </div>
                        <Switch 
                          checked={notificationPrefs.missed_post}
                          onCheckedChange={(checked) => setNotificationPrefs(prev => ({ ...prev, missed_post: checked }))}
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <Label className="text-sm">Client At Risk Alerts</Label>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            Get notified when a client's health status changes to "at risk"
                          </p>
                        </div>
                        <Switch 
                          checked={notificationPrefs.client_at_risk}
                          onCheckedChange={(checked) => setNotificationPrefs(prev => ({ ...prev, client_at_risk: checked }))}
                        />
                      </div>
                    </div>

                    <Button 
                      onClick={() => saveNotificationPrefsMutation.mutate(notificationPrefs)}
                      disabled={saveNotificationPrefsMutation.isPending}
                      className="w-full md:w-auto"
                    >
                      {saveNotificationPrefsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Save Notification Preferences
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notification Log</CardTitle>
                <CardDescription>
                  Recent email notifications sent to your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <NotificationLogTable userId={user?.id} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contracts Tab */}
          <TabsContent value="contracts" className="space-y-6">
            {/* Company Branding */}
            <Card>
              <CardHeader>
                <CardTitle>Company Branding</CardTitle>
                <CardDescription>
                  Configure your company details for contract PDFs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="companyName" className="text-sm">Company Name</Label>
                    <Input 
                      id="companyName" 
                      value={companySettings.companyName}
                      onChange={(e) => setCompanySettings(prev => ({ ...prev, companyName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tagline" className="text-sm">Tagline</Label>
                    <Input 
                      id="tagline" 
                      value={companySettings.tagline}
                      onChange={(e) => setCompanySettings(prev => ({ ...prev, tagline: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyEmail" className="text-sm">Email</Label>
                    <Input 
                      id="companyEmail" 
                      type="email"
                      value={companySettings.email}
                      onChange={(e) => setCompanySettings(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyPhone" className="text-sm">Phone</Label>
                    <Input 
                      id="companyPhone" 
                      value={companySettings.phone}
                      onChange={(e) => setCompanySettings(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website" className="text-sm">Website</Label>
                    <Input 
                      id="website" 
                      value={companySettings.website}
                      onChange={(e) => setCompanySettings(prev => ({ ...prev, website: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address" className="text-sm">Address</Label>
                    <Input 
                      id="address" 
                      value={companySettings.address}
                      onChange={(e) => setCompanySettings(prev => ({ ...prev, address: e.target.value }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bank Details */}
            <Card>
              <CardHeader>
                <CardTitle>Bank & Tax Details</CardTitle>
                <CardDescription>
                  Bank information displayed on contract payment terms
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="bankName" className="text-sm">Bank Name</Label>
                    <Input 
                      id="bankName" 
                      value={companySettings.bankName}
                      onChange={(e) => setCompanySettings(prev => ({ ...prev, bankName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accountNumber" className="text-sm">Account Number</Label>
                    <Input 
                      id="accountNumber" 
                      value={companySettings.accountNumber}
                      onChange={(e) => setCompanySettings(prev => ({ ...prev, accountNumber: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ifscCode" className="text-sm">IFSC Code</Label>
                    <Input 
                      id="ifscCode" 
                      value={companySettings.ifscCode}
                      onChange={(e) => setCompanySettings(prev => ({ ...prev, ifscCode: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gstNumber" className="text-sm">GST Number</Label>
                    <Input 
                      id="gstNumber" 
                      value={companySettings.gstNumber}
                      onChange={(e) => setCompanySettings(prev => ({ ...prev, gstNumber: e.target.value }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contract Terms */}
            <Card>
              <CardHeader>
                <CardTitle>Contract Terms & Policies</CardTitle>
                <CardDescription>
                  Customize the legal terms included in your contracts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="paymentTerms" className="text-sm">Payment Terms</Label>
                  <Textarea 
                    id="paymentTerms" 
                    rows={3}
                    className="text-sm"
                    value={contractTerms.paymentTerms}
                    onChange={(e) => setContractTerms(prev => ({ ...prev, paymentTerms: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cancellationPolicy" className="text-sm">Cancellation Policy</Label>
                  <Textarea 
                    id="cancellationPolicy" 
                    rows={3}
                    className="text-sm"
                    value={contractTerms.cancellationPolicy}
                    onChange={(e) => setContractTerms(prev => ({ ...prev, cancellationPolicy: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deliverables" className="text-sm">Deliverables & IP Rights</Label>
                  <Textarea 
                    id="deliverables" 
                    rows={3}
                    className="text-sm"
                    value={contractTerms.deliverables}
                    onChange={(e) => setContractTerms(prev => ({ ...prev, deliverables: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confidentiality" className="text-sm">Confidentiality Clause</Label>
                  <Textarea 
                    id="confidentiality" 
                    rows={2}
                    className="text-sm"
                    value={contractTerms.confidentiality}
                    onChange={(e) => setContractTerms(prev => ({ ...prev, confidentiality: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="revisionPolicy" className="text-sm">Revision Policy</Label>
                  <Textarea 
                    id="revisionPolicy" 
                    rows={2}
                    className="text-sm"
                    value={contractTerms.revisionPolicy}
                    onChange={(e) => setContractTerms(prev => ({ ...prev, revisionPolicy: e.target.value }))}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Preview & Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Preview Contract</CardTitle>
                <CardDescription>
                  Generate a sample contract PDF with your current settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <Button
                    onClick={() => {
                      const now = new Date();
                      const endDate = new Date(now);
                      endDate.setMonth(endDate.getMonth() + 6);
                      
                      const sampleClient: Client = {
                        id: 'sample-id',
                        client_name: 'Sample Client',
                        brand_name: 'Sample Brand',
                        plan_type: 'accelerator' as PlanType,
                        status: 'active',
                        health_status: 'good',
                        start_date: now.toISOString().split('T')[0],
                        end_date: endDate.toISOString().split('T')[0],
                        current_contract_month: 1,
                        platforms_managed: ['Instagram', 'YouTube'],
                        niche: 'Business',
                        notes: null,
                        lead_id: null,
                        proposal_id: null,
                        account_manager_id: null,
                        created_at: now.toISOString(),
                        updated_at: now.toISOString(),
                      };
                      
                      const sampleContract = {
                        id: 'sample-contract-id',
                        client_id: 'sample-id',
                        start_date: now.toISOString().split('T')[0],
                        end_date: endDate.toISOString().split('T')[0],
                        duration_months: 6,
                        monthly_retainer: 75000,
                        payment_status: 'pending' as const,
                        contract_status: 'active' as const,
                        renewal_probability: 'high' as const,
                        amount_received: 0,
                        payment_notes: null,
                        created_at: now.toISOString(),
                        updated_at: now.toISOString(),
                        client: sampleClient,
                      };
                      
                      generateContractPdf(sampleContract);
                      toast({ title: 'Sample contract PDF generated!' });
                    }}
                    className="gap-2 w-full sm:w-auto"
                  >
                    <Download className="h-4 w-4" />
                    Download Sample PDF
                  </Button>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Preview how your contracts will look with current settings
                  </p>
                </div>
                <Button 
                  onClick={() => toast({ title: 'Settings saved successfully!' })}
                  className="w-full sm:w-auto"
                >
                  Save Contract Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>
                  Configure general application preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <Label className="text-sm">Email Notifications</Label>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Receive email notifications for important updates
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <Label className="text-sm">Auto-assign Leads</Label>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Automatically assign new leads to sales team members
                    </p>
                  </div>
                  <Switch />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <Label className="text-sm">Contract Renewal Alerts</Label>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Get notified 30 days before contract expiration
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Default Values</CardTitle>
                <CardDescription>
                  Set default values for new entries
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="defaultReels" className="text-sm">Default Reels per Month</Label>
                    <Input id="defaultReels" type="number" defaultValue={8} min={1} max={50} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="defaultShootDays" className="text-sm">Default Shoot Days per Month</Label>
                    <Input id="defaultShootDays" type="number" defaultValue={2} min={1} max={10} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="defaultDuration" className="text-sm">Default Contract Duration (months)</Label>
                    <Input id="defaultDuration" type="number" defaultValue={6} min={1} max={24} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="defaultPlatform" className="text-sm">Default Platform</Label>
                    <Select defaultValue="instagram">
                      <SelectTrigger id="defaultPlatform">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="instagram">Instagram</SelectItem>
                        <SelectItem value="youtube">YouTube</SelectItem>
                        <SelectItem value="linkedin">LinkedIn</SelectItem>
                        <SelectItem value="tiktok">TikTok</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button className="mt-4 w-full sm:w-auto">Save Preferences</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Settings Tab */}
          <TabsContent value="ai" className="space-y-6">
            <Card className="backdrop-blur-md bg-card/50 border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-400" />
                  AI Assistant Settings
                </CardTitle>
                <CardDescription>
                  Configure your AI providers and models. API keys are stored strictly in your browser's local storage and are never sent to our servers.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="aiProvider" className="text-sm font-semibold">Active Provider</Label>
                    <Select 
                      value={aiProvider} 
                      onValueChange={(val: any) => {
                        setAiProvider(val);
                        // Auto-fill default models
                        if (val === 'gemini') setAiModel('gemini-1.5-flash');
                        else if (val === 'openai') setAiModel('gpt-4o');
                        else if (val === 'anthropic') setAiModel('claude-3-5-sonnet-20241022');
                        else if (val === 'custom') setAiModel('llama3');
                      }}
                    >
                      <SelectTrigger id="aiProvider" className="bg-background/50 border-white/10">
                        <SelectValue placeholder="Select AI provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gemini">Google Gemini (Recommended)</SelectItem>
                        <SelectItem value="openai">OpenAI (ChatGPT)</SelectItem>
                        <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                        <SelectItem value="custom">Custom (Local Ollama / vLLM)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="aiModel" className="text-sm font-semibold">Model Name</Label>
                    <Input 
                      id="aiModel" 
                      placeholder="e.g. gemini-1.5-flash, gpt-4o, claude-3-5-sonnet-20241022" 
                      value={aiModel} 
                      onChange={(e) => setAiModel(e.target.value)}
                      className="bg-background/50 border-white/10"
                    />
                    <p className="text-xs text-muted-foreground">
                      Specify the exact model identifier to use with the selected provider.
                    </p>
                  </div>

                  {aiProvider === 'custom' && (
                    <div className="space-y-2">
                      <Label htmlFor="aiBaseUrl" className="text-sm font-semibold">Custom API Base URL</Label>
                      <Input 
                        id="aiBaseUrl" 
                        placeholder="e.g. http://localhost:11434/v1/chat/completions" 
                        value={aiBaseUrl} 
                        onChange={(e) => setAiBaseUrl(e.target.value)}
                        className="bg-background/50 border-white/10"
                      />
                      <p className="text-xs text-muted-foreground">
                        The full HTTP endpoint URL to send chat completion requests to.
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="aiKey" className="text-sm font-semibold">
                      API Key {aiProvider === 'custom' ? '(Optional)' : ''}
                    </Label>
                    <Input 
                      id="aiKey" 
                      type="password" 
                      placeholder={aiProvider === 'custom' ? "Enter bearer token if required" : "Enter your API key"} 
                      value={aiKey} 
                      onChange={(e) => setAiKey(e.target.value)}
                      className="bg-background/50 border-white/10"
                    />
                    <p className="text-xs text-muted-foreground">
                      Your key will only be used directly from your browser to complete generation requests.
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <Button onClick={handleSaveAiConfig} className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white">
                    Save AI Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Role Dialog */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Role</DialogTitle>
            <DialogDescription>
              Add a new role to {selectedMember?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Role</Label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['admin', 'sales', 'strategy', 'editor', 'social_media'] as AppRole[])
                    .filter(r => !selectedMember?.roles.includes(r))
                    .map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedMember) {
                  addRoleMutation.mutate({ userId: selectedMember.id, role: selectedRole });
                }
              }}
              disabled={addRoleMutation.isPending}
            >
              {addRoleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Member Details Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Member Details</DialogTitle>
            <DialogDescription>
              Modify name, email, and roles for {selectedMember?.full_name || 'this team member'}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="memberName">Name</Label>
              <Input
                id="memberName"
                value={editMemberName}
                onChange={(e) => setEditMemberName(e.target.value)}
                placeholder="Full Name"
                disabled={selectedMember?.id === currentOrganization?.owner_id}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="memberEmail">Email</Label>
              <Input
                id="memberEmail"
                type="email"
                value={editMemberEmail}
                onChange={(e) => setEditMemberEmail(e.target.value)}
                placeholder="Email Address"
                disabled={selectedMember?.id === currentOrganization?.owner_id}
              />
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold">Assigned Roles</Label>
              {selectedMember?.id === currentOrganization?.owner_id ? (
                <div className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 p-3 rounded-md">
                  This user is the Organization Owner. Their roles cannot be modified to prevent lockouts.
                </div>
              ) : (
                <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
                  {(['admin', 'sales', 'strategy', 'editor', 'social_media'] as AppRole[]).map((role) => {
                    const isChecked = editMemberRoles.includes(role);
                    const descriptions: Record<AppRole, string> = {
                      admin: 'Full administrator rights: settings, team, billing, clients.',
                      sales: 'Access to manage leads and client proposals.',
                      strategy: 'Access to client strategy templates and content cycles.',
                      editor: 'Access to reels catalog and review annotations.',
                      social_media: 'Access to content calendar and scheduling.',
                    };
                    return (
                      <div key={role} className="flex items-start gap-3 p-2 rounded-md hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                        <Checkbox
                          id={`role-${role}`}
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setEditMemberRoles((prev) => [...prev, role]);
                            } else {
                              setEditMemberRoles((prev) => prev.filter((r) => r !== role));
                            }
                          }}
                        />
                        <div className="grid gap-0.5 leading-none">
                          <Label htmlFor={`role-${role}`} className="text-sm font-medium cursor-pointer">
                            {ROLE_LABELS[role]}
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            {descriptions[role]}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedMember) {
                  editMemberMutation.mutate({
                    userId: selectedMember.id,
                    name: editMemberName,
                    email: editMemberEmail,
                    roles: editMemberRoles,
                  });
                }
              }}
              disabled={editMemberMutation.isPending}
            >
              {editMemberMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
