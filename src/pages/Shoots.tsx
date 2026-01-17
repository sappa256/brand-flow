import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { KanbanBoard } from '@/components/shared/KanbanBoard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, MapPin, Calendar, Film } from 'lucide-react';
import { ShootFormDialog } from '@/components/shoots/ShootFormDialog';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type Shoot = Tables<'shoots'>;
type Client = Tables<'clients'>;
type ShootStatus = 'not_scheduled' | 'dates_fixed' | 'completed' | 'pending_client';

const shootColumns = [
  { id: 'not_scheduled', title: 'Not Scheduled', count: 0 },
  { id: 'pending_client', title: 'Pending Client', count: 0 },
  { id: 'dates_fixed', title: 'Dates Fixed', count: 0 },
  { id: 'completed', title: 'Completed', count: 0 },
];

export default function Shoots() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingShoot, setEditingShoot] = useState<Shoot | null>(null);
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const queryClient = useQueryClient();

  const { data: shoots = [], isLoading: shootsLoading } = useQuery({
    queryKey: ['shoots'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shoots')
        .select('*')
        .order('month_number', { ascending: false });
      if (error) throw error;
      return data as Shoot[];
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

  const updateShootStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ShootStatus }) => {
      const { error } = await supabase
        .from('shoots')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shoots'] });
      toast.success('Shoot status updated');
    },
    onError: () => {
      toast.error('Failed to update shoot status');
    },
  });

  const filteredShoots = shoots.filter((shoot) => {
    if (clientFilter !== 'all' && shoot.client_id !== clientFilter) return false;
    if (monthFilter !== 'all' && shoot.month_number.toString() !== monthFilter) return false;
    return true;
  });

  const uniqueMonths = [...new Set(shoots.map((s) => s.month_number))].sort((a, b) => b - a);

  const getClientName = (clientId: string) => {
    return clients.find((c) => c.id === clientId)?.client_name || 'Unknown';
  };

  const handleEditShoot = (shoot: Shoot) => {
    setEditingShoot(shoot);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingShoot(null);
  };

  const renderShootCard = (shoot: Shoot) => (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow bg-card"
      onClick={() => handleEditShoot(shoot)}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="font-medium text-foreground">{getClientName(shoot.client_id)}</h4>
            <p className="text-xs text-muted-foreground">Month {shoot.month_number}</p>
          </div>
          <StatusBadge status={shoot.status} />
        </div>

        {shoot.location && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span className="truncate">{shoot.location}</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Film className="h-3.5 w-3.5" />
          <span>{shoot.reels_planned || 0} reels planned</span>
        </div>

        {(shoot.shoot_day_1 || shoot.shoot_day_2 || shoot.shoot_day_3) && (
          <div className="space-y-1">
            {shoot.shoot_day_1 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>Day 1: {format(new Date(shoot.shoot_day_1), 'MMM d, yyyy')}</span>
              </div>
            )}
            {shoot.shoot_day_2 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>Day 2: {format(new Date(shoot.shoot_day_2), 'MMM d, yyyy')}</span>
              </div>
            )}
            {shoot.shoot_day_3 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>Day 3: {format(new Date(shoot.shoot_day_3), 'MMM d, yyyy')}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-1 pt-2 border-t border-border">
          {(['not_scheduled', 'pending_client', 'dates_fixed', 'completed'] as ShootStatus[])
            .filter((s) => s !== shoot.status)
            .slice(0, 2)
            .map((status) => (
              <Button
                key={status}
                variant="ghost"
                size="sm"
                className="text-xs h-7 flex-1"
                onClick={(e) => {
                  e.stopPropagation();
                  updateShootStatus.mutate({ id: shoot.id, status });
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
            <h1 className="text-xl md:text-2xl font-bold text-foreground">Shoots</h1>
            <p className="text-sm text-muted-foreground">Schedule and track client shoot days</p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)} size="sm" className="w-fit">
            <Plus className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Schedule Shoot</span>
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
                <SelectItem key={client.id} value={client.id}>
                  {client.client_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-28 md:w-40 text-xs md:text-sm">
              <SelectValue placeholder="Filter by month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {uniqueMonths.map((month) => (
                <SelectItem key={month} value={month.toString()}>
                  Month {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {shootsLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <KanbanBoard
            columns={shootColumns}
            items={filteredShoots}
            getItemColumn={(shoot) => shoot.status}
            getItemId={(shoot) => shoot.id}
            renderItem={renderShootCard}
            emptyMessage="No shoots"
            onRefresh={() => queryClient.invalidateQueries({ queryKey: ['shoots'] })}
          />
        )}
      </div>

      <ShootFormDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseDialog();
          } else {
            setIsDialogOpen(true);
          }
        }}
        shoot={editingShoot}
        clients={clients}
      />
    </AppLayout>
  );
}
