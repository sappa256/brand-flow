import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Building2, 
  Users, 
  CreditCard, 
  Sparkles, 
  Trash2, 
  UserPlus, 
  ArrowRightLeft, 
  Loader2, 
  Award,
  Globe,
  Activity,
  Download,
  AlertTriangle,
  Search,
  Eye,
  Key
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import type { OrganizationInvitation, Role, AuditLog, AiRequestHistory } from '@/types/crm';

const TIMEZONES = [
  'Asia/Kolkata',
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Australia/Sydney'
];

export default function OrgSettings() {
  const { currentOrganization, user, refreshOrganizations } = useAuth();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const isOwner = currentOrganization?.owner_id === user?.id;

  // General settings state
  const [orgName, setOrgName] = useState(currentOrganization?.name || '');
  const [orgSlug, setOrgSlug] = useState(currentOrganization?.slug || '');
  const [orgTimezone, setOrgTimezone] = useState(currentOrganization?.timezone || 'Asia/Kolkata');
  const [brandingTheme, setBrandingTheme] = useState(currentOrganization?.branding?.theme || 'dark');
  const [brandingLogo, setBrandingLogo] = useState(currentOrganization?.branding?.logoUrl || '');

  // AI settings state
  const [aiProvider, setAiProvider] = useState(currentOrganization?.ai_settings?.provider || 'gemini');
  const [aiModel, setAiModel] = useState(currentOrganization?.ai_settings?.model || 'gemini-1.5-flash');
  const [aiCustomUrl, setAiCustomUrl] = useState(currentOrganization?.ai_settings?.customUrl || '');
  
  // Custom encrypted API keys state
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [isSavingKeys, setIsSavingKeys] = useState(false);

  // Members list & invites state
  const [members, setMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [dbRoles, setDbRoles] = useState<Role[]>([]);
  const [memberRolesMap, setMemberRolesMap] = useState<Record<string, string>>({}); // user_id -> role_id
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  // Ownership transfer state
  const [newOwnerId, setNewOwnerId] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterEntity, setFilterEntity] = useState('all');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // AI Analytics state
  const [aiLogs, setAiLogs] = useState<AiRequestHistory[]>([]);
  const [aiStats, setAiStats] = useState({
    totalRequests: 0,
    totalTokens: 0,
    totalCost: 0,
    errorRate: 0
  });
  const [chartData, setChartData] = useState<any[]>([]);

  // Usage stats state
  const [usageStats, setUsageStats] = useState({
    clients: 0,
    reels: 0,
    shoots: 0
  });

  useEffect(() => {
    if (currentOrganization) {
      setOrgName(currentOrganization.name);
      setOrgSlug(currentOrganization.slug);
      setOrgTimezone(currentOrganization.timezone);
      setBrandingTheme(currentOrganization.branding?.theme || 'dark');
      setBrandingLogo(currentOrganization.branding?.logoUrl || '');
      
      setAiProvider(currentOrganization.ai_settings?.provider || 'gemini');
      setAiModel(currentOrganization.ai_settings?.model || 'gemini-1.5-flash');
      setAiCustomUrl(currentOrganization.ai_settings?.customUrl || '');

      fetchMembersAndInvites();
      fetchUsageStats();
      fetchRoles();
      fetchAuditLogs();
      fetchAiUsageLogs();
    }
  }, [currentOrganization]);

  const fetchRoles = async () => {
    if (!currentOrganization) return;
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .or(`tenant_id.is.null,tenant_id.eq.${currentOrganization.id}`);
      
      if (error) throw error;
      if (data) {
        setDbRoles(data as Role[]);
        // Set default selected role for invites
        const defaultRole = data.find(r => r.name === 'Video Editor');
        if (defaultRole) {
          setInviteRoleId(defaultRole.id);
        }
      }
    } catch (err) {
      console.error('Error fetching roles:', err);
    }
  };

  const fetchMembersAndInvites = async () => {
    if (!currentOrganization) return;
    try {
      // Fetch active members
      const { data: memberData } = await supabase
        .from('organization_members')
        .select('*, profile:profiles(*)')
        .eq('organization_id', currentOrganization.id);
      
      if (memberData) {
        setMembers(memberData);
      }

      // Fetch user roles map
      const { data: userRolesData } = await supabase
        .from('user_roles')
        .select('user_id, role_id')
        .eq('tenant_id', currentOrganization.id);

      if (userRolesData) {
        const mapping: Record<string, string> = {};
        userRolesData.forEach((ur) => {
          mapping[ur.user_id] = ur.role_id;
        });
        setMemberRolesMap(mapping);
      }

      // Fetch pending invitations
      const { data: inviteData } = await supabase
        .from('organization_invitations')
        .select('*')
        .eq('organization_id', currentOrganization.id);
      
      if (inviteData) {
        setInvitations(inviteData as OrganizationInvitation[]);
      }
    } catch (err) {
      console.error('Error fetching members:', err);
    }
  };

  const fetchUsageStats = async () => {
    if (!currentOrganization) return;
    try {
      const { count: clientsCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', currentOrganization.id);

      const { count: reelsCount } = await supabase
        .from('reels')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', currentOrganization.id);

      const { count: shootsCount } = await supabase
        .from('shoots')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', currentOrganization.id);

      setUsageStats({
        clients: clientsCount || 0,
        reels: reelsCount || 0,
        shoots: shootsCount || 0
      });
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAuditLogs = async () => {
    if (!currentOrganization) return;
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*, actor:profiles(full_name, email)')
        .eq('tenant_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        setAuditLogs(data as AuditLog[]);
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    }
  };

  const fetchAiUsageLogs = async () => {
    if (!currentOrganization) return;
    try {
      const { data, error } = await supabase
        .from('ai_requests_history')
        .select('*, user:profiles(full_name, email)')
        .eq('tenant_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        const history = data as AiRequestHistory[];
        setAiLogs(history);

        // Compute metrics
        const totalReqs = history.length;
        let totalTks = 0;
        let totalCst = 0.0;
        let errors = 0;

        history.forEach((l) => {
          totalTks += (l.prompt_tokens + l.completion_tokens);
          totalCst += l.cost;
          if (l.status !== 'success') errors++;
        });

        setAiStats({
          totalRequests: totalReqs,
          totalTokens: totalTks,
          totalCost: parseFloat(totalCst.toFixed(4)),
          errorRate: totalReqs > 0 ? Math.round((errors / totalReqs) * 100) : 0
        });

        // Parse Chart Data (grouped by date)
        const dateMap: Record<string, { date: string; requests: number; cost: number }> = {};
        history.slice().reverse().forEach((log) => {
          const dateStr = new Date(log.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          if (!dateMap[dateStr]) {
            dateMap[dateStr] = { date: dateStr, requests: 0, cost: 0.0 };
          }
          dateMap[dateStr].requests++;
          dateMap[dateStr].cost += log.cost;
        });
        setChartData(Object.values(dateMap));
      }
    } catch (err) {
      console.error('Error fetching AI history:', err);
    }
  };

  const handleSaveGeneral = async () => {
    if (!currentOrganization) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: orgName,
          slug: orgSlug,
          timezone: orgTimezone,
          branding: { theme: brandingTheme, logoUrl: brandingLogo || null }
        })
        .eq('id', currentOrganization.id);

      if (error) throw error;
      toast({
        title: "Settings Saved",
        description: "Organization details updated successfully.",
      });
      await refreshOrganizations();
    } catch (err: any) {
      toast({
        title: "Failed to save settings",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAiSettings = async () => {
    if (!currentOrganization) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          ai_settings: { provider: aiProvider, model: aiModel, customUrl: aiCustomUrl || null }
        })
        .eq('id', currentOrganization.id);

      if (error) throw error;
      toast({
        title: "AI Settings Saved",
        description: "Organization default AI configuration saved.",
      });
      await refreshOrganizations();
    } catch (err: any) {
      toast({
        title: "Failed to save AI settings",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEncryptedKeys = async () => {
    if (!currentOrganization) return;
    setIsSavingKeys(true);
    try {
      const keysPayload: Record<string, string> = {};
      if (openaiKey) keysPayload.openai = openaiKey;
      if (anthropicKey) keysPayload.anthropic = anthropicKey;
      if (geminiKey) keysPayload.gemini = geminiKey;

      if (Object.keys(keysPayload).length === 0) {
        toast({ title: "No keys entered", description: "Please provide at least one API key." });
        setIsSavingKeys(false);
        return;
      }

      // Invoke server-side encryption helper on Edge Function
      const { data, error: encError } = await supabase.functions.invoke("ai-proxy", {
        body: { text: JSON.stringify(keysPayload) },
        headers: { "x-client-info": "ai-proxy/encrypt" }
      });

      // Note: In our Deno function, we process "/encrypt" pathname or special headers
      // If we request a POST payload with only { text }, our edge function processes it as /encrypt:
      // Let's call /encrypt specifically by editing the request url or payload
      const { data: encryptResult, error } = await supabase.functions.invoke("ai-proxy/encrypt", {
        method: "POST",
        body: { text: JSON.stringify(keysPayload) }
      });

      if (error || encryptResult?.error) throw new Error(error?.message || encryptResult?.error || "Encryption failed");

      // Save encrypted ciphertext
      const { error: dbError } = await supabase
        .from('organizations')
        .update({ encrypted_api_keys: encryptResult.encrypted })
        .eq('id', currentOrganization.id);

      if (dbError) throw dbError;

      toast({
        title: "Keys Saved Securely",
        description: "Your API keys have been encrypted and stored in the backend vault.",
      });
      setOpenaiKey('');
      setAnthropicKey('');
      setGeminiKey('');
    } catch (err: any) {
      toast({
        title: "Failed to save keys",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsSavingKeys(false);
    }
  };

  const handleRoleChange = async (userId: string, newRoleId: string) => {
    if (!currentOrganization) return;
    try {
      // 1. Delete old user_roles mappings for this tenant
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('tenant_id', currentOrganization.id);

      // 2. Insert new user role mapping
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role_id: newRoleId,
          tenant_id: currentOrganization.id
        });

      if (error) throw error;

      // 3. For compatibility, update legacy role column in organization_members
      const selectedRole = dbRoles.find(r => r.id === newRoleId);
      if (selectedRole) {
        let legacyRole = 'editor';
        if (selectedRole.name === 'Agency Owner') legacyRole = 'admin';
        else if (selectedRole.name === 'Sales Manager') legacyRole = 'sales';
        else if (selectedRole.name === 'Strategist') legacyRole = 'strategy';
        else if (selectedRole.name === 'Video Editor') legacyRole = 'editor';

        await supabase
          .from('organization_members')
          .update({ role: legacyRole })
          .eq('organization_id', currentOrganization.id)
          .eq('user_id', userId);
      }

      toast({
        title: "Role Updated",
        description: "User permissions have been modified successfully."
      });
      fetchMembersAndInvites();
      fetchAuditLogs();
    } catch (err: any) {
      toast({
        title: "Failed to update role",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const handleInviteMember = async () => {
    if (!currentOrganization || !inviteEmail || !inviteRoleId) return;
    setIsInviting(true);
    try {
      const selectedRole = dbRoles.find(r => r.id === inviteRoleId);
      let legacyRole = 'editor';
      if (selectedRole) {
        if (selectedRole.name === 'Agency Owner') legacyRole = 'admin';
        else if (selectedRole.name === 'Sales Manager') legacyRole = 'sales';
        else if (selectedRole.name === 'Strategist') legacyRole = 'strategy';
        else if (selectedRole.name === 'Video Editor') legacyRole = 'editor';
      }

      // Generate UUID invitation token
      const inviteToken = crypto.randomUUID();
      const expires = new Date();
      expires.setDate(expires.getDate() + 7); // Expiration: 7 days

      const { error } = await supabase
        .from('organization_invitations')
        .insert({
          organization_id: currentOrganization.id,
          email: inviteEmail,
          role: legacyRole,
          token: inviteToken,
          expires_at: expires.toISOString(),
          status: 'pending'
        });

      if (error) throw error;

      // Construct simulated invite URL
      const inviteUrl = `${window.location.origin}/accept-invite?token=${inviteToken}`;

      toast({
        title: "Invitation Generated",
        description: `Invitation link generated. Copy it below to send.`,
      });

      // Display in toast copyable link
      navigator.clipboard.writeText(inviteUrl);
      toast({
        title: "Link Copied!",
        description: "Copied invite link to clipboard: " + inviteUrl,
      });

      setInviteEmail('');
      fetchMembersAndInvites();
      fetchAuditLogs();
    } catch (err: any) {
      toast({
        title: "Invite failed",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const member = members.find(m => m.id === memberId);
      if (member && currentOrganization) {
        // Delete roles mapping
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', member.user_id)
          .eq('tenant_id', currentOrganization.id);
      }

      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;
      toast({
        title: "Member removed",
        description: "The user membership has been canceled."
      });
      fetchMembersAndInvites();
      fetchAuditLogs();
    } catch (err: any) {
      toast({
        title: "Failed to remove member",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      const { error } = await supabase
        .from('organization_invitations')
        .delete()
        .eq('id', inviteId);

      if (error) throw error;
      toast({
        title: "Invitation canceled",
      });
      fetchMembersAndInvites();
    } catch (err: any) {
      toast({
        title: "Failed to cancel invitation",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const handleTransferOwnership = async () => {
    if (!currentOrganization || !newOwnerId) return;
    setIsTransferring(true);
    try {
      const { error: orgError } = await supabase
        .from('organizations')
        .update({ owner_id: newOwnerId })
        .eq('id', currentOrganization.id);

      if (orgError) throw orgError;

      // Assign Agency Owner role to new owner
      const ownerRole = dbRoles.find(r => r.name === 'Agency Owner');
      if (ownerRole) {
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', newOwnerId)
          .eq('tenant_id', currentOrganization.id);
        
        await supabase
          .from('user_roles')
          .insert({
            user_id: newOwnerId,
            role_id: ownerRole.id,
            tenant_id: currentOrganization.id
          });
      }

      toast({
        title: "Ownership Transferred",
        description: "You have transferred owner rights to the selected administrator.",
      });
      setNewOwnerId('');
      await refreshOrganizations();
    } catch (err: any) {
      toast({
        title: "Failed to transfer ownership",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsTransferring(false);
    }
  };

  const exportAuditLogsCsv = () => {
    const filtered = getFilteredLogs();
    const headers = ["Timestamp", "Actor", "Action", "Entity Type", "Entity ID", "Old Value", "New Value"];
    const rows = filtered.map(log => [
      new Date(log.created_at).toLocaleString(),
      log.actor?.full_name || log.actor?.email || "System/Public",
      log.action_type,
      log.entity_type,
      log.entity_id,
      JSON.stringify(log.old_value || {}),
      JSON.stringify(log.new_value || {})
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `audit_logs_${currentOrganization?.slug || 'export'}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getFilteredLogs = () => {
    return auditLogs.filter(log => {
      const actorName = log.actor?.full_name || 'System/Public';
      const actorEmail = log.actor?.email || '';
      const matchesSearch = actorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            actorEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            log.entity_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            log.action_type.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesAction = filterAction === 'all' || log.action_type === filterAction;
      const matchesEntity = filterEntity === 'all' || log.entity_type === filterEntity;

      return matchesSearch && matchesAction && matchesEntity;
    });
  };

  // Detect suspicious activity (e.g. actions at odd hours or unauthorized edits)
  const detectSuspiciousActivity = () => {
    const suspicious = [];
    
    // Look for edits after hours (10 PM to 6 AM)
    const lateAudits = auditLogs.filter(l => {
      const hour = new Date(l.created_at).getHours();
      return (hour >= 22 || hour < 6) && (l.entity_type === 'contracts' || l.entity_type === 'user_roles');
    });

    if (lateAudits.length > 0) {
      suspicious.push({
        id: 'after-hours',
        title: 'After-Hours Sensitive Modifications',
        description: `${lateAudits.length} critical changes made to contracts/roles outside typical business hours (10 PM - 6 AM).`
      });
    }

    // Multiple role modifications
    const roleChanges = auditLogs.filter(l => l.entity_type === 'user_roles' && l.action_type === 'update');
    if (roleChanges.length > 3) {
      suspicious.push({
        id: 'frequent-roles',
        title: 'Frequent Role Modifications Detected',
        description: `${roleChanges.length} role assignments altered recently. Please verify admin privileges.`
      });
    }

    return suspicious;
  };

  const suspiciousList = detectSuspiciousActivity();

  const planInfo = {
    free: { maxClients: 3, maxReels: 15, name: 'Free Trial' },
    growth: { maxClients: 15, maxReels: 100, name: 'Agency Growth' },
    enterprise: { maxClients: 100, maxReels: 1000, name: 'Enterprise Elite' }
  };

  const currentPlan = currentOrganization?.billing_settings?.plan as 'free' | 'growth' | 'enterprise' || 'free';
  const limits = planInfo[currentPlan];

  return (
    <AppLayout title="Organization Settings">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Organization Settings</h1>
          <p className="text-sm text-muted-foreground">Manage SaaS configurations, enterprise RBAC roles, audit logs, and secure AI gateways.</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1 p-1 w-full xl:w-auto xl:inline-flex bg-background/50 border border-white/10">
            <TabsTrigger value="general" className="gap-1.5 text-xs md:text-sm px-3 data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              <Building2 className="h-4 w-4" /> General Settings
            </TabsTrigger>
            <TabsTrigger value="members" className="gap-1.5 text-xs md:text-sm px-3 data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              <Users className="h-4 w-4" /> Members & RBAC
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-1.5 text-xs md:text-sm px-3 data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              <Sparkles className="h-4 w-4" /> Secure AI Gateway
            </TabsTrigger>
            <TabsTrigger value="audit-logs" className="gap-1.5 text-xs md:text-sm px-3 data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              <Activity className="h-4 w-4" /> Audit Logs
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-1.5 text-xs md:text-sm px-3 data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              <CreditCard className="h-4 w-4" /> Billing & Usage
            </TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-6">
            <Card className="backdrop-blur-md bg-card/40 border-white/10">
              <CardHeader>
                <CardTitle>Organization Information</CardTitle>
                <CardDescription>Configure workspace branding and server locations.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="orgName">Organization Name</Label>
                    <Input id="orgName" value={orgName} onChange={(e) => setOrgName(e.target.value)} className="bg-background/40 border-white/10" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="orgSlug">URL Domain Slug</Label>
                    <Input id="orgSlug" value={orgSlug} onChange={(e) => setOrgSlug(e.target.value)} className="bg-background/40 border-white/10" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Default Timezone</Label>
                    <Select value={orgTimezone} onValueChange={setOrgTimezone}>
                      <SelectTrigger className="bg-background/40 border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map(tz => (
                          <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="theme">Default Branding Theme</Label>
                    <Select value={brandingTheme} onValueChange={setBrandingTheme}>
                      <SelectTrigger className="bg-background/40 border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dark">Vibrant Dark Mode</SelectItem>
                        <SelectItem value="light">Classic Light Mode</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logoUrl">Custom Logo URL (White-label)</Label>
                  <Input id="logoUrl" placeholder="https://yourbrand.com/logo.png" value={brandingLogo} onChange={(e) => setBrandingLogo(e.target.value)} className="bg-background/40 border-white/10" />
                </div>

                <div className="pt-4 border-t border-white/5">
                  <Button onClick={handleSaveGeneral} className="bg-purple-600 hover:bg-purple-700 text-white" disabled={isSaving}>
                    {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save Details
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Ownership Transfer Card */}
            {isOwner && (
              <Card className="border-red-500/20 bg-red-950/5">
                <CardHeader>
                  <CardTitle className="text-red-400">Transfer Workspace Ownership</CardTitle>
                  <CardDescription>Transfer executive ownership rights to another workspace administrator.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                      <Select value={newOwnerId} onValueChange={setNewOwnerId}>
                        <SelectTrigger className="bg-background/40 border-white/10 text-white">
                          <SelectValue placeholder="Select member to receive ownership" />
                        </SelectTrigger>
                        <SelectContent>
                          {members
                              .filter(m => m.user_id !== user?.id && memberRolesMap[m.user_id] === dbRoles.find(r => r.name === 'Agency Owner')?.id)
                              .map(m => (
                                <SelectItem key={m.user_id} value={m.user_id}>
                                  {m.profile?.full_name || m.profile?.email || 'Admin User'}
                                </SelectItem>
                              ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                      onClick={handleTransferOwnership} 
                      disabled={isTransferring || !newOwnerId}
                      className="bg-red-600 hover:bg-red-700 text-white font-semibold"
                    >
                      {isTransferring ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRightLeft className="h-4 w-4 mr-2" />}
                      Transfer Rights
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Warning: Transferring ownership will downgrade your role. This action is irreversible.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Members & RBAC Tab */}
          <TabsContent value="members" className="space-y-6">
            {/* Invite Panel */}
            <Card className="backdrop-blur-md bg-card/40 border-white/10">
              <CardHeader>
                <CardTitle>Invite New Member</CardTitle>
                <CardDescription>Generate an secure invitation link with expiration checks.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <Input 
                    type="email" 
                    placeholder="teammember@domain.com" 
                    value={inviteEmail} 
                    onChange={(e) => setInviteEmail(e.target.value)} 
                    className="bg-background/40 border-white/10"
                  />
                </div>
                <div className="w-[200px]">
                  <Select value={inviteRoleId} onValueChange={setInviteRoleId}>
                    <SelectTrigger className="bg-background/40 border-white/10">
                      <SelectValue placeholder="Select Role" />
                    </SelectTrigger>
                    <SelectContent>
                      {dbRoles.map(role => (
                        <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleInviteMember} className="bg-purple-600 hover:bg-purple-700 text-white" disabled={isInviting || !inviteEmail || !inviteRoleId}>
                  {isInviting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
                  Generate Invite
                </Button>
              </CardContent>
            </Card>

            {/* Active Members Roster */}
            <Card className="backdrop-blur-md bg-card/40 border-white/10">
              <CardHeader>
                <CardTitle>Workspace Members & Role Assignment</CardTitle>
                <CardDescription>Assign enterprise RBAC roles to team members. Changes are automatically logged to audit trails.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Assigned RBAC Role</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map(member => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          {member.profile?.full_name || 'Anonymous Member'}
                          {member.user_id === currentOrganization?.owner_id && (
                            <Badge className="ml-2 bg-yellow-500/10 text-yellow-400 border-yellow-500/20 text-[10px]">Owner</Badge>
                          )}
                        </TableCell>
                        <TableCell>{member.profile?.email}</TableCell>
                        <TableCell>
                          <Select 
                            value={memberRolesMap[member.user_id] || ''}
                            onValueChange={(val) => handleRoleChange(member.user_id, val)}
                            disabled={member.user_id === currentOrganization?.owner_id}
                          >
                            <SelectTrigger className="w-[180px] bg-background/35 border-white/10 text-purple-300">
                              <SelectValue placeholder="No Role Assigned" />
                            </SelectTrigger>
                            <SelectContent>
                              {dbRoles.map(role => (
                                <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          {member.user_id !== user?.id && member.user_id !== currentOrganization?.owner_id && (
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              onClick={() => handleRemoveMember(member.id)}
                              className="h-8 w-8 text-muted-foreground hover:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Pending Invites */}
            {invitations.length > 0 && (
              <Card className="backdrop-blur-md bg-card/40 border-white/10">
                <CardHeader>
                  <CardTitle>Pending Temporary Access Passes</CardTitle>
                  <CardDescription>Copy active links for team members to join. Link expires in 7 days.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Legacy Scope</TableHead>
                        <TableHead>Expiration Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invitations.map(invite => (
                        <TableRow key={invite.id}>
                          <TableCell>{invite.email}</TableCell>
                          <TableCell className="capitalize text-muted-foreground">{invite.role}</TableCell>
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
                                toast({ title: "Copied Link!" });
                              }}
                              className="text-xs border-white/10 bg-background/50 hover:bg-purple-600 hover:text-white"
                            >
                              Copy Link
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => handleCancelInvite(invite.id)}
                              className="text-xs text-red-400 hover:text-red-300"
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

          {/* Secure AI Gateway Tab */}
          <TabsContent value="ai" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-4">
              <Card className="backdrop-blur-md bg-card/40 border-white/10 text-center py-4">
                <CardHeader className="p-0">
                  <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Total Requests</CardDescription>
                  <CardTitle className="text-2xl font-extrabold text-white pt-1">{aiStats.totalRequests}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="backdrop-blur-md bg-card/40 border-white/10 text-center py-4">
                <CardHeader className="p-0">
                  <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Tokens Spent</CardDescription>
                  <CardTitle className="text-2xl font-extrabold text-white pt-1">{aiStats.totalTokens}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="backdrop-blur-md bg-card/40 border-white/10 text-center py-4">
                <CardHeader className="p-0">
                  <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Estimated Cost</CardDescription>
                  <CardTitle className="text-2xl font-extrabold text-purple-400 pt-1">${aiStats.totalCost}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="backdrop-blur-md bg-card/40 border-white/10 text-center py-4">
                <CardHeader className="p-0">
                  <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Error Rate</CardDescription>
                  <CardTitle className="text-2xl font-extrabold text-red-400 pt-1">{aiStats.errorRate}%</CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* AI Settings Form */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="backdrop-blur-md bg-card/40 border-white/10">
                <CardHeader>
                  <CardTitle>AI Settings & Defaults</CardTitle>
                  <CardDescription>Default model config for the organization.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Default Provider</Label>
                    <Select value={aiProvider} onValueChange={setAiProvider}>
                      <SelectTrigger className="bg-background/50 border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gemini">Google Gemini</SelectItem>
                        <SelectItem value="openai">OpenAI (ChatGPT)</SelectItem>
                        <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                        <SelectItem value="custom">Custom Endpoint</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Default Model</Label>
                    <Input value={aiModel} onChange={(e) => setAiModel(e.target.value)} className="bg-background/50 border-white/10" />
                  </div>
                  {aiProvider === 'custom' && (
                    <div className="space-y-2">
                      <Label>Custom API Base URL</Label>
                      <Input value={aiCustomUrl} onChange={(e) => setAiCustomUrl(e.target.value)} className="bg-background/50 border-white/10" />
                    </div>
                  )}
                  <Button onClick={handleSaveAiSettings} className="bg-purple-600 hover:bg-purple-700 text-white w-full" disabled={isSaving}>
                    Save Defaults
                  </Button>
                </CardContent>
              </Card>

              {/* API Encryption Vault Form */}
              <Card className="backdrop-blur-md bg-card/40 border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-yellow-400" />
                    Key Encryption Vault
                  </CardTitle>
                  <CardDescription>Store custom API keys. Keys are encrypted using AES-GCM prior to database insertion. localStorage keys are removed.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label>OpenAI API Key (Optional)</Label>
                    <Input type="password" placeholder="sk-..." value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} className="bg-background/50 border-white/10" />
                  </div>
                  <div className="space-y-2">
                    <Label>Anthropic API Key (Optional)</Label>
                    <Input type="password" placeholder="sk-ant-..." value={anthropicKey} onChange={(e) => setAnthropicKey(e.target.value)} className="bg-background/50 border-white/10" />
                  </div>
                  <div className="space-y-2">
                    <Label>Gemini API Key (Optional)</Label>
                    <Input type="password" placeholder="AIzaSy..." value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} className="bg-background/50 border-white/10" />
                  </div>
                  <Button onClick={handleSaveEncryptedKeys} className="bg-yellow-600 hover:bg-yellow-700 text-white w-full" disabled={isSavingKeys}>
                    {isSavingKeys ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Encrypt & Save Vault Keys
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* AI Cost Chart */}
            {chartData.length > 0 && (
              <Card className="backdrop-blur-md bg-card/40 border-white/10">
                <CardHeader>
                  <CardTitle>AI Request Volume & Cost Trends</CardTitle>
                  <CardDescription>Operational telemetry of AI Gateway requests.</CardDescription>
                </CardHeader>
                <CardContent className="h-[250px] w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" fontSize={10} />
                      <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} />
                      <Tooltip contentStyle={{ backgroundColor: '#1e1b4b', borderColor: '#4338ca', color: '#fff' }} />
                      <Area type="monotone" dataKey="requests" name="Requests count" stroke="#a855f7" fillOpacity={1} fill="url(#colorCost)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* AI logs table */}
            <Card className="backdrop-blur-md bg-card/40 border-white/10">
              <CardHeader>
                <CardTitle>Recent AI Generations</CardTitle>
                <CardDescription>Gateway execution logs.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Provider/Model</TableHead>
                      <TableHead>Tokens Used</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aiLogs.slice(0, 5).map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-semibold">{log.user?.full_name || 'System'}</TableCell>
                        <TableCell className="capitalize text-muted-foreground">{log.provider} ({log.model})</TableCell>
                        <TableCell>{log.prompt_tokens + log.completion_tokens}</TableCell>
                        <TableCell className="text-purple-400">${log.cost}</TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline"
                            className={
                              log.status === 'success' 
                                ? 'border-green-500/20 bg-green-500/10 text-green-400' 
                                : 'border-red-500/20 bg-red-500/10 text-red-400'
                            }
                          >
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Logs Tab */}
          <TabsContent value="audit-logs" className="space-y-6">
            {/* Alerts for suspicious activities */}
            {suspiciousList.length > 0 && (
              <div className="space-y-3">
                {suspiciousList.map((alert) => (
                  <Card key={alert.id} className="border-yellow-500/30 bg-yellow-950/15">
                    <CardHeader className="flex flex-row items-center gap-3 py-3">
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      <div>
                        <CardTitle className="text-sm font-semibold text-yellow-400">{alert.title}</CardTitle>
                        <CardDescription className="text-xs text-yellow-500/70">{alert.description}</CardDescription>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}

            {/* Filters & search */}
            <Card className="backdrop-blur-md bg-card/40 border-white/10">
              <CardContent className="pt-6 space-y-4">
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search logs by actor, action, or entity..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 bg-background/50 border-white/10"
                    />
                  </div>
                  <div className="w-full lg:w-[180px]">
                    <Select value={filterAction} onValueChange={setFilterAction}>
                      <SelectTrigger className="bg-background/50 border-white/10">
                        <SelectValue placeholder="All Actions" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Actions</SelectItem>
                        <SelectItem value="insert">Insert (Create)</SelectItem>
                        <SelectItem value="update">Update (Edit)</SelectItem>
                        <SelectItem value="delete">Delete</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-full lg:w-[180px]">
                    <Select value={filterEntity} onValueChange={setFilterEntity}>
                      <SelectTrigger className="bg-background/50 border-white/10">
                        <SelectValue placeholder="All Entities" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Entities</SelectItem>
                        <SelectItem value="leads">Leads</SelectItem>
                        <SelectItem value="clients">Clients</SelectItem>
                        <SelectItem value="contracts">Contracts</SelectItem>
                        <SelectItem value="reels">Reels</SelectItem>
                        <SelectItem value="approvals">Approvals</SelectItem>
                        <SelectItem value="user_roles">User Roles</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={exportAuditLogsCsv} className="bg-purple-600 hover:bg-purple-700 text-white gap-2">
                    <Download className="h-4 w-4" /> Export CSV
                  </Button>
                </div>

                <div className="border border-white/10 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-background/50">
                      <TableRow>
                        <TableHead>Actor</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Entity Type</TableHead>
                        <TableHead>Entity ID</TableHead>
                        <TableHead>Timestamp</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getFilteredLogs().map((log) => (
                        <TableRow key={log.id} className="hover:bg-white/5 transition-colors">
                          <TableCell className="font-semibold">
                            {log.actor?.full_name || 'System/Public'}
                            <span className="block text-[10px] font-normal text-muted-foreground">{log.actor?.email || 'automated trigger'}</span>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={
                                log.action_type === 'insert' 
                                  ? 'border-green-500/20 bg-green-500/10 text-green-400 uppercase text-[9px]'
                                  : log.action_type === 'update'
                                  ? 'border-blue-500/20 bg-blue-500/10 text-blue-400 uppercase text-[9px]'
                                  : 'border-red-500/20 bg-red-500/10 text-red-400 uppercase text-[9px]'
                              }
                            >
                              {log.action_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="capitalize text-purple-300 font-mono text-xs">{log.entity_type}</TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">{log.entity_id.slice(0, 8)}...</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                              className="text-xs gap-1 hover:bg-purple-600/20 hover:text-white"
                            >
                              <Eye className="h-3 w-3" /> Inspect
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Inspect Log details */}
                {selectedLog && (
                  <Card className="border-purple-500/30 bg-purple-950/5">
                    <CardHeader className="py-3">
                      <CardTitle className="text-xs font-semibold uppercase text-purple-400 tracking-wider">Audit Metadata Viewer</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2 text-xs font-mono">
                      <div>
                        <p className="text-muted-foreground pb-1 font-semibold uppercase tracking-widest text-[9px]">Old Value state</p>
                        <pre className="p-3 rounded-lg bg-background/60 overflow-auto max-h-[150px] border border-white/5 text-[10px]">
                          {selectedLog.old_value ? JSON.stringify(selectedLog.old_value, null, 2) : 'NULL'}
                        </pre>
                      </div>
                      <div>
                        <p className="text-muted-foreground pb-1 font-semibold uppercase tracking-widest text-[9px]">New Value state</p>
                        <pre className="p-3 rounded-lg bg-background/60 overflow-auto max-h-[150px] border border-white/5 text-[10px]">
                          {selectedLog.new_value ? JSON.stringify(selectedLog.new_value, null, 2) : 'NULL'}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              {/* Clients Limit */}
              <Card className="backdrop-blur-md bg-card/40 border-white/10 text-center py-6">
                <CardHeader className="p-0">
                  <CardDescription className="text-xs uppercase font-bold text-muted-foreground tracking-widest">Active Clients</CardDescription>
                  <CardTitle className="text-4xl font-extrabold text-white pt-2">
                    {usageStats.clients} <span className="text-lg text-muted-foreground">/ {limits.maxClients}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 px-6">
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-500 rounded-full transition-all"
                      style={{ width: `${Math.min((usageStats.clients / limits.maxClients) * 100, 100)}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Reels Limit */}
              <Card className="backdrop-blur-md bg-card/40 border-white/10 text-center py-6">
                <CardHeader className="p-0">
                  <CardDescription className="text-xs uppercase font-bold text-muted-foreground tracking-widest">Reels Drafted</CardDescription>
                  <CardTitle className="text-4xl font-extrabold text-white pt-2">
                    {usageStats.reels} <span className="text-lg text-muted-foreground">/ {limits.maxReels}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 px-6">
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${Math.min((usageStats.reels / limits.maxReels) * 100, 100)}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Subscription Status */}
              <Card className="backdrop-blur-md bg-card/40 border-white/10 text-center py-6 flex flex-col justify-between">
                <CardHeader className="p-0">
                  <CardDescription className="text-xs uppercase font-bold text-muted-foreground tracking-widest">Current Plan</CardDescription>
                  <CardTitle className="text-2xl font-extrabold text-purple-400 pt-2 flex items-center justify-center gap-1.5">
                    <Award className="h-5 w-5 text-purple-400" />
                    {limits.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <Badge variant="outline" className="border-green-500/20 bg-green-500/10 text-green-400 font-bold uppercase text-[10px]">
                    Active Subscription
                  </Badge>
                </CardContent>
              </Card>
            </div>

            {/* Pricing Tiers Mock Grid */}
            <Card className="backdrop-blur-md bg-card/40 border-white/10">
              <CardHeader>
                <CardTitle>Available SaaS Subscription Plans</CardTitle>
                <CardDescription>Upgrade your workspace capacity to support more brands.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-3">
                <div className="p-6 rounded-2xl border border-white/5 bg-background/20 space-y-4">
                  <h4 className="font-bold text-sm">Free Trial</h4>
                  <p className="text-2xl font-extrabold">₹0 <span className="text-xs text-muted-foreground font-normal">/mo</span></p>
                  <ul className="text-xs space-y-2 text-muted-foreground">
                    <li>• Up to 3 Clients</li>
                    <li>• 15 Reels / Month</li>
                    <li>• Local AI Credentials only</li>
                  </ul>
                  <Button disabled={currentPlan === 'free'} className="w-full text-xs">
                    {currentPlan === 'free' ? 'Current Plan' : 'Downgrade'}
                  </Button>
                </div>

                <div className="p-6 rounded-2xl border border-purple-500/30 bg-purple-950/10 space-y-4 relative">
                  <Badge className="absolute -top-3 right-6 bg-purple-600 text-white font-bold text-[9px]">POPULAR</Badge>
                  <h4 className="font-bold text-sm text-purple-400">Agency Growth</h4>
                  <p className="text-2xl font-extrabold">₹2,499 <span className="text-xs text-muted-foreground font-normal">/mo</span></p>
                  <ul className="text-xs space-y-2 text-muted-foreground">
                    <li>• Up to 15 Clients</li>
                    <li>• 100 Reels / Month</li>
                    <li>• Organization-wide AI defaults</li>
                    <li>• Timezone branding configurations</li>
                  </ul>
                  <Button 
                    onClick={async () => {
                      if (!currentOrganization) return;
                      const { error } = await supabase
                        .from('organizations')
                        .update({
                          billing_settings: { plan: 'growth', status: 'active', stripeCustomerId: 'cus_mock123' }
                        })
                        .eq('id', currentOrganization.id);
                      if (!error) {
                        toast({ title: "Upgraded to Growth Plan!" });
                        await refreshOrganizations();
                      }
                    }}
                    className="w-full text-xs bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {currentPlan === 'growth' ? 'Current Plan' : 'Upgrade Plan'}
                  </Button>
                </div>

                <div className="p-6 rounded-2xl border border-white/5 bg-background/20 space-y-4">
                  <h4 className="font-bold text-sm">Enterprise Elite</h4>
                  <p className="text-2xl font-extrabold">₹7,999 <span className="text-xs text-muted-foreground font-normal">/mo</span></p>
                  <ul className="text-xs space-y-2 text-muted-foreground">
                    <li>• Unlimited Clients</li>
                    <li>• Unlimited Reels & Shoots</li>
                    <li>• Complete White-Label customization</li>
                    <li>• Dedicated Account support</li>
                  </ul>
                  <Button 
                    onClick={async () => {
                      if (!currentOrganization) return;
                      const { error } = await supabase
                        .from('organizations')
                        .update({
                          billing_settings: { plan: 'enterprise', status: 'active', stripeCustomerId: 'cus_mock123' }
                        })
                        .eq('id', currentOrganization.id);
                      if (!error) {
                        toast({ title: "Upgraded to Enterprise Plan!" });
                        await refreshOrganizations();
                      }
                    }}
                    className="w-full text-xs"
                  >
                    {currentPlan === 'enterprise' ? 'Current Plan' : 'Upgrade Plan'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
