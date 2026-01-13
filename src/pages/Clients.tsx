import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { DataTable } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { HealthBadge } from '@/components/shared/HealthBadge';
import { ContractWarningBadge } from '@/components/shared/ContractWarningBadge';
import { Plus, Eye } from 'lucide-react';
import type { Client } from '@/types/crm';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { ClientFormDialog } from '@/components/clients/ClientFormDialog';

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  useEffect(() => {
    fetchClients();
  }, []);

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
    {
      key: 'actions',
      header: 'Actions',
      render: (client: Client) => (
        <Button size="sm" variant="ghost" onClick={() => handleEditClient(client)}>
          <Eye className="h-4 w-4" />
        </Button>
      ),
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
      <DataTable
        data={clients}
        columns={columns}
        getRowId={(client) => client.id}
        emptyMessage="No clients yet. Convert a proposal to create your first client."
      />

      <ClientFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        client={selectedClient}
        onSuccess={handleSuccess}
      />
    </AppLayout>
  );
}
