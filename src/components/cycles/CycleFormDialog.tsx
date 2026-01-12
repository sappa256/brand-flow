import { useEffect } from 'react';
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
import type { Tables } from '@/integrations/supabase/types';

type MonthlyCycle = Tables<'monthly_cycles'>;
type Client = Tables<'clients'>;

const schema = z.object({
  client_id: z.string().min(1, 'Client is required'),
  month_number: z.coerce.number().min(1),
  reels_planned: z.coerce.number().min(0).optional(),
  reels_shot: z.coerce.number().min(0).optional(),
  reels_edited: z.coerce.number().min(0).optional(),
  reels_posted: z.coerce.number().min(0).optional(),
  status: z.enum(['planned', 'in_production', 'publishing_live', 'completed']),
  client_satisfaction: z.enum(['happy', 'neutral', 'risk']).optional().nullable(),
  issues_faced: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cycle: MonthlyCycle | null;
  clients: Client[];
}

export function CycleFormDialog({ open, onOpenChange, cycle, clients }: Props) {
  const queryClient = useQueryClient();
  const isEditing = !!cycle;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      client_id: '',
      month_number: 1,
      reels_planned: 8,
      reels_shot: 0,
      reels_edited: 0,
      reels_posted: 0,
      status: 'planned',
      client_satisfaction: 'neutral',
      issues_faced: '',
    },
  });

  useEffect(() => {
    if (cycle) {
      form.reset({
        client_id: cycle.client_id,
        month_number: cycle.month_number,
        reels_planned: cycle.reels_planned || 0,
        reels_shot: cycle.reels_shot || 0,
        reels_edited: cycle.reels_edited || 0,
        reels_posted: cycle.reels_posted || 0,
        status: cycle.status,
        client_satisfaction: cycle.client_satisfaction,
        issues_faced: cycle.issues_faced || '',
      });
    } else {
      form.reset({
        client_id: '',
        month_number: 1,
        reels_planned: 8,
        reels_shot: 0,
        reels_edited: 0,
        reels_posted: 0,
        status: 'planned',
        client_satisfaction: 'neutral',
        issues_faced: '',
      });
    }
  }, [cycle, form]);

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const { error } = await supabase.from('monthly_cycles').insert({
        client_id: values.client_id,
        month_number: values.month_number,
        reels_planned: values.reels_planned,
        reels_shot: values.reels_shot,
        reels_edited: values.reels_edited,
        reels_posted: values.reels_posted,
        status: values.status,
        client_satisfaction: values.client_satisfaction,
        issues_faced: values.issues_faced || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly_cycles'] });
      toast.success('Cycle created');
      onOpenChange(false);
    },
    onError: () => toast.error('Failed to create cycle'),
  });

  const updateMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!cycle) return;
      const { error } = await supabase.from('monthly_cycles').update({
        client_id: values.client_id,
        month_number: values.month_number,
        reels_planned: values.reels_planned,
        reels_shot: values.reels_shot,
        reels_edited: values.reels_edited,
        reels_posted: values.reels_posted,
        status: values.status,
        client_satisfaction: values.client_satisfaction,
        issues_faced: values.issues_faced || null,
      }).eq('id', cycle.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly_cycles'] });
      toast.success('Cycle updated');
      onOpenChange(false);
    },
    onError: () => toast.error('Failed to update cycle'),
  });

  const onSubmit = (values: FormValues) => {
    isEditing ? updateMutation.mutate(values) : createMutation.mutate(values);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Cycle' : 'New Monthly Cycle'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="client_id" render={({ field }) => (
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
            )} />

            <FormField control={form.control} name="month_number" render={({ field }) => (
              <FormItem>
                <FormLabel>Month Number</FormLabel>
                <FormControl><Input type="number" min={1} {...field} /></FormControl>
              </FormItem>
            )} />

            <div className="grid grid-cols-4 gap-2">
              <FormField control={form.control} name="reels_planned" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Planned</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="reels_shot" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Shot</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="reels_edited" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Edited</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="reels_posted" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Posted</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="planned">Planned</SelectItem>
                      <SelectItem value="in_production">In Production</SelectItem>
                      <SelectItem value="publishing_live">Publishing</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />

              <FormField control={form.control} name="client_satisfaction" render={({ field }) => (
                <FormItem>
                  <FormLabel>Satisfaction</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="happy">Happy 😊</SelectItem>
                      <SelectItem value="neutral">Neutral 😐</SelectItem>
                      <SelectItem value="risk">At Risk 😟</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="issues_faced" render={({ field }) => (
              <FormItem>
                <FormLabel>Issues Faced</FormLabel>
                <FormControl><Textarea rows={2} placeholder="Any blockers or issues..." {...field} /></FormControl>
              </FormItem>
            )} />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending ? 'Saving...' : isEditing ? 'Update' : 'Create'}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
