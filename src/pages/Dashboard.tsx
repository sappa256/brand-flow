import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatsCard } from '@/components/shared/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Users, FileText, Building2, IndianRupee, TrendingUp, Film, Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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
  const navigate = useNavigate();
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
        {/* Stats Grid — balanced 3-col on desktop */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-3 xl:grid-cols-5">
          {hasAnyRole(['admin', 'sales']) && (
            <>
              <div className="stagger-1 animate-fade-in-up">
                <StatsCard
                  title="Total Leads"
                  value={stats?.totalLeads || 0}
                  subtitle="All time"
                  icon={<Users className="h-6 w-6" />}
                  onClick={() => navigate('/leads')}
                />
              </div>
              <div className="stagger-2 animate-fade-in-up">
                <StatsCard
                  title="Pending Proposals"
                  value={stats?.pendingProposals || 0}
                  subtitle="Draft + Sent"
                  icon={<FileText className="h-6 w-6" />}
                  onClick={() => navigate('/proposals')}
                />
              </div>
            </>
          )}
          
          {hasAnyRole(['admin', 'sales', 'strategy']) && (
            <div className="stagger-3 animate-fade-in-up">
              <StatsCard
                title="Active Clients"
                value={stats?.activeClients || 0}
                subtitle={stats?.atRiskClients ? `${stats.atRiskClients} at risk` : 'All healthy'}
                icon={<Building2 className="h-6 w-6" />}
                onClick={() => navigate('/clients')}
              />
            </div>
          )}
          
          {hasAnyRole(['admin', 'sales']) && (
            <div className="stagger-4 animate-fade-in-up">
              <StatsCard
                title="Monthly Revenue"
                value={formatCurrency(stats?.monthlyRevenue || 0)}
                subtitle="Active contracts"
                icon={<IndianRupee className="h-6 w-6" />}
                onClick={() => navigate('/contracts')}
              />
            </div>
          )}

          {hasAnyRole(['admin', 'editor', 'strategy']) && (
            <div className="stagger-5 animate-fade-in-up">
              <StatsCard
                title="Reels This Month"
                value={stats?.reelsThisMonth || 0}
                subtitle="Created"
                icon={<Film className="h-6 w-6" />}
                onClick={() => navigate('/reels')}
              />
            </div>
          )}
        </div>

        {/* Recent Activity & Quick Actions */}
        <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
          {hasAnyRole(['admin', 'sales']) && (
            <Card className="animate-fade-in-up stagger-5 hover-lift">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Recent Leads
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentActivity.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-8">
                    <p className="text-muted-foreground text-sm">No leads yet.</p>
                    <Button size="sm" onClick={() => navigate('/leads')} className="gap-2">
                      <Plus className="h-4 w-4" /> Add your first lead
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentActivity.map((item, index) => (
                      <div
                        key={item.id}
                        onClick={() => navigate('/leads')}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter') navigate('/leads'); }}
                        className={cn(
                          "flex items-center justify-between py-2 border-b last:border-0 animate-fade-in-up transition-colors hover:bg-muted/30 -mx-2 px-2 rounded-lg cursor-pointer",
                          `stagger-${Math.min(index + 1, 6)}`
                        )}
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

          <Card className="animate-fade-in-up stagger-6 hover-lift">
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {hasAnyRole(['admin', 'sales']) && (
                  <>
                    <a
                      href="/leads"
                      className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/50 hover:border-primary/30 transition-all duration-200 group press-effect"
                    >
                      <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                        <Users className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-medium">Add New Lead</span>
                    </a>
                    <a
                      href="/proposals"
                      className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/50 hover:border-primary/30 transition-all duration-200 group press-effect"
                    >
                      <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                        <FileText className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-medium">Create Proposal</span>
                    </a>
                  </>
                )}
                {hasAnyRole(['admin', 'editor', 'strategy']) && (
                  <a
                    href="/reels"
                    className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/50 hover:border-primary/30 transition-all duration-200 group press-effect"
                  >
                    <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                      <Film className="h-4 w-4" />
                    </div>
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
