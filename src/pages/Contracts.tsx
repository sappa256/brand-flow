import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { DataTable } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { StatusBadge } from '@/components/shared/StatusBadge';
import type { Contract, Client } from '@/types/crm';
import { Skeleton } from '@/components/ui/skeleton';
import { format, differenceInDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, IndianRupee, Plus, FileDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ContractFormDialog } from '@/components/contracts/ContractFormDialog';
import { generateContractPdf } from '@/lib/contractPdfGenerator';
import { toast } from 'sonner';

interface ContractWithClient extends Contract {
  client: Client;
}

export default function Contracts() {
  const [contracts, setContracts] = useState<ContractWithClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  useEffect(() => {
    fetchContracts();
  }, []);

  const fetchContracts = async () => {
    const { data, error } = await supabase
      .from('contracts')
      .select('*, client:clients(*)')
      .order('end_date', { ascending: true });

    if (!error && data) {
      setContracts(data as ContractWithClient[]);
    }
    setIsLoading(false);
  };

  const handleAddContract = () => {
    setSelectedContract(null);
    setDialogOpen(true);
  };

  const handleEditContract = (contract: ContractWithClient) => {
    setSelectedContract(contract);
    setDialogOpen(true);
  };

  const handleSuccess = () => {
    fetchContracts();
  };

  const handleDownloadPdf = (contract: ContractWithClient) => {
    try {
      generateContractPdf(contract);
      toast.success('Contract PDF downloaded');
    } catch (error) {
      toast.error('Failed to generate PDF');
    }
  };

  const handleDeleteContract = async (contractId: string) => {
    const { error } = await supabase
      .from('contracts')
      .delete()
      .eq('id', contractId);

    if (error) {
      toast.error('Failed to delete contract');
      return;
    }

    setContracts(prev => prev.filter(c => c.id !== contractId));
    toast.success('Contract deleted successfully');
  };

  const getDaysUntilEnd = (endDate: string) => {
    return differenceInDays(new Date(endDate), new Date());
  };

  const columns = [
    {
      key: 'client',
      header: 'Client',
      render: (contract: ContractWithClient) => (
        <div>
          <p className="font-medium">{contract.client?.client_name}</p>
          {contract.client?.brand_name && (
            <p className="text-xs text-muted-foreground">{contract.client.brand_name}</p>
          )}
        </div>
      ),
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (contract: ContractWithClient) => (
        <span className="text-sm">{contract.duration_months} months</span>
      ),
    },
    {
      key: 'retainer',
      header: 'Monthly Retainer',
      render: (contract: ContractWithClient) => (
        <div className="flex items-center gap-1 text-primary font-medium">
          <IndianRupee className="h-3 w-3" />
          <span>{contract.monthly_retainer.toLocaleString('en-IN')}</span>
        </div>
      ),
    },
    {
      key: 'period',
      header: 'Period',
      render: (contract: ContractWithClient) => (
        <div className="text-sm text-muted-foreground">
          {format(new Date(contract.start_date), 'MMM yyyy')} -{' '}
          {format(new Date(contract.end_date), 'MMM yyyy')}
        </div>
      ),
    },
    {
      key: 'time_left',
      header: 'Time Left',
      render: (contract: ContractWithClient) => {
        const daysLeft = getDaysUntilEnd(contract.end_date);
        const isEndingSoon = daysLeft <= 30 && daysLeft > 0;
        const isExpired = daysLeft < 0;

        return (
          <div className={cn(
            "flex items-center gap-1 text-sm",
            isExpired && "text-destructive",
            isEndingSoon && "text-warning"
          )}>
            {isEndingSoon && <AlertTriangle className="h-3 w-3" />}
            {isExpired ? (
              <span>Expired {Math.abs(daysLeft)} days ago</span>
            ) : (
              <span>{daysLeft} days left</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'payment',
      header: 'Payment',
      render: (contract: ContractWithClient) => (
        <StatusBadge status={contract.payment_status} />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (contract: ContractWithClient) => (
        <StatusBadge status={contract.contract_status} />
      ),
    },
    {
      key: 'renewal',
      header: 'Renewal',
      render: (contract: ContractWithClient) => {
        if (!contract.renewal_probability) return <span>-</span>;
        const colors = {
          high: 'bg-green-500/20 text-green-400 border-green-500/30',
          medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
          low: 'bg-red-500/20 text-red-400 border-red-500/30',
        };
        return (
          <Badge variant="outline" className={cn("capitalize", colors[contract.renewal_probability])}>
            {contract.renewal_probability}
          </Badge>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (contract: ContractWithClient) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleDownloadPdf(contract)}
          title="Download Contract PDF"
        >
          <FileDown className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  if (isLoading) {
    return (
      <AppLayout title="Contracts">
        <Skeleton className="h-96 w-full" />
      </AppLayout>
    );
  }

  // Calculate summary stats
  const activeContracts = contracts.filter(c => c.contract_status === 'active');
  const totalMRR = activeContracts.reduce((sum, c) => sum + c.monthly_retainer, 0);
  const endingSoon = contracts.filter(c => {
    const daysLeft = getDaysUntilEnd(c.end_date);
    return daysLeft <= 30 && daysLeft > 0;
  });

  return (
    <AppLayout
      title="Contracts"
      actions={
        <Button size="sm" onClick={handleAddContract}>
          <Plus className="h-4 w-4 mr-2" />
          Add Contract
        </Button>
      }
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <div className="bg-card border border-border rounded-lg p-3 md:p-4">
          <p className="text-xs md:text-sm text-muted-foreground">Active Contracts</p>
          <p className="text-xl md:text-2xl font-bold">{activeContracts.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 md:p-4">
          <p className="text-xs md:text-sm text-muted-foreground">Monthly Revenue</p>
          <p className="text-xl md:text-2xl font-bold text-primary">
            ₹{totalMRR.toLocaleString('en-IN')}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 md:p-4">
          <p className="text-xs md:text-sm text-muted-foreground">Ending Soon</p>
          <p className="text-xl md:text-2xl font-bold text-warning">{endingSoon.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 md:p-4">
          <p className="text-xs md:text-sm text-muted-foreground">Avg Contract Value</p>
          <p className="text-xl md:text-2xl font-bold">
            ₹{activeContracts.length > 0 
              ? Math.round(totalMRR / activeContracts.length).toLocaleString('en-IN')
              : 0
            }
          </p>
        </div>
      </div>

      <DataTable
        data={contracts}
        columns={columns}
        getRowId={(contract) => contract.id}
        emptyMessage="No contracts yet."
        onRefresh={fetchContracts}
        onDelete={handleDeleteContract}
        deleteConfirmMessage="Are you sure you want to delete this contract? This action cannot be undone."
        onRowClick={handleEditContract}
      />

      <ContractFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contract={selectedContract}
        onSuccess={handleSuccess}
      />
    </AppLayout>
  );
}
