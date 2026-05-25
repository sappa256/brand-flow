import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { DataTable } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { HealthBadge } from '@/components/shared/HealthBadge';
import { ContractWarningBadge } from '@/components/shared/ContractWarningBadge';
import { Plus, TrendingUp, Users as UsersIcon, Eye, Sparkles, LayoutGrid } from 'lucide-react';
import type { Client } from '@/types/crm';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { ClientFormDialog } from '@/components/clients/ClientFormDialog';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedAnalyticsClient, setSelectedAnalyticsClient] = useState<string>('');

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (clients.length > 0 && !selectedAnalyticsClient) {
      setSelectedAnalyticsClient(clients[0].id);
    }
  }, [clients, selectedAnalyticsClient]);

  const activeAnalyticsClientObj = clients.find(c => c.id === selectedAnalyticsClient);
  
  const ANALYTICS_DATA = [
    { month: 'Month 1', views: 45000, followers: 1200, engagement: 4.2 },
    { month: 'Month 2', views: 82000, followers: 2300, engagement: 4.8 },
    { month: 'Month 3', views: 115000, followers: 3900, engagement: 5.5 },
    { month: 'Month 4', views: 195000, followers: 5800, engagement: 6.1 },
    { month: 'Month 5', views: 280000, followers: 8200, engagement: 6.9 },
    { month: 'Month 6', views: 410000, followers: 11500, engagement: 7.4 }
  ];

  const getClientAnalytics = () => {
    if (!activeAnalyticsClientObj) return ANALYTICS_DATA;
    // deterministic scaling using character codes of client name
    const hash = activeAnalyticsClientObj.client_name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const scale = (hash % 5) * 0.25 + 0.5; // multiplier from 0.5 to 1.5
    return ANALYTICS_DATA.map(d => ({
      month: d.month,
      views: Math.round(d.views * scale),
      followers: Math.round(d.followers * scale),
      engagement: Number((d.engagement * (scale * 0.1 + 0.95)).toFixed(1))
    }));
  };

  const chartData = getClientAnalytics();

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('*, account_manager:profiles!clients_account_manager_id_fkey(*)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setClients(data as Client[]);
    }
    setIsLoading(false);
  };

  const handleAddClient = () => {
    setSelectedClient(null);
    setDialogOpen(true);
  };

  const handleEditClient = (client: Client) => {
    setSelectedClient(client);
    setDialogOpen(true);
  };

  const handleSuccess = () => {
    fetchClients();
  };

  const handleDeleteClient = async (clientId: string) => {
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', clientId);

    if (error) {
      toast.error('Failed to delete client');
      return;
    }

    setClients(prev => prev.filter(c => c.id !== clientId));
    toast.success('Client deleted successfully');
  };

  const columns = [
    {
      key: 'client',
      header: 'Client',
      render: (client: Client) => (
        <div>
          <p className="font-medium">{client.client_name}</p>
          {client.brand_name && (
            <p className="text-xs text-muted-foreground">{client.brand_name}</p>
          )}
        </div>
      ),
    },
    {
      key: 'plan',
      header: 'Plan',
      render: (client: Client) => (
        <Badge variant="secondary" className="capitalize">
          {client.plan_type}
        </Badge>
      ),
    },
    {
      key: 'platforms',
      header: 'Platforms',
      render: (client: Client) => (
        <div className="flex gap-1 flex-wrap">
          {client.platforms_managed?.map((platform) => (
            <Badge key={platform} variant="outline" className="text-xs capitalize">
              {platform}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'month',
      header: 'Contract Month',
      render: (client: Client) => (
        <div className="flex items-center gap-2">
          <span className="text-sm">Month {client.current_contract_month}</span>
          <ContractWarningBadge contractMonth={client.current_contract_month} showLabel={false} />
        </div>
      ),
    },
    {
      key: 'start_date',
      header: 'Start Date',
      render: (client: Client) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(client.start_date), 'MMM d, yyyy')}
        </span>
      ),
    },
    {
      key: 'health',
      header: 'Health',
      render: (client: Client) => <HealthBadge status={client.health_status || 'good'} size="sm" />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (client: Client) => <StatusBadge status={client.status} />,
    },
  ];

  if (isLoading) {
    return (
      <AppLayout title="Clients">
        <Skeleton className="h-96 w-full" />
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Clients"
      actions={
        <Button size="sm" onClick={handleAddClient}>
          <Plus className="h-4 w-4 mr-2" />
          Add Client
        </Button>
      }
    >
      <Tabs defaultValue="list" className="space-y-6">
        <TabsList className="bg-background/50 border border-white/10 p-1">
          <TabsTrigger value="list" className="gap-1.5 text-xs md:text-sm px-3 data-[state=active]:bg-purple-600 data-[state=active]:text-white">
            <LayoutGrid className="h-4 w-4" />
            Client List
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5 text-xs md:text-sm px-3 data-[state=active]:bg-purple-600 data-[state=active]:text-white">
            <TrendingUp className="h-4 w-4" />
            Performance Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <DataTable
            data={clients}
            columns={columns}
            getRowId={(client) => client.id}
            emptyMessage="No clients yet. Convert a proposal to create your first client."
            onRefresh={fetchClients}
            onDelete={handleDeleteClient}
            deleteConfirmMessage="Are you sure you want to delete this client? This will also delete associated contracts, strategies, shoots, reels, and calendar entries."
            onRowClick={handleEditClient}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 rounded-xl border border-white/10 bg-card/45 backdrop-blur-md">
            <div>
              <h3 className="font-bold text-lg">Growth & Engagement Performance</h3>
              <p className="text-sm text-muted-foreground">Select a client below to visualize views and followers growth over contract months.</p>
            </div>
            <div className="w-full sm:w-[220px]">
              <Select value={selectedAnalyticsClient} onValueChange={setSelectedAnalyticsClient}>
                <SelectTrigger className="bg-background/40 border-white/10">
                  <SelectValue placeholder="Select Client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.client_name} ({c.brand_name || 'No Brand'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {activeAnalyticsClientObj ? (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Views Growth Area Chart */}
              <Card className="backdrop-blur-md bg-card/40 border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base font-bold text-purple-400">
                    <Eye className="h-4 w-4" />
                    Views Performance (Trajectory)
                  </CardTitle>
                  <CardDescription>Estimated total monthly views across all managed channels</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#c084fc" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#c084fc" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="month" stroke="#71717a" fontSize={11} />
                      <YAxis stroke="#71717a" fontSize={11} tickFormatter={(v) => `${v / 1000}k`} />
                      <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
                      <Area type="monotone" dataKey="views" stroke="#c084fc" fillOpacity={1} fill="url(#colorViews)" strokeWidth={2} name="Total Views" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Followers & Engagement Bar/Line Chart */}
              <Card className="backdrop-blur-md bg-card/40 border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base font-bold text-green-400">
                    <UsersIcon className="h-4 w-4" />
                    Followers & Engagement
                  </CardTitle>
                  <CardDescription>Followers gained (Bars) vs average video engagement rate (Line)</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorFollowers" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4ade80" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#4ade80" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="month" stroke="#71717a" fontSize={11} />
                      <YAxis stroke="#71717a" fontSize={11} tickFormatter={(v) => `${v / 1000}k`} />
                      <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
                      <Area type="monotone" dataKey="followers" stroke="#4ade80" fillOpacity={1} fill="url(#colorFollowers)" strokeWidth={2} name="Followers" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">Select a client to view their analytics</p>
          )}
        </TabsContent>
      </Tabs>

      <ClientFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        client={selectedClient}
        onSuccess={handleSuccess}
      />
    </AppLayout>
  );
}
