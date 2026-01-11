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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Proposal, Lead, PlanType } from '@/types/crm';
import { Loader2 } from 'lucide-react';

const proposalFormSchema = z.object({
  lead_id: z.string().min(1, 'Lead is required'),
  client_name: z.string().min(1, 'Client name is required'),
  plan_type: z.enum(['essential', 'accelerator', 'dominator']),
  reels_per_month: z.number().min(1).max(30),
  platforms: z.array(z.string()).min(1, 'Select at least one platform'),
  shoot_days_per_month: z.number().min(1).max(10),
  monthly_fee: z.number().min(1, 'Monthly fee is required'),
  contract_duration_months: z.number().min(1).max(24),
  status: z.enum(['draft', 'sent', 'accepted', 'rejected']),
  internal_notes: z.string().optional(),
});

type ProposalFormValues = z.infer<typeof proposalFormSchema>;

interface ProposalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal?: Proposal | null;
  preselectedLead?: Lead | null;
  onSuccess: () => void;
}

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'tiktok', label: 'TikTok' },
];

const PLAN_DEFAULTS: Record<PlanType, { reels: number; shoots: number; fee: number }> = {
  essential: { reels: 8, shoots: 2, fee: 45000 },
  accelerator: { reels: 12, shoots: 3, fee: 75000 },
  dominator: { reels: 20, shoots: 4, fee: 100000 },
};

export function ProposalFormDialog({
  open,
  onOpenChange,
  proposal,
  preselectedLead,
  onSuccess,
}: ProposalFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const isEditing = !!proposal;

  const form = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalFormSchema),
    defaultValues: {
      lead_id: '',
      client_name: '',
      plan_type: 'essential',
      reels_per_month: 8,
      platforms: ['instagram'],
      shoot_days_per_month: 2,
      monthly_fee: 45000,
      contract_duration_months: 6,
      status: 'draft',
      internal_notes: '',
    },
  });

  useEffect(() => {
    fetchLeads();
  }, []);

  useEffect(() => {
    if (proposal) {
      form.reset({
        lead_id: proposal.lead_id,
        client_name: proposal.client_name,
        plan_type: proposal.plan_type,
        reels_per_month: proposal.reels_per_month,
        platforms: proposal.platforms || ['instagram'],
        shoot_days_per_month: proposal.shoot_days_per_month,
        monthly_fee: proposal.monthly_fee,
        contract_duration_months: proposal.contract_duration_months,
        status: proposal.status,
        internal_notes: proposal.internal_notes || '',
      });
    } else if (preselectedLead) {
      form.reset({
        lead_id: preselectedLead.id,
        client_name: preselectedLead.full_name,
        plan_type: 'essential',
        reels_per_month: 8,
        platforms: ['instagram'],
        shoot_days_per_month: 2,
        monthly_fee: 45000,
        contract_duration_months: 6,
        status: 'draft',
        internal_notes: '',
      });
    }
  }, [proposal, preselectedLead, form]);

  const fetchLeads = async () => {
    const { data } = await supabase
      .from('leads')
      .select('*')
      .in('status', ['qualified', 'proposal_required'])
      .order('full_name');
    if (data) setLeads(data as Lead[]);
  };

  const handlePlanChange = (planType: PlanType) => {
    const defaults = PLAN_DEFAULTS[planType];
    form.setValue('plan_type', planType);
    form.setValue('reels_per_month', defaults.reels);
    form.setValue('shoot_days_per_month', defaults.shoots);
    form.setValue('monthly_fee', defaults.fee);
  };

  const onSubmit = async (values: ProposalFormValues) => {
    setIsSubmitting(true);
    try {
      const payload = {
        lead_id: values.lead_id,
        client_name: values.client_name,
        plan_type: values.plan_type,
        reels_per_month: values.reels_per_month,
        platforms: values.platforms,
        shoot_days_per_month: values.shoot_days_per_month,
        monthly_fee: values.monthly_fee,
        contract_duration_months: values.contract_duration_months,
        status: values.status,
        internal_notes: values.internal_notes || null,
        sent_date: values.status === 'sent' ? new Date().toISOString().split('T')[0] : null,
        accepted_date: values.status === 'accepted' ? new Date().toISOString().split('T')[0] : null,
      };

      if (isEditing && proposal) {
        const { error } = await supabase
          .from('proposals')
          .update(payload)
          .eq('id', proposal.id);
        if (error) throw error;
        toast.success('Proposal updated successfully');
      } else {
        const { error } = await supabase
          .from('proposals')
          .insert(payload);
        if (error) throw error;
        toast.success('Proposal created successfully');
      }

      // If proposal is accepted, create client and contract
      if (values.status === 'accepted') {
        await createClientAndContract(values);
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save proposal');
    } finally {
      setIsSubmitting(false);
    }
  };

  const createClientAndContract = async (values: ProposalFormValues) => {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + values.contract_duration_months);

    // Create client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .insert({
        client_name: values.client_name,
        lead_id: values.lead_id,
        plan_type: values.plan_type,
        platforms_managed: values.platforms,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        status: 'active',
      })
      .select()
      .single();

    if (clientError) {
      console.error('Failed to create client:', clientError);
      return;
    }

    // Create contract
    const { error: contractError } = await supabase
      .from('contracts')
      .insert({
        client_id: client.id,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        duration_months: values.contract_duration_months,
        monthly_retainer: values.monthly_fee,
        payment_status: 'pending',
        contract_status: 'active',
      });

    if (contractError) {
      console.error('Failed to create contract:', contractError);
      return;
    }

    // Update lead status
    await supabase
      .from('leads')
      .update({ status: 'qualified' })
      .eq('id', values.lead_id);

    toast.success('Client and Contract created automatically!');
  };

  const totalContractValue = form.watch('monthly_fee') * form.watch('contract_duration_months');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Proposal' : 'Create Proposal'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Lead Selection */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="lead_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lead *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select lead" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {leads.map((lead) => (
                          <SelectItem key={lead.id} value={lead.id}>
                            {lead.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="client_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client/Brand Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Brand name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Plan Type */}
            <FormField
              control={form.control}
              name="plan_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plan Type *</FormLabel>
                  <Select onValueChange={handlePlanChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select plan" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="essential">Essential (₹45K/mo)</SelectItem>
                      <SelectItem value="accelerator">Accelerator (₹75K/mo)</SelectItem>
                      <SelectItem value="dominator">Dominator (₹100K+/mo)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Platforms */}
            <FormField
              control={form.control}
              name="platforms"
              render={() => (
                <FormItem>
                  <FormLabel>Platforms *</FormLabel>
                  <div className="flex gap-4">
                    {PLATFORMS.map((platform) => (
                      <FormField
                        key={platform.value}
                        control={form.control}
                        name="platforms"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(platform.value)}
                                onCheckedChange={(checked) => {
                                  const current = field.value || [];
                                  if (checked) {
                                    field.onChange([...current, platform.value]);
                                  } else {
                                    field.onChange(current.filter((v) => v !== platform.value));
                                  }
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              {platform.label}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Deliverables */}
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="reels_per_month"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reels/Month</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shoot_days_per_month"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shoot Days/Month</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contract_duration_months"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contract Duration (months)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="monthly_fee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monthly Fee (₹)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-end">
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 w-full">
                  <p className="text-xs text-muted-foreground">Total Contract Value</p>
                  <p className="text-lg font-bold text-primary">
                    ₹{totalContractValue.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            </div>

            {/* Status */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="accepted">Accepted</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="internal_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Internal Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Notes about this proposal..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
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
                {isEditing ? 'Update Proposal' : 'Create Proposal'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
