import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { KanbanBoard } from '@/components/shared/KanbanBoard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Target, Layers } from 'lucide-react';
import { StrategyFormDialog } from '@/components/strategy/StrategyFormDialog';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type Strategy = Tables<'strategies'>;
type Client = Tables<'clients'>;
type StrategyStatus = 'pending' | 'strategy_call_done' | 'approved';

const strategyColumns = [
  { id: 'pending', title: 'Pending', count: 0 },
  { id: 'strategy_call_done', title: 'Call Done', count: 0 },
  { id: 'approved', title: 'Approved', count: 0 },
];

export default function Strategy() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);
  const [clientFilter, setClientFilter] = useState<string>('all');
  const queryClient = useQueryClient();

  const { data: strategies = [], isLoading } = useQuery({
    queryKey: ['strategies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('strategies')
        .select('*')
        .order('month_number', { ascending: false });
      if (error) throw error;
      return data as Strategy[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('status', 'active')
        .order('client_name');
      if (error) throw error;
      return data as Client[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StrategyStatus }) => {
      const { error } = await supabase.from('strategies').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategies'] });
      toast.success('Strategy status updated');
    },
    onError: () => toast.error('Failed to update status'),
  });

  const deleteStrategy = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('strategies').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategies'] });
      toast.success('Strategy deleted');
    },
    onError: () => toast.error('Failed to delete strategy'),
  });

  const filteredStrategies = strategies.filter((s) => 
    clientFilter === 'all' || s.client_id === clientFilter
  );

  const getClientName = (clientId: string) => 
    clients.find((c) => c.id === clientId)?.client_name || 'Unknown';

  const handleEdit = (strategy: Strategy) => {
    setEditingStrategy(strategy);
    setIsDialogOpen(true);
  };

  const handleClose = () => {
    setIsDialogOpen(false);
    setEditingStrategy(null);
  };

  const renderCard = (strategy: Strategy) => (
    <Card className="cursor-pointer hover:shadow-md transition-shadow bg-card" onClick={() => handleEdit(strategy)}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="font-medium text-foreground">{getClientName(strategy.client_id)}</h4>
            <p className="text-xs text-muted-foreground">Month {strategy.month_number}</p>
          </div>
          <StatusBadge status={strategy.status} />
        </div>

        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Target className="h-3.5 w-3.5" />
          <span>{strategy.monthly_reel_target || 8} reels target</span>
        </div>

        {strategy.platform_priority && (
          <div className="text-sm text-muted-foreground">
            Priority: <span className="text-foreground">{strategy.platform_priority}</span>
          </div>
        )}

        {strategy.content_pillars && strategy.content_pillars.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Layers className="h-3 w-3" />
              <span>Content Pillars</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {strategy.content_pillars.slice(0, 3).map((pillar, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{pillar}</Badge>
              ))}
              {strategy.content_pillars.length > 3 && (
                <Badge variant="outline" className="text-xs">+{strategy.content_pillars.length - 3}</Badge>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-1 pt-2 border-t border-border">
          {(['pending', 'strategy_call_done', 'approved'] as StrategyStatus[])
            .filter((s) => s !== strategy.status)
            .map((status) => (
              <Button
                key={status}
                variant="ghost"
                size="sm"
                className="text-xs h-7 flex-1"
                onClick={(e) => {
                  e.stopPropagation();
                  updateStatus.mutate({ id: strategy.id, status });
                }}
              >
                → {status.replace('_', ' ')}
              </Button>
            ))}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">Strategy</h1>
            <p className="text-sm text-muted-foreground">Plan content strategies for clients</p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)} size="sm" className="w-fit">
            <Plus className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">New Strategy</span>
            <span className="md:hidden">New</span>
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 md:gap-3">
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-36 md:w-48 text-xs md:text-sm">
              <SelectValue placeholder="Filter by client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>{client.client_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <KanbanBoard
            columns={strategyColumns}
            items={filteredStrategies}
            getItemColumn={(s) => s.status}
            getItemId={(s) => s.id}
            renderItem={renderCard}
            emptyMessage="No strategies"
            onItemMove={(id, newStatus) => updateStatus.mutate({ id, status: newStatus as StrategyStatus })}
            onItemDelete={(id) => deleteStrategy.mutateAsync(id)}
            onRefresh={() => queryClient.invalidateQueries({ queryKey: ['strategies'] })}
            deleteConfirmMessage="Are you sure you want to delete this strategy? This action cannot be undone."
          />
        )}
      </div>

      <StrategyFormDialog open={isDialogOpen} onOpenChange={handleClose} strategy={editingStrategy} clients={clients} />
    </AppLayout>
  );
}
