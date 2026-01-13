import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { KanbanBoard } from '@/components/shared/KanbanBoard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ProposalFormDialog } from '@/components/proposals/ProposalFormDialog';
import { Plus, FileText, Calendar, IndianRupee } from 'lucide-react';
import type { Proposal } from '@/types/crm';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

const PROPOSAL_COLUMNS = [
  { id: 'draft', title: 'Draft', count: 0 },
  { id: 'sent', title: 'Sent', count: 0 },
  { id: 'accepted', title: 'Accepted', count: 0 },
  { id: 'rejected', title: 'Rejected', count: 0 },
];

export default function Proposals() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);

  useEffect(() => {
    fetchProposals();
  }, []);

  const fetchProposals = async () => {
    const { data, error } = await supabase
      .from('proposals')
      .select('*, lead:leads(*)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setProposals(data as Proposal[]);
    }
    setIsLoading(false);
  };

  const handleCardClick = (proposal: Proposal) => {
    setSelectedProposal(proposal);
    setFormOpen(true);
  };

  const handleAddNew = () => {
    setSelectedProposal(null);
    setFormOpen(true);
  };

  const renderProposalCard = (proposal: Proposal) => {
    const totalValue = proposal.monthly_fee * proposal.contract_duration_months;
    
    return (
      <Card 
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => handleCardClick(proposal)}
      >
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-medium text-sm">{proposal.client_name}</h3>
              <p className="text-xs text-muted-foreground capitalize">
                {proposal.plan_type} Plan
              </p>
            </div>
            <StatusBadge status={proposal.status} />
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              <span>{proposal.reels_per_month} reels/mo</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{proposal.contract_duration_months}mo</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="flex items-center gap-1 text-primary font-medium">
              <IndianRupee className="h-3 w-3" />
              <span className="text-sm">{proposal.monthly_fee.toLocaleString('en-IN')}/mo</span>
            </div>
            <span className="text-xs text-muted-foreground">
              TCV: ₹{totalValue.toLocaleString('en-IN')}
            </span>
          </div>

          {proposal.sent_date && (
            <p className="text-xs text-muted-foreground">
              Sent: {format(new Date(proposal.sent_date), 'MMM d, yyyy')}
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <AppLayout title="Proposals">
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
      title="Proposals"
      actions={
        <Button size="sm" onClick={handleAddNew}>
          <Plus className="h-4 w-4 mr-2" />
          Create Proposal
        </Button>
      }
    >
      <KanbanBoard
        columns={PROPOSAL_COLUMNS}
        items={proposals}
        getItemColumn={(proposal) => proposal.status}
        getItemId={(proposal) => proposal.id}
        renderItem={renderProposalCard}
        emptyMessage="No proposals"
      />

      <ProposalFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        proposal={selectedProposal}
        onSuccess={fetchProposals}
      />
    </AppLayout>
  );
}
