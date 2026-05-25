import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import { AiAssistantPanel } from '@/components/shared/AiAssistantPanel';
import type { Tables } from '@/integrations/supabase/types';

type Strategy = Tables<'strategies'>;
type Client = Tables<'clients'>;

const schema = z.object({
  client_id: z.string().min(1, 'Client is required'),
  month_number: z.coerce.number().min(1),
  monthly_reel_target: z.coerce.number().min(0).optional(),
  shoot_days_required: z.coerce.number().min(0).optional(),
  platform_priority: z.string().optional(),
  content_pillars: z.string().optional(),
  brand_positioning_summary: z.string().optional(),
  client_availability_notes: z.string().optional(),
  status: z.enum(['pending', 'strategy_call_done', 'approved']),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  strategy: Strategy | null;
  clients: Client[];
}

export function StrategyFormDialog({ open, onOpenChange, strategy, clients }: Props) {
  const queryClient = useQueryClient();
  const isEditing = !!strategy;
  const [isAiOpen, setIsAiOpen] = useState(false);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      client_id: '',
      month_number: 1,
      monthly_reel_target: 8,
      shoot_days_required: 2,
      platform_priority: '',
      content_pillars: '',
      brand_positioning_summary: '',
      client_availability_notes: '',
      status: 'pending',
    },
  });

  useEffect(() => {
    if (strategy) {
      form.reset({
        client_id: strategy.client_id,
        month_number: strategy.month_number,
        monthly_reel_target: strategy.monthly_reel_target || 8,
        shoot_days_required: strategy.shoot_days_required || 2,
        platform_priority: strategy.platform_priority || '',
        content_pillars: strategy.content_pillars?.join(', ') || '',
        brand_positioning_summary: strategy.brand_positioning_summary || '',
        client_availability_notes: strategy.client_availability_notes || '',
        status: strategy.status,
      });
    } else {
      form.reset({
        client_id: '',
        month_number: 1,
        monthly_reel_target: 8,
        shoot_days_required: 2,
        platform_priority: '',
        content_pillars: '',
        brand_positioning_summary: '',
        client_availability_notes: '',
        status: 'pending',
      });
    }
  }, [strategy, form]);

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const pillars = values.content_pillars?.split(',').map(p => p.trim()).filter(Boolean) || [];
      const { error } = await supabase.from('strategies').insert({
        client_id: values.client_id,
        month_number: values.month_number,
        monthly_reel_target: values.monthly_reel_target,
        shoot_days_required: values.shoot_days_required,
        platform_priority: values.platform_priority || null,
        content_pillars: pillars,
        brand_positioning_summary: values.brand_positioning_summary || null,
        client_availability_notes: values.client_availability_notes || null,
        status: values.status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategies'] });
      toast.success('Strategy created');
      onOpenChange(false);
    },
    onError: () => toast.error('Failed to create strategy'),
  });

  const updateMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!strategy) return;
      const pillars = values.content_pillars?.split(',').map(p => p.trim()).filter(Boolean) || [];
      const { error } = await supabase.from('strategies').update({
        client_id: values.client_id,
        month_number: values.month_number,
        monthly_reel_target: values.monthly_reel_target,
        shoot_days_required: values.shoot_days_required,
        platform_priority: values.platform_priority || null,
        content_pillars: pillars,
        brand_positioning_summary: values.brand_positioning_summary || null,
        client_availability_notes: values.client_availability_notes || null,
        status: values.status,
      }).eq('id', strategy.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategies'] });
      toast.success('Strategy updated');
      onOpenChange(false);
    },
    onError: () => toast.error('Failed to update strategy'),
  });

  const onSubmit = (values: FormValues) => {
    isEditing ? updateMutation.mutate(values) : createMutation.mutate(values);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Strategy' : 'New Strategy'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="client_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.client_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="month_number" render={({ field }) => (
                <FormItem>
                  <FormLabel>Month #</FormLabel>
                  <FormControl><Input type="number" min={1} {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="monthly_reel_target" render={({ field }) => (
                <FormItem>
                  <FormLabel>Reel Target</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="shoot_days_required" render={({ field }) => (
                <FormItem>
                  <FormLabel>Shoot Days</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="platform_priority" render={({ field }) => (
              <FormItem>
                <FormLabel>Platform Priority</FormLabel>
                <FormControl><Input placeholder="e.g., Instagram, YouTube" {...field} /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="content_pillars" render={({ field }) => (
              <FormItem>
                <FormLabel>Content Pillars (comma-separated)</FormLabel>
                <FormControl><Input placeholder="Education, Behind the Scenes, Tips" {...field} /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="brand_positioning_summary" render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Brand Positioning Summary</FormLabel>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAiOpen(true)}
                    className="text-purple-400 hover:text-purple-300 hover:bg-purple-900/20 text-xs gap-1.5 h-7 px-2 border border-purple-500/20"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    AI Assistant
                  </Button>
                </div>
                <FormControl><Textarea rows={3} placeholder="Describe the target audience, tone of voice, content style, etc." {...field} /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="client_availability_notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Client Availability Notes</FormLabel>
                <FormControl><Textarea rows={2} {...field} /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="status" render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="strategy_call_done">Strategy Call Done</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending ? 'Saving...' : isEditing ? 'Update' : 'Create'}</Button>
            </div>
          </form>
        </Form>
        
        <AiAssistantPanel
          isOpen={isAiOpen}
          onClose={() => setIsAiOpen(false)}
          onSelectContent={(text) => {
            const currentVal = form.getValues('brand_positioning_summary') || '';
            const newVal = currentVal ? `${currentVal}\n\n${text}` : text;
            form.setValue('brand_positioning_summary', newVal, { shouldDirty: true });
          }}
          initialNiche={clients.find(c => c.id === form.watch('client_id'))?.client_name || ''}
          initialTopic=""
        />
      </DialogContent>
    </Dialog>
  );
}
