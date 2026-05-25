import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { KanbanBoard } from '@/components/shared/KanbanBoard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { ReelFormDialog } from '@/components/reels/ReelFormDialog';
import { Plus, User, Hash, AlertTriangle, CheckCircle, Video } from 'lucide-react';
import type { Reel, EditStatus } from '@/types/crm';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useWorkflowValidation } from '@/hooks/useWorkflowValidation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const EDIT_STATUS_COLUMNS = [
  { id: 'not_started', title: 'Not Started', count: 0 },
  { id: 'editing', title: 'Editing', count: 0 },
  { id: 'ready_for_review', title: 'Ready for Review', count: 0 },
  { id: 'approved', title: 'Approved', count: 0 },
];

interface Client {
  id: string;
  client_name: string;
}

export default function Reels() {
  const navigate = useNavigate();
  const [reels, setReels] = useState<Reel[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedReel, setSelectedReel] = useState<Reel | null>(null);
  const [filterClient, setFilterClient] = useState<string>('all');
  const [filterBatch, setFilterBatch] = useState<string>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [reelsRes, clientsRes] = await Promise.all([
      supabase
        .from('reels')
        .select('*, client:clients(*), editor:profiles(*)')
        .order('created_at', { ascending: false }),
      supabase
        .from('clients')
        .select('id, client_name')
        .eq('status', 'active')
        .order('client_name'),
    ]);

    if (!reelsRes.error && reelsRes.data) {
      setReels(reelsRes.data as Reel[]);
    }
    if (!clientsRes.error && clientsRes.data) {
      setClients(clientsRes.data);
    }
    setIsLoading(false);
  };

  const handleCardClick = (reel: Reel) => {
    setSelectedReel(reel);
    setFormOpen(true);
  };

  const handleAddNew = () => {
    setSelectedReel(null);
    setFormOpen(true);
  };

  const filteredReels = reels.filter((reel) => {
    if (filterClient !== 'all' && reel.client_id !== filterClient) return false;
    if (filterBatch !== 'all' && reel.batch !== filterBatch) return false;
    return true;
  });

  const { canReelMoveToEditing } = useWorkflowValidation();

  const handleReelMove = async (reelId: string, newStatus: string) => {
    const reel = reels.find(r => r.id === reelId);
    if (!reel) return;

    // Validate: can't move to editing unless shoot is completed
    if (newStatus === 'editing') {
      const canMove = await canReelMoveToEditing(reel.client_id, reel.month_number);
      if (!canMove) {
        toast.error('Cannot move to Editing: Shoot must be completed first');
        return;
      }
    }

    const { error } = await supabase
      .from('reels')
      .update({ edit_status: newStatus as EditStatus })
      .eq('id', reelId);

    if (error) {
      toast.error('Failed to update reel status');
      return;
    }

    setReels(prev => prev.map(r => 
      r.id === reelId ? { ...r, edit_status: newStatus as EditStatus } : r
    ));
    toast.success('Reel moved successfully');
  };

  const handleReelDelete = async (reelId: string) => {
    const { error } = await supabase
      .from('reels')
      .delete()
      .eq('id', reelId);

    if (error) {
      toast.error('Failed to delete reel');
      return;
    }

    setReels(prev => prev.filter(r => r.id !== reelId));
    toast.success('Reel deleted successfully');
  };

  const renderReelCard = (reel: Reel) => (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => handleCardClick(reel)}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-medium text-sm">
              {reel.client?.client_name || 'Unknown Client'}
            </h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Hash className="h-3 w-3" />
              Reel {reel.reel_number} • Month {reel.month_number}
            </p>
          </div>
          {reel.priority === 'high' && (
            <Badge variant="destructive" className="text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" />
              High
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">
            Script: {reel.script_status === 'approved' ? 'Approved' : 'Pending'}
          </Badge>
          {reel.batch && (
            <Badge variant="outline" className="text-xs">
              {reel.batch.replace('_', ' ')}
            </Badge>
          )}
        </div>

        {reel.editor && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            <span>{reel.editor.full_name}</span>
          </div>
        )}

        {reel.ready_for_publishing && (
          <Badge variant="default" className="text-xs bg-success/20 text-success border-success/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            Ready to Publish
          </Badge>
        )}

        {reel.notes && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {reel.notes}
          </p>
        )}

        <Button
          size="sm"
          variant="secondary"
          className="w-full text-xs font-semibold mt-2 border-white/10 hover:bg-purple-600 hover:text-white"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/review/${reel.id}`);
          }}
        >
          <Video className="h-3.5 w-3.5 mr-1" />
          Review Video
        </Button>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <AppLayout title="Reels">
        <div className="flex gap-3 md:gap-4 overflow-x-auto pb-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-80 md:h-96 w-72 md:w-80 flex-shrink-0" />
          ))}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Reels"
      actions={
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-28 md:w-40 text-xs md:text-sm">
              <SelectValue placeholder="All Clients" />
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

          <Select value={filterBatch} onValueChange={setFilterBatch}>
            <SelectTrigger className="w-24 md:w-32 text-xs md:text-sm">
              <SelectValue placeholder="All Batches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Batches</SelectItem>
              <SelectItem value="batch_1">Batch 1</SelectItem>
              <SelectItem value="batch_2">Batch 2</SelectItem>
            </SelectContent>
          </Select>

          <Button size="sm" onClick={handleAddNew} className="text-xs md:text-sm">
            <Plus className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Add Reel</span>
          </Button>
        </div>
      }
    >
      <KanbanBoard
        columns={EDIT_STATUS_COLUMNS}
        items={filteredReels}
        getItemColumn={(reel) => reel.edit_status}
        getItemId={(reel) => reel.id}
        renderItem={renderReelCard}
        emptyMessage="No reels"
        onItemMove={handleReelMove}
        onItemDelete={handleReelDelete}
        onRefresh={fetchData}
        deleteConfirmMessage="Are you sure you want to delete this reel? This action cannot be undone."
      />

      <ReelFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        reel={selectedReel}
        clients={clients}
        onSuccess={fetchData}
      />
    </AppLayout>
  );
}
