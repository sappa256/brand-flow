import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Contract, Client, ContractStatus, PaymentStatus, RenewalProbability } from '@/types/crm';
import { Loader2 } from 'lucide-react';

const contractFormSchema = z.object({
  client_id: z.string().min(1, 'Client is required'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  duration_months: z.number().min(1, 'Duration must be at least 1 month'),
  monthly_retainer: z.number().min(0, 'Monthly retainer must be positive'),
  contract_status: z.enum(['active', 'ending_soon', 'renewed', 'closed']),
  payment_status: z.enum(['paid', 'pending', 'overdue']),
  renewal_probability: z.enum(['high', 'medium', 'low']).optional().nullable(),
});

type ContractFormValues = z.infer<typeof contractFormSchema>;

interface ContractFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract?: Contract | null;
  onSuccess: () => void;
}

export function ContractFormDialog({
  open,
  onOpenChange,
  contract,
  onSuccess,
}: ContractFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const isEditing = !!contract;

  const form = useForm<ContractFormValues>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: {
      client_id: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      duration_months: 6,
      monthly_retainer: 0,
      contract_status: 'active',
      payment_status: 'pending',
      renewal_probability: 'medium',
    },
  });

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (contract) {
      form.reset({
        client_id: contract.client_id,
        start_date: contract.start_date,
        end_date: contract.end_date,
        duration_months: contract.duration_months,
        monthly_retainer: contract.monthly_retainer,
        contract_status: contract.contract_status,
        payment_status: contract.payment_status,
        renewal_probability: contract.renewal_probability,
      });
    } else {
      form.reset({
        client_id: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        duration_months: 6,
        monthly_retainer: 0,
        contract_status: 'active',
        payment_status: 'pending',
        renewal_probability: 'medium',
      });
    }
  }, [contract, form]);

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('status', 'active')
      .order('client_name');

    if (!error && data) {
      setClients(data as Client[]);
    }
  };

  // Auto-calculate end date when start date or duration changes
  const watchStartDate = form.watch('start_date');
  const watchDuration = form.watch('duration_months');

  useEffect(() => {
    if (watchStartDate && watchDuration) {
      const startDate = new Date(watchStartDate);
      startDate.setMonth(startDate.getMonth() + watchDuration);
      form.setValue('end_date', startDate.toISOString().split('T')[0]);
    }
  }, [watchStartDate, watchDuration, form]);

  const onSubmit = async (values: ContractFormValues) => {
    setIsSubmitting(true);
    try {
      const payload = {
        client_id: values.client_id,
        start_date: values.start_date,
        end_date: values.end_date,
        duration_months: values.duration_months,
        monthly_retainer: values.monthly_retainer,
        contract_status: values.contract_status as ContractStatus,
        payment_status: values.payment_status as PaymentStatus,
        renewal_probability: values.renewal_probability as RenewalProbability | null,
      };

      if (isEditing && contract) {
        const { error } = await supabase
          .from('contracts')
          .update(payload)
          .eq('id', contract.id);
        if (error) throw error;
        toast.success('Contract updated successfully');
      } else {
        const { error } = await supabase
          .from('contracts')
          .insert(payload);
        if (error) throw error;
        toast.success('Contract created successfully');
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save contract');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Contract' : 'Add New Contract'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Client Selection */}
            <FormField
              control={form.control}
              name="client_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a client" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.client_name}
                          {client.brand_name && ` (${client.brand_name})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Dates and Duration */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="duration_months"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (months) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="end_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End Date (auto-calculated)</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} disabled />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Financials */}
            <FormField
              control={form.control}
              name="monthly_retainer"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monthly Retainer (₹) *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      placeholder="45000"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Status Fields */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contract_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contract Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="ending_soon">Ending Soon</SelectItem>
                        <SelectItem value="renewed">Renewed</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="payment_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="renewal_probability"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Renewal Probability</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select probability" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? 'Update Contract' : 'Create Contract'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
