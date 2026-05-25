import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { HealthBadge } from '@/components/shared/HealthBadge';
import { ContractWarningBadge } from '@/components/shared/ContractWarningBadge';
import { DelayedCycleBadge } from '@/components/shared/DelayedCycleBadge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { 
  Camera, 
  Film, 
  Calendar, 
  AlertTriangle, 
  Clock, 
  RefreshCw, 
  Building2,
  XCircle,
  AlertOctagon,
  Users,
  Link as LinkIcon
} from 'lucide-react';
import { format, differenceInHours, isToday, subDays } from 'date-fns';
import { Link } from 'react-router-dom';
import type { Tables } from '@/integrations/supabase/types';

type Client = Tables<'clients'>;
type Shoot = Tables<'shoots'>;
type Reel = Tables<'reels'>;
type ContentCalendar = Tables<'content_calendar'>;
type MonthlyCycle = Tables<'monthly_cycles'>;

export default function OwnerDashboard() {
  const { hasAnyRole, isLoading: authLoading } = useAuth();
  const isAdmin = hasAnyRole(['admin']);

  // Shoots scheduled for today
  const { data: todayShoots = [], isLoading: shootsLoading } = useQuery({
    queryKey: ['owner-dashboard-shoots-today'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('shoots')
        .select('*, client:clients(client_name)')
        .or(`shoot_day_1.eq.${today},shoot_day_2.eq.${today},shoot_day_3.eq.${today}`)
        .neq('status', 'completed');
      if (error) throw error;
      return data;
    },
    enabled: !authLoading && isAdmin,
  });

  // Reels stuck in editing for > 48 hours
  const { data: stuckReels = [], isLoading: reelsLoading } = useQuery({
    queryKey: ['owner-dashboard-stuck-reels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reels')
        .select('*, client:clients(client_name), editor:profiles(full_name)')
        .eq('edit_status', 'editing')
        .order('updated_at', { ascending: true });
      if (error) throw error;
      
      // Filter for those stuck > 48 hours
      const now = new Date();
      return data.filter(reel => {
        const lastUpdate = new Date(reel.updated_at);
        return differenceInHours(now, lastUpdate) > 48;
      });
    },
    enabled: !authLoading && isAdmin,
  });

  // Posts due today
  const { data: todayPosts = [], isLoading: postsLoading } = useQuery({
    queryKey: ['owner-dashboard-posts-today'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('content_calendar')
        .select('*, client:clients(client_name)')
        .eq('post_date', today)
        .eq('posting_status', 'scheduled');
      if (error) throw error;
      return data;
    },
    enabled: !authLoading && isAdmin,
  });

  // Missed posts in last 7 days
  const { data: missedPosts = [], isLoading: missedLoading } = useQuery({
    queryKey: ['owner-dashboard-missed-posts'],
    queryFn: async () => {
      const sevenDaysAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('content_calendar')
        .select('*, client:clients(client_name)')
        .eq('posting_status', 'missed')
        .gte('post_date', sevenDaysAgo)
        .order('post_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !authLoading && isAdmin,
  });

  // Clients in contract month 5+
  const { data: endingContracts = [], isLoading: contractsLoading } = useQuery({
    queryKey: ['owner-dashboard-ending-contracts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('status', 'active')
        .gte('current_contract_month', 5)
        .order('current_contract_month', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !authLoading && isAdmin,
  });

  // Clients with health_status = 'risk'
  const { data: riskClients = [], isLoading: riskLoading } = useQuery({
    queryKey: ['owner-dashboard-risk-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('status', 'active')
        .eq('health_status', 'risk');
      if (error) throw error;
      return data;
    },
    enabled: !authLoading && isAdmin,
  });

  // Delayed or blocked cycles
  const { data: delayedCycles = [], isLoading: cyclesLoading } = useQuery({
    queryKey: ['owner-dashboard-delayed-cycles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monthly_cycles')
        .select('*, client:clients(client_name)')
        .eq('is_delayed', true)
        .neq('status', 'completed')
        .order('month_number', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !authLoading && isAdmin,
  });

  // Fetch team workload (editors and their active reel assignments)
  const { data: teamWorkload = [], isLoading: workloadLoading } = useQuery({
    queryKey: ['team-workload'],
    queryFn: async () => {
      // 1. Get user IDs with 'editor' role
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'editor');

      if (rolesError) throw rolesError;
      if (!userRoles || userRoles.length === 0) return [];

      const editorIds = userRoles.map(ur => ur.user_id);

      // 2. Fetch profiles for these editors
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', editorIds);

      if (profilesError) throw profilesError;
      if (!profiles) return [];

      // 3. Fetch all active reels (edit_status is not 'approved')
      const { data: activeReels, error: reelsError } = await supabase
        .from('reels')
        .select('id, editor_id, client_id, reel_number, edit_status')
        .neq('edit_status', 'approved');

      if (reelsError) throw reelsError;

      // 4. Map active reels to editors
      return profiles.map(profile => {
        const assignedReels = activeReels?.filter(r => r.editor_id === profile.id) || [];
        return {
          id: profile.id,
          fullName: profile.full_name || 'Unnamed Editor',
          email: profile.email || '',
          avatarUrl: profile.avatar_url,
          activeReelsCount: assignedReels.length,
          reels: assignedReels
        };
      }).sort((a, b) => b.activeReelsCount - a.activeReelsCount);
    },
    enabled: !authLoading && isAdmin,
  });

  const isLoading = shootsLoading || reelsLoading || postsLoading || missedLoading || contractsLoading || riskLoading || cyclesLoading || workloadLoading;

  if (authLoading) {
    return (
      <AppLayout title="Owner Dashboard">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </AppLayout>
    );
  }

  // Redirect non-admins
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppLayout title="Owner – Daily Ops Command Center">
      <div className="space-y-6">
        {/* Summary Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
          <Card className="bg-card border-primary/20">
            <CardContent className="p-3 md:p-4 text-center">
              <Camera className="h-5 w-5 md:h-6 md:w-6 mx-auto text-primary mb-1 md:mb-2" />
              <div className="text-xl md:text-2xl font-bold">{todayShoots.length}</div>
              <div className="text-[10px] md:text-xs text-muted-foreground">Shoots Today</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-warning/20">
            <CardContent className="p-3 md:p-4 text-center">
              <Film className="h-5 w-5 md:h-6 md:w-6 mx-auto text-warning mb-1 md:mb-2" />
              <div className="text-xl md:text-2xl font-bold">{stuckReels.length}</div>
              <div className="text-[10px] md:text-xs text-muted-foreground">Stuck Reels</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-info/20">
            <CardContent className="p-3 md:p-4 text-center">
              <Calendar className="h-5 w-5 md:h-6 md:w-6 mx-auto text-info mb-1 md:mb-2" />
              <div className="text-xl md:text-2xl font-bold">{todayPosts.length}</div>
              <div className="text-[10px] md:text-xs text-muted-foreground">Posts Due Today</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-destructive/20">
            <CardContent className="p-3 md:p-4 text-center">
              <XCircle className="h-5 w-5 md:h-6 md:w-6 mx-auto text-destructive mb-1 md:mb-2" />
              <div className="text-xl md:text-2xl font-bold">{missedPosts.length}</div>
              <div className="text-[10px] md:text-xs text-muted-foreground">Missed (7 days)</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-orange-500/20">
            <CardContent className="p-3 md:p-4 text-center">
              <Clock className="h-5 w-5 md:h-6 md:w-6 mx-auto text-orange-500 mb-1 md:mb-2" />
              <div className="text-xl md:text-2xl font-bold">{endingContracts.length}</div>
              <div className="text-[10px] md:text-xs text-muted-foreground">Contracts Ending</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-destructive/20">
            <CardContent className="p-3 md:p-4 text-center">
              <AlertTriangle className="h-5 w-5 md:h-6 md:w-6 mx-auto text-destructive mb-1 md:mb-2" />
              <div className="text-xl md:text-2xl font-bold">{riskClients.length}</div>
              <div className="text-[10px] md:text-xs text-muted-foreground">At Risk Clients</div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Cards */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Shoots Today */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5 text-primary" />
                  Shoots Today
                </CardTitle>
                <Link to="/shoots">
                  <Button variant="ghost" size="sm">View All</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {shootsLoading ? (
                <Skeleton className="h-20" />
              ) : todayShoots.length === 0 ? (
                <p className="text-muted-foreground text-sm">No shoots scheduled for today</p>
              ) : (
                <div className="space-y-3">
                  {todayShoots.map((shoot: any) => (
                    <div key={shoot.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium">{shoot.client?.client_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {shoot.location || 'No location set'} • {shoot.reels_planned} reels
                        </p>
                      </div>
                      <StatusBadge status={shoot.status} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stuck Reels (>48h in editing) */}
          <Card className={stuckReels.length > 0 ? 'border-warning' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Film className="h-5 w-5 text-warning" />
                  Reels Stuck in Editing
                  {stuckReels.length > 0 && (
                    <Badge variant="outline" className="bg-warning/20 text-warning">
                      &gt;48h
                    </Badge>
                  )}
                </CardTitle>
                <Link to="/reels">
                  <Button variant="ghost" size="sm">View All</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {reelsLoading ? (
                <Skeleton className="h-20" />
              ) : stuckReels.length === 0 ? (
                <p className="text-muted-foreground text-sm">All reels are moving smoothly</p>
              ) : (
                <div className="space-y-3">
                  {stuckReels.slice(0, 5).map((reel: any) => {
                    const hoursStuck = differenceInHours(new Date(), new Date(reel.updated_at));
                    return (
                      <div key={reel.id} className="flex items-center justify-between p-3 rounded-lg bg-warning/10 border border-warning/20">
                        <div>
                          <p className="font-medium">{reel.client?.client_name}</p>
                          <p className="text-sm text-muted-foreground">
                            Reel #{reel.reel_number} • Editor: {reel.editor?.full_name || 'Unassigned'}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-warning">
                          {hoursStuck}h stuck
                        </Badge>
                      </div>
                    );
                  })}
                  {stuckReels.length > 5 && (
                    <p className="text-sm text-muted-foreground text-center">
                      +{stuckReels.length - 5} more stuck reels
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Posts Due Today */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-info" />
                  Posts Due Today
                </CardTitle>
                <Link to="/calendar">
                  <Button variant="ghost" size="sm">View Calendar</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {postsLoading ? (
                <Skeleton className="h-20" />
              ) : todayPosts.length === 0 ? (
                <p className="text-muted-foreground text-sm">No posts scheduled for today</p>
              ) : (
                <div className="space-y-3">
                  {todayPosts.map((post: any) => (
                    <div key={post.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium">{post.client?.client_name}</p>
                        <p className="text-sm text-muted-foreground capitalize">{post.platform}</p>
                      </div>
                      <Badge variant="outline" className="bg-info/20 text-info">Scheduled</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Missed Posts (Last 7 Days) */}
          <Card className={missedPosts.length > 0 ? 'border-destructive' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-destructive" />
                  Missed Posts
                  {missedPosts.length > 0 && (
                    <Badge variant="destructive">{missedPosts.length}</Badge>
                  )}
                </CardTitle>
                <Link to="/calendar">
                  <Button variant="ghost" size="sm">View Calendar</Button>
                </Link>
              </div>
              <CardDescription>Last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              {missedLoading ? (
                <Skeleton className="h-20" />
              ) : missedPosts.length === 0 ? (
                <p className="text-muted-foreground text-sm">No missed posts - great job!</p>
              ) : (
                <div className="space-y-3">
                  {missedPosts.slice(0, 5).map((post: any) => (
                    <div key={post.id} className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <div>
                        <p className="font-medium">{post.client?.client_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(post.post_date), 'MMM d')} • {post.platform}
                        </p>
                      </div>
                      <Badge variant="destructive">Missed</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contracts Ending Soon */}
          <Card className={endingContracts.length > 0 ? 'border-orange-500' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-orange-500" />
                  Contracts Ending
                </CardTitle>
                <Link to="/contracts">
                  <Button variant="ghost" size="sm">View Contracts</Button>
                </Link>
              </div>
              <CardDescription>Month 5+ clients require renewal conversation</CardDescription>
            </CardHeader>
            <CardContent>
              {contractsLoading ? (
                <Skeleton className="h-20" />
              ) : endingContracts.length === 0 ? (
                <p className="text-muted-foreground text-sm">No contracts ending soon</p>
              ) : (
                <div className="space-y-3">
                  {endingContracts.map((client) => (
                    <div key={client.id} className="flex items-center justify-between p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                      <div>
                        <p className="font-medium">{client.client_name}</p>
                        <p className="text-sm text-muted-foreground capitalize">{client.plan_type} plan</p>
                      </div>
                      <ContractWarningBadge contractMonth={client.current_contract_month} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* At Risk Clients */}
          <Card className={riskClients.length > 0 ? 'border-destructive' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  At Risk Clients
                </CardTitle>
                <Link to="/clients">
                  <Button variant="ghost" size="sm">View Clients</Button>
                </Link>
              </div>
              <CardDescription>Require immediate attention</CardDescription>
            </CardHeader>
            <CardContent>
              {riskLoading ? (
                <Skeleton className="h-20" />
              ) : riskClients.length === 0 ? (
                <p className="text-muted-foreground text-sm">No clients at risk - excellent!</p>
              ) : (
                <div className="space-y-3">
                  {riskClients.map((client) => (
                    <div key={client.id} className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <div>
                        <p className="font-medium">{client.client_name}</p>
                        <p className="text-sm text-muted-foreground">Month {client.current_contract_month}</p>
                      </div>
                      <HealthBadge status="risk" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Delayed Cycles */}
          <Card className={`lg:col-span-2 ${delayedCycles.length > 0 ? 'border-destructive' : ''}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <AlertOctagon className="h-5 w-5 text-destructive" />
                  Delayed Monthly Cycles
                  {delayedCycles.length > 0 && (
                    <Badge variant="destructive">{delayedCycles.length}</Badge>
                  )}
                </CardTitle>
                <Link to="/cycles">
                  <Button variant="ghost" size="sm">View Cycles</Button>
                </Link>
              </div>
              <CardDescription>Cycles past their expected completion date</CardDescription>
            </CardHeader>
            <CardContent>
              {cyclesLoading ? (
                <Skeleton className="h-20" />
              ) : delayedCycles.length === 0 ? (
                <p className="text-muted-foreground text-sm">All cycles on track</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {delayedCycles.map((cycle: any) => (
                    <div key={cycle.id} className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <div>
                        <p className="font-medium">{cycle.client?.client_name}</p>
                        <p className="text-sm text-muted-foreground">
                          Month {cycle.month_number} • {cycle.reels_posted || 0}/{cycle.reels_planned || 0} posted
                        </p>
                        {cycle.cycle_delay_reason && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            Reason: {cycle.cycle_delay_reason}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={cycle.status} />
                        <DelayedCycleBadge isDelayed={true} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Team Workload Monitor */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-400" />
                  Team Workload Monitor
                </CardTitle>
                <Link to="/settings">
                  <Button variant="ghost" size="sm">Manage Team</Button>
                </Link>
              </div>
              <CardDescription>Monitor active reel assignments per editor (unapproved drafts)</CardDescription>
            </CardHeader>
            <CardContent>
              {workloadLoading ? (
                <Skeleton className="h-20" />
              ) : teamWorkload.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">No editors registered in settings.</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {teamWorkload.map((editor: any) => {
                    const count = editor.activeReelsCount;
                    const statusColor = 
                      count >= 6 ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                      count >= 3 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                      'bg-green-500/20 text-green-400 border-green-500/30';
                    
                    const statusText = 
                      count >= 6 ? 'Heavy' :
                      count >= 3 ? 'Optimal' :
                      'Light';

                    const percent = Math.min((count / 8) * 100, 100);

                    return (
                      <div key={editor.id} className="p-4 rounded-xl border border-white/5 bg-background/30 backdrop-blur-sm space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-sm">{editor.fullName}</h4>
                            <p className="text-xs text-muted-foreground">{editor.email}</p>
                          </div>
                          <Badge variant="outline" className={`${statusColor} text-[10px] font-bold uppercase`}>
                            {count} Reels ({statusText})
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>Capacity</span>
                            <span>{count}/8 Reels</span>
                          </div>
                          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                count >= 6 ? 'bg-red-500' :
                                count >= 3 ? 'bg-yellow-500' :
                                'bg-green-500'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
