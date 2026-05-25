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
import { AlertTriangle, IndianRupee, Plus, FileDown, CreditCard, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ContractFormDialog } from '@/components/contracts/ContractFormDialog';
import { generateContractPdf } from '@/lib/contractPdfGenerator';
import { toast } from 'sonner';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface ContractWithClient extends Contract {
  client: Client;
}

export default function Contracts() {
  const [contracts, setContracts] = useState<ContractWithClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [stripeCheckoutContract, setStripeCheckoutContract] = useState<ContractWithClient | null>(null);

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
      render: (contract: ContractWithClient) => {
        const totalValue = contract.monthly_retainer * contract.duration_months;
        const received = contract.amount_received || 0;
        const percentage = totalValue > 0 ? Math.round((received / totalValue) * 100) : 0;
        
        return (
          <div className="space-y-1">
            <StatusBadge status={contract.payment_status} />
            {received > 0 && (
              <p className="text-xs text-muted-foreground">
                ₹{received.toLocaleString('en-IN')} ({percentage}%)
              </p>
            )}
          </div>
        );
      },
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
        <div className="flex gap-1 justify-end">
          {contract.payment_status !== 'paid' && (
            <Button
              size="sm"
              variant="ghost"
              className="text-purple-400 hover:text-purple-300 hover:bg-purple-950/20"
              onClick={(e) => {
                e.stopPropagation();
                setStripeCheckoutContract(contract);
              }}
              title="Mock Stripe Checkout"
            >
              <CreditCard className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              handleDownloadPdf(contract);
            }}
            title="Download Contract PDF"
          >
            <FileDown className="h-4 w-4" />
          </Button>
        </div>
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

      {/* Mock Stripe Checkout Dialog */}
      <Dialog open={!!stripeCheckoutContract} onOpenChange={(open) => !open && setStripeCheckoutContract(null)}>
        <DialogContent className="max-w-xl bg-[#1A1A1E] text-white border-white/10 rounded-2xl overflow-hidden p-0">
          <div className="grid grid-cols-1 md:grid-cols-12">
            {/* Left Info Column */}
            <div className="md:col-span-5 bg-black/40 p-6 flex flex-col justify-between border-r border-white/5">
              <div className="space-y-6">
                <div className="flex items-center gap-1.5 text-purple-400 font-bold uppercase tracking-wider text-xs">
                  <ShieldCheck className="h-4 w-4" /> Secure checkout
                </div>
                <div className="space-y-2">
                  <span className="text-muted-foreground text-xs block">Montaz Medias Retainer</span>
                  <h3 className="font-bold text-lg text-white">
                    {stripeCheckoutContract?.client?.client_name || 'Client Retainer'}
                  </h3>
                  <p className="text-xs text-muted-foreground text-purple-300">
                    {stripeCheckoutContract?.duration_months} Month Retainer Agreement
                  </p>
                </div>
              </div>
              <div className="pt-8">
                <span className="text-[10px] text-muted-foreground uppercase block font-bold tracking-wider">Amount Due</span>
                <span className="text-3xl font-extrabold text-white flex items-baseline gap-1">
                  ₹{stripeCheckoutContract?.monthly_retainer.toLocaleString('en-IN')}
                  <span className="text-xs font-normal text-muted-foreground">/mo</span>
                </span>
              </div>
            </div>

            {/* Right Payment Column */}
            <div className="md:col-span-7 p-6 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Pay with Card</span>
                <span className="text-purple-400 font-semibold text-xs flex items-center gap-1">Stripe Mockup</span>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground uppercase font-semibold">Email</label>
                  <Input 
                    type="email" 
                    value={stripeCheckoutContract?.client?.email || 'client@example.com'} 
                    disabled 
                    className="bg-black/30 border-white/10 text-sm h-9" 
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground uppercase font-semibold">Card Information</label>
                  <div className="relative">
                    <Input 
                      type="text" 
                      value="4242 •••• •••• 4242" 
                      disabled 
                      className="bg-black/30 border-white/10 text-sm h-9 pr-10 font-mono" 
                    />
                    <CreditCard className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <Input 
                      type="text" 
                      value="12 / 29" 
                      disabled 
                      className="bg-black/30 border-white/10 text-sm h-9 font-mono text-center" 
                    />
                    <Input 
                      type="text" 
                      value="•••" 
                      disabled 
                      className="bg-black/30 border-white/10 text-sm h-9 font-mono text-center" 
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground uppercase font-semibold">Name on Card</label>
                  <Input 
                    type="text" 
                    value={stripeCheckoutContract?.client?.client_name || 'Cardholder Name'} 
                    disabled 
                    className="bg-black/30 border-white/10 text-sm h-9" 
                  />
                </div>
              </div>

              <div className="pt-4 space-y-2">
                <Button 
                  onClick={async () => {
                    if (!stripeCheckoutContract) return;
                    setIsLoading(true);
                    try {
                      const totalVal = stripeCheckoutContract.monthly_retainer * stripeCheckoutContract.duration_months;
                      const { error } = await supabase
                        .from('contracts')
                        .update({
                          payment_status: 'paid',
                          amount_received: totalVal
                        })
                        .eq('id', stripeCheckoutContract.id);

                      if (error) throw error;
                      toast.success('Payment simulated successfully! Retainer marked as Paid.');
                      setStripeCheckoutContract(null);
                      fetchContracts();
                    } catch (err: any) {
                      toast.error('Simulation failed: ' + err.message);
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold h-10 flex items-center justify-center gap-1.5"
                >
                  Pay ₹{stripeCheckoutContract?.monthly_retainer.toLocaleString('en-IN')}
                </Button>
                <p className="text-[10px] text-muted-foreground text-center">
                  By clicking Pay, you agree to authorize a simulated transaction.
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
