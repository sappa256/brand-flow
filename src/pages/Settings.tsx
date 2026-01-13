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
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Users, Shield, Settings as SettingsIcon, Plus, Trash2, Loader2, FileText, Download, Bell } from 'lucide-react';
import type { AppRole } from '@/types/crm';
import { Navigate } from 'react-router-dom';
import { generateContractPdf } from '@/lib/contractPdfGenerator';
import type { Contract, Client, PlanType } from '@/types/crm';

interface NotificationPreferences {
  email_enabled: boolean;
  proposal_accepted: boolean;
  contract_renewal: boolean;
  shoot_scheduled: boolean;
  editing_delay: boolean;
  missed_post: boolean;
  client_at_risk: boolean;
}

const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Admin',
  sales: 'Sales',
  strategy: 'Strategy',
  editor: 'Editor',
  social_media: 'Social Media',
};

const ROLE_COLORS: Record<AppRole, string> = {
  admin: 'bg-destructive text-destructive-foreground',
  sales: 'bg-blue-500 text-white',
  strategy: 'bg-purple-500 text-white',
  editor: 'bg-orange-500 text-white',
  social_media: 'bg-green-500 text-white',
};

interface TeamMember {
  id: string;
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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Event</TableHead>
          <TableHead>Subject</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {notifications.map((notification: any) => (
          <TableRow key={notification.id}>
            <TableCell className="capitalize">
              {notification.event_type.replace(/_/g, ' ')}
            </TableCell>
            <TableCell className="max-w-[200px] truncate">
              {notification.subject}
            </TableCell>
            <TableCell>
              <Badge variant={notification.is_sent ? 'default' : 'secondary'}>
                {notification.is_sent ? 'Sent' : 'Pending'}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {new Date(notification.created_at).toLocaleDateString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function Settings() {
  const { hasRole, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AppRole>('sales');
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

  // Check admin access
  if (!hasRole('admin')) {
    return <Navigate to="/" replace />;
  }

  // Fetch all team members with their roles
  const { data: teamMembers = [], isLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      // Fetch all profiles (admin can see all)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: allRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      // Combine profiles with roles
      const members: TeamMember[] = (profiles || []).map(profile => ({
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        avatar_url: profile.avatar_url,
        roles: (allRoles || [])
          .filter(r => r.user_id === profile.id)
          .map(r => r.role as AppRole),
      }));

      return members;
    },
  });

  // Add role mutation
  const addRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role });
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
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);
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
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage team members, roles, and app preferences</p>
        </div>

        <Tabs defaultValue="team" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-[625px]">
            <TabsTrigger value="team" className="gap-2">
              <Users className="h-4 w-4" />
              Team
            </TabsTrigger>
            <TabsTrigger value="roles" className="gap-2">
              <Shield className="h-4 w-4" />
              Roles
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="contracts" className="gap-2">
              <FileText className="h-4 w-4" />
              Contracts
            </TabsTrigger>
            <TabsTrigger value="preferences" className="gap-2">
              <SettingsIcon className="h-4 w-4" />
              Preferences
            </TabsTrigger>
          </TabsList>

          {/* Team Management Tab */}
          <TabsContent value="team" className="space-y-6">
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
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Roles</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamMembers.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                  {getInitials(member.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{member.full_name || 'Unknown'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {member.email || '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {member.roles.length > 0 ? (
                                member.roles.map((role) => (
                                  <Badge
                                    key={role}
                                    className={`${ROLE_COLORS[role]} cursor-pointer group relative`}
                                  >
                                    {ROLE_LABELS[role]}
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
                                <span className="text-muted-foreground text-sm">No roles</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAddRole(member)}
                              disabled={member.roles.length >= 5}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add Role
                            </Button>
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
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Roles Overview Tab */}
          <TabsContent value="roles" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {(Object.entries(ROLE_LABELS) as [AppRole, string][]).map(([role, label]) => {
                const membersWithRole = teamMembers.filter(m => m.roles.includes(role));
                return (
                  <Card key={role}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{label}</CardTitle>
                        <Badge className={ROLE_COLORS[role]}>{membersWithRole.length}</Badge>
                      </div>
                      <CardDescription>
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
                            <span className="text-sm">{member.full_name}</span>
                          </div>
                        ))}
                        {membersWithRole.length > 3 && (
                          <span className="text-sm text-muted-foreground">
                            +{membersWithRole.length - 3} more
                          </span>
                        )}
                        {membersWithRole.length === 0 && (
                          <span className="text-sm text-muted-foreground">No members</span>
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
                    <div className="flex items-center justify-between py-4 border-b">
                      <div className="space-y-0.5">
                        <Label className="text-base font-semibold">Email Notifications</Label>
                        <p className="text-sm text-muted-foreground">
                          Master toggle to enable or disable all email notifications
                        </p>
                      </div>
                      <Switch 
                        checked={notificationPrefs.email_enabled}
                        onCheckedChange={(checked) => setNotificationPrefs(prev => ({ ...prev, email_enabled: checked }))}
                      />
                    </div>

                    <div className={`space-y-4 ${!notificationPrefs.email_enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Proposal Accepted</Label>
                          <p className="text-sm text-muted-foreground">
                            Get notified when a proposal is accepted by a lead
                          </p>
                        </div>
                        <Switch 
                          checked={notificationPrefs.proposal_accepted}
                          onCheckedChange={(checked) => setNotificationPrefs(prev => ({ ...prev, proposal_accepted: checked }))}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Contract Renewal Alerts</Label>
                          <p className="text-sm text-muted-foreground">
                            Get notified when contracts enter month 5 (renewal phase)
                          </p>
                        </div>
                        <Switch 
                          checked={notificationPrefs.contract_renewal}
                          onCheckedChange={(checked) => setNotificationPrefs(prev => ({ ...prev, contract_renewal: checked }))}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Shoot Scheduled</Label>
                          <p className="text-sm text-muted-foreground">
                            Get notified when a new shoot is scheduled
                          </p>
                        </div>
                        <Switch 
                          checked={notificationPrefs.shoot_scheduled}
                          onCheckedChange={(checked) => setNotificationPrefs(prev => ({ ...prev, shoot_scheduled: checked }))}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Editing Delay Alerts</Label>
                          <p className="text-sm text-muted-foreground">
                            Get notified when reels are stuck in editing for over 48 hours
                          </p>
                        </div>
                        <Switch 
                          checked={notificationPrefs.editing_delay}
                          onCheckedChange={(checked) => setNotificationPrefs(prev => ({ ...prev, editing_delay: checked }))}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Missed Post Alerts</Label>
                          <p className="text-sm text-muted-foreground">
                            Get notified when a scheduled post is missed
                          </p>
                        </div>
                        <Switch 
                          checked={notificationPrefs.missed_post}
                          onCheckedChange={(checked) => setNotificationPrefs(prev => ({ ...prev, missed_post: checked }))}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Client At Risk Alerts</Label>
                          <p className="text-sm text-muted-foreground">
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
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input 
                      id="companyName" 
                      value={companySettings.companyName}
                      onChange={(e) => setCompanySettings(prev => ({ ...prev, companyName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tagline">Tagline</Label>
                    <Input 
                      id="tagline" 
                      value={companySettings.tagline}
                      onChange={(e) => setCompanySettings(prev => ({ ...prev, tagline: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyEmail">Email</Label>
                    <Input 
                      id="companyEmail" 
                      type="email"
                      value={companySettings.email}
                      onChange={(e) => setCompanySettings(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyPhone">Phone</Label>
                    <Input 
                      id="companyPhone" 
                      value={companySettings.phone}
                      onChange={(e) => setCompanySettings(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input 
                      id="website" 
                      value={companySettings.website}
                      onChange={(e) => setCompanySettings(prev => ({ ...prev, website: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
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
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="bankName">Bank Name</Label>
                    <Input 
                      id="bankName" 
                      value={companySettings.bankName}
                      onChange={(e) => setCompanySettings(prev => ({ ...prev, bankName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accountNumber">Account Number</Label>
                    <Input 
                      id="accountNumber" 
                      value={companySettings.accountNumber}
                      onChange={(e) => setCompanySettings(prev => ({ ...prev, accountNumber: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ifscCode">IFSC Code</Label>
                    <Input 
                      id="ifscCode" 
                      value={companySettings.ifscCode}
                      onChange={(e) => setCompanySettings(prev => ({ ...prev, ifscCode: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gstNumber">GST Number</Label>
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
                  <Label htmlFor="paymentTerms">Payment Terms</Label>
                  <Textarea 
                    id="paymentTerms" 
                    rows={3}
                    value={contractTerms.paymentTerms}
                    onChange={(e) => setContractTerms(prev => ({ ...prev, paymentTerms: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cancellationPolicy">Cancellation Policy</Label>
                  <Textarea 
                    id="cancellationPolicy" 
                    rows={3}
                    value={contractTerms.cancellationPolicy}
                    onChange={(e) => setContractTerms(prev => ({ ...prev, cancellationPolicy: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deliverables">Deliverables & IP Rights</Label>
                  <Textarea 
                    id="deliverables" 
                    rows={3}
                    value={contractTerms.deliverables}
                    onChange={(e) => setContractTerms(prev => ({ ...prev, deliverables: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confidentiality">Confidentiality Clause</Label>
                  <Textarea 
                    id="confidentiality" 
                    rows={2}
                    value={contractTerms.confidentiality}
                    onChange={(e) => setContractTerms(prev => ({ ...prev, confidentiality: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="revisionPolicy">Revision Policy</Label>
                  <Textarea 
                    id="revisionPolicy" 
                    rows={2}
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
                <div className="flex items-center gap-4">
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
                        created_at: now.toISOString(),
                        updated_at: now.toISOString(),
                        client: sampleClient,
                      };
                      
                      generateContractPdf(sampleContract);
                      toast({ title: 'Sample contract PDF generated!' });
                    }}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download Sample PDF
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Preview how your contracts will look with current settings
                  </p>
                </div>
                <Button 
                  onClick={() => toast({ title: 'Settings saved successfully!' })}
                  className="w-full md:w-auto"
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
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive email notifications for important updates
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-assign Leads</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically assign new leads to sales team members
                    </p>
                  </div>
                  <Switch />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Contract Renewal Alerts</Label>
                    <p className="text-sm text-muted-foreground">
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
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="defaultReels">Default Reels per Month</Label>
                    <Input id="defaultReels" type="number" defaultValue={8} min={1} max={50} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="defaultShootDays">Default Shoot Days per Month</Label>
                    <Input id="defaultShootDays" type="number" defaultValue={2} min={1} max={10} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="defaultDuration">Default Contract Duration (months)</Label>
                    <Input id="defaultDuration" type="number" defaultValue={6} min={1} max={24} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="defaultPlatform">Default Platform</Label>
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
                <Button className="mt-4">Save Preferences</Button>
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
    </AppLayout>
  );
}
