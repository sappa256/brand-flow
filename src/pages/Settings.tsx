import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Users, Shield, Settings as SettingsIcon, Plus, Trash2, Loader2 } from 'lucide-react';
import type { AppRole } from '@/types/crm';
import { Navigate } from 'react-router-dom';

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

export default function Settings() {
  const { hasRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AppRole>('sales');

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
          <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
            <TabsTrigger value="team" className="gap-2">
              <Users className="h-4 w-4" />
              Team
            </TabsTrigger>
            <TabsTrigger value="roles" className="gap-2">
              <Shield className="h-4 w-4" />
              Roles
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
