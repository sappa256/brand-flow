import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatsCard } from '@/components/shared/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Users, FileText, Building2, IndianRupee, TrendingUp, Film } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/StatusBadge';

interface DashboardStats {
  totalLeads: number;
  activeClients: number;
  pendingProposals: number;
  monthlyRevenue: number;
  reelsThisMonth: number;
  atRiskClients: number;
}

interface RecentActivity {
  id: string;
  type: 'lead' | 'proposal' | 'client';
  name: string;
  status: string;
  created_at: string;
}

export default function Dashboard() {
  const { hasAnyRole } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch leads count
      const { count: leadsCount } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true });

      // Fetch active clients
      const { count: activeClientsCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Fetch at-risk clients
      const { count: atRiskCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'at_risk');

      // Fetch pending proposals
      const { count: pendingProposalsCount } = await supabase
        .from('proposals')
        .select('*', { count: 'exact', head: true })
        .in('status', ['draft', 'sent']);

      // Fetch monthly revenue from active contracts
      const { data: contracts } = await supabase
        .from('contracts')
        .select('monthly_retainer')
        .eq('contract_status', 'active');

      const monthlyRevenue = contracts?.reduce(
        (sum, c) => sum + (Number(c.monthly_retainer) || 0),
        0
      ) || 0;

      // Fetch reels count this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: reelsCount } = await supabase
        .from('reels')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfMonth.toISOString());

      setStats({
        totalLeads: leadsCount || 0,
        activeClients: activeClientsCount || 0,
        pendingProposals: pendingProposalsCount || 0,
        monthlyRevenue,
        reelsThisMonth: reelsCount || 0,
        atRiskClients: atRiskCount || 0,
      });

      // Fetch recent activity
      const { data: recentLeads } = await supabase
        .from('leads')
        .select('id, full_name, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      const activity: RecentActivity[] = (recentLeads || []).map(lead => ({
        id: lead.id,
        type: 'lead' as const,
        name: lead.full_name,
        status: lead.status,
        created_at: lead.created_at,
      }));

      setRecentActivity(activity);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <AppLayout title="Dashboard">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {hasAnyRole(['admin', 'sales']) && (
            <>
              <StatsCard
                title="Total Leads"
                value={stats?.totalLeads || 0}
                subtitle="All time"
                icon={<Users className="h-6 w-6" />}
              />
              <StatsCard
                title="Pending Proposals"
                value={stats?.pendingProposals || 0}
                subtitle="Draft + Sent"
                icon={<FileText className="h-6 w-6" />}
              />
            </>
          )}
          
          {hasAnyRole(['admin', 'sales', 'strategy']) && (
            <StatsCard
              title="Active Clients"
              value={stats?.activeClients || 0}
              subtitle={stats?.atRiskClients ? `${stats.atRiskClients} at risk` : 'All healthy'}
              icon={<Building2 className="h-6 w-6" />}
            />
          )}
          
          {hasAnyRole(['admin', 'sales']) && (
            <StatsCard
              title="Monthly Revenue"
              value={formatCurrency(stats?.monthlyRevenue || 0)}
              subtitle="Active contracts"
              icon={<IndianRupee className="h-6 w-6" />}
            />
          )}

          {hasAnyRole(['admin', 'editor', 'strategy']) && (
            <StatsCard
              title="Reels This Month"
              value={stats?.reelsThisMonth || 0}
              subtitle="Created"
              icon={<Film className="h-6 w-6" />}
            />
          )}
        </div>

        {/* Recent Activity & Quick Actions */}
        <div className="grid gap-6 lg:grid-cols-2">
          {hasAnyRole(['admin', 'sales']) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Recent Leads
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentActivity.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">
                    No recent activity
                  </p>
                ) : (
                  <div className="space-y-4">
                    {recentActivity.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between py-2 border-b last:border-0"
                      >
                        <div>
                          <p className="font-medium text-sm">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(item.created_at)}
                          </p>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {hasAnyRole(['admin', 'sales']) && (
                  <>
                    <a
                      href="/leads"
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <Users className="h-5 w-5 text-primary" />
                      <span className="text-sm font-medium">Add New Lead</span>
                    </a>
                    <a
                      href="/proposals"
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <FileText className="h-5 w-5 text-primary" />
                      <span className="text-sm font-medium">Create Proposal</span>
                    </a>
                  </>
                )}
                {hasAnyRole(['admin', 'editor', 'strategy']) && (
                  <a
                    href="/reels"
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <Film className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">View Editing Pipeline</span>
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
