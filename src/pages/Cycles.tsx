import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { KanbanBoard } from '@/components/shared/KanbanBoard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { DelayedCycleBadge } from '@/components/shared/DelayedCycleBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Plus, Film, Smile, Meh, Frown, AlertCircle } from 'lucide-react';
import { CycleFormDialog } from '@/components/cycles/CycleFormDialog';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';
import { useWorkflowValidation } from '@/hooks/useWorkflowValidation';

type MonthlyCycle = Tables<'monthly_cycles'>;
type Client = Tables<'clients'>;
type CycleStatus = 'planned' | 'in_production' | 'publishing_live' | 'completed';

const cycleColumns = [
  { id: 'planned', title: 'Planned', count: 0 },
  { id: 'in_production', title: 'In Production', count: 0 },
  { id: 'publishing_live', title: 'Publishing', count: 0 },
  { id: 'completed', title: 'Completed', count: 0 },
];

export default function Cycles() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCycle, setEditingCycle] = useState<MonthlyCycle | null>(null);
  const [clientFilter, setClientFilter] = useState<string>('all');
  const queryClient = useQueryClient();

  const { data: cycles = [], isLoading } = useQuery({
    queryKey: ['monthly_cycles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('monthly_cycles').select('*').order('month_number', { ascending: false });
      if (error) throw error;
      return data as MonthlyCycle[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').eq('status', 'active').order('client_name');
      if (error) throw error;
      return data as Client[];
    },
  });

  const { canCycleComplete } = useWorkflowValidation();

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CycleStatus }) => {
      // Validate: can't complete unless posted >= planned
      if (status === 'completed') {
        const cycle = cycles.find(c => c.id === id);
        if (cycle && !canCycleComplete(cycle.reels_posted || 0, cycle.reels_planned || 0)) {
          throw new Error('Cannot complete: Reels posted must meet target');
        }
      }
      const { error } = await supabase.from('monthly_cycles').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly_cycles'] });
      toast.success('Cycle status updated');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to update status'),
  });

  const filteredCycles = cycles.filter((c) => clientFilter === 'all' || c.client_id === clientFilter);

  const getClientName = (clientId: string) => clients.find((c) => c.id === clientId)?.client_name || 'Unknown';

  const handleEdit = (cycle: MonthlyCycle) => {
    setEditingCycle(cycle);
    setIsDialogOpen(true);
  };

  const handleClose = () => {
    setIsDialogOpen(false);
    setEditingCycle(null);
  };

  const getSatisfactionIcon = (satisfaction: string | null) => {
    switch (satisfaction) {
      case 'happy': return <Smile className="h-4 w-4 text-success" />;
      case 'neutral': return <Meh className="h-4 w-4 text-warning" />;
      case 'risk': return <Frown className="h-4 w-4 text-destructive" />;
      default: return null;
    }
  };

  const renderCard = (cycle: MonthlyCycle) => {
    const planned = cycle.reels_planned || 0;
    const posted = cycle.reels_posted || 0;
    const progress = planned > 0 ? (posted / planned) * 100 : 0;
    const canComplete = canCycleComplete(posted, planned);

    return (
      <Card className={`cursor-pointer hover:shadow-md transition-shadow bg-card ${cycle.is_delayed ? 'border-warning' : ''}`} onClick={() => handleEdit(cycle)}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium text-foreground">{getClientName(cycle.client_id)}</h4>
              <p className="text-xs text-muted-foreground">Month {cycle.month_number}</p>
            </div>
            <div className="flex items-center gap-2">
              {cycle.is_delayed && <DelayedCycleBadge reason={cycle.cycle_delay_reason} />}
              {getSatisfactionIcon(cycle.client_satisfaction)}
              <StatusBadge status={cycle.status} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="text-foreground">{posted}/{planned} reels</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="p-2 rounded bg-muted/50">
              <div className="font-medium text-foreground">{cycle.reels_planned || 0}</div>
              <div className="text-muted-foreground">Planned</div>
            </div>
            <div className="p-2 rounded bg-muted/50">
              <div className="font-medium text-foreground">{cycle.reels_shot || 0}</div>
              <div className="text-muted-foreground">Shot</div>
            </div>
            <div className="p-2 rounded bg-muted/50">
              <div className="font-medium text-foreground">{cycle.reels_edited || 0}</div>
              <div className="text-muted-foreground">Edited</div>
            </div>
            <div className="p-2 rounded bg-muted/50">
              <div className="font-medium text-foreground">{cycle.reels_posted || 0}</div>
              <div className="text-muted-foreground">Posted</div>
            </div>
          </div>

          {cycle.issues_faced && (
            <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
              {cycle.issues_faced}
            </div>
          )}

          <div className="flex gap-1 pt-2 border-t border-border">
            {(['planned', 'in_production', 'publishing_live', 'completed'] as CycleStatus[])
              .filter((s) => s !== cycle.status)
              .slice(0, 2)
              .map((status) => {
                const isCompleteDisabled = status === 'completed' && !canComplete;
                return (
                  <Button
                    key={status}
                    variant="ghost"
                    size="sm"
                    className={`text-xs h-7 flex-1 ${isCompleteDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={isCompleteDisabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isCompleteDisabled) {
                        updateStatus.mutate({ id: cycle.id, status });
                      }
                    }}
                    title={isCompleteDisabled ? 'Reels posted must meet target to complete' : undefined}
                  >
                    → {status.replace('_', ' ')}
                  </Button>
                );
              })}
          </div>

          {cycle.status !== 'completed' && !canComplete && (
            <div className="flex items-center gap-1 text-xs text-warning">
              <AlertCircle className="h-3 w-3" />
              <span>{planned - posted} more reels needed to complete</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">Monthly Cycles</h1>
            <p className="text-sm text-muted-foreground">Track monthly production progress</p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)} size="sm" className="w-fit">
            <Plus className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">New Cycle</span>
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
              {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.client_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <KanbanBoard
            columns={cycleColumns}
            items={filteredCycles}
            getItemColumn={(c) => c.status}
            getItemId={(c) => c.id}
            renderItem={renderCard}
            emptyMessage="No cycles"
            onItemMove={(id, newStatus) => updateStatus.mutate({ id, status: newStatus as CycleStatus })}
          />
        )}
      </div>

      <CycleFormDialog open={isDialogOpen} onOpenChange={handleClose} cycle={editingCycle} clients={clients} />
    </AppLayout>
  );
}
