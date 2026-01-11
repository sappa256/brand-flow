import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { KanbanBoard } from '@/components/shared/KanbanBoard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Plus, Instagram, Youtube, Linkedin, Mail, Phone } from 'lucide-react';
import type { Lead, LeadStatus } from '@/types/crm';
import { Skeleton } from '@/components/ui/skeleton';

const LEAD_COLUMNS = [
  { id: 'new', title: 'New', count: 0 },
  { id: 'contacted', title: 'Contacted', count: 0 },
  { id: 'qualified', title: 'Qualified', count: 0 },
  { id: 'proposal_required', title: 'Proposal Required', count: 0 },
  { id: 'disqualified', title: 'Disqualified', count: 0 },
];

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('*, assigned_sales:profiles!leads_assigned_sales_id_fkey(*)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setLeads(data as Lead[]);
    }
    setIsLoading(false);
  };

  const renderLeadCard = (lead: Lead) => (
    <Card className="cursor-pointer hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-medium text-sm">{lead.full_name}</h3>
            {lead.niche && (
              <p className="text-xs text-muted-foreground">{lead.niche}</p>
            )}
          </div>
          <StatusBadge status={lead.status} />
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          {lead.email && <Mail className="h-3 w-3" />}
          {lead.phone && <Phone className="h-3 w-3" />}
          {lead.instagram_link && <Instagram className="h-3 w-3" />}
          {lead.youtube_link && <Youtube className="h-3 w-3" />}
          {lead.linkedin_link && <Linkedin className="h-3 w-3" />}
        </div>

        {lead.budget_range && (
          <p className="text-xs text-muted-foreground">
            Budget: ₹{lead.budget_range.replace('_plus', '+')}
          </p>
        )}
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <AppLayout title="Leads">
        <div className="flex gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-96 w-80" />
          ))}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Leads"
      actions={
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Lead
        </Button>
      }
    >
      <KanbanBoard
        columns={LEAD_COLUMNS}
        items={leads}
        getItemColumn={(lead) => lead.status}
        getItemId={(lead) => lead.id}
        renderItem={renderLeadCard}
        emptyMessage="No leads"
      />
    </AppLayout>
  );
}
