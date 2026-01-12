import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { Tables } from '@/integrations/supabase/types';

type ContentCalendarEntry = Tables<'content_calendar'>;
type Client = Tables<'clients'>;

const schema = z.object({
  client_id: z.string().min(1, 'Client is required'),
  post_date: z.string().min(1, 'Date is required'),
  platform: z.string().min(1, 'Platform is required'),
  posting_status: z.enum(['scheduled', 'posted', 'missed']),
  caption_status: z.enum(['pending', 'approved']),
  post_url: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: ContentCalendarEntry | null;
  clients: Client[];
  selectedDate: Date | null;
}

export function CalendarEntryDialog({ open, onOpenChange, entry, clients, selectedDate }: Props) {
  const queryClient = useQueryClient();
  const isEditing = !!entry;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      client_id: '',
      post_date: '',
      platform: 'Instagram',
      posting_status: 'scheduled',
      caption_status: 'pending',
      post_url: '',
    },
  });

  useEffect(() => {
    if (entry) {
      form.reset({
        client_id: entry.client_id,
        post_date: entry.post_date,
        platform: entry.platform,
        posting_status: entry.posting_status,
        caption_status: entry.caption_status,
        post_url: entry.post_url || '',
      });
    } else {
      form.reset({
        client_id: '',
        post_date: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '',
        platform: 'Instagram',
        posting_status: 'scheduled',
        caption_status: 'pending',
        post_url: '',
      });
    }
  }, [entry, selectedDate, form]);

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const { error } = await supabase.from('content_calendar').insert({
        client_id: values.client_id,
        post_date: values.post_date,
        platform: values.platform,
        posting_status: values.posting_status,
        caption_status: values.caption_status,
        post_url: values.post_url || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content_calendar'] });
      toast.success('Post scheduled');
      onOpenChange(false);
    },
    onError: () => toast.error('Failed to schedule post'),
  });

  const updateMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!entry) return;
      const { error } = await supabase.from('content_calendar').update({
        client_id: values.client_id,
        post_date: values.post_date,
        platform: values.platform,
        posting_status: values.posting_status,
        caption_status: values.caption_status,
        post_url: values.post_url || null,
      }).eq('id', entry.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content_calendar'] });
      toast.success('Post updated');
      onOpenChange(false);
    },
    onError: () => toast.error('Failed to update post'),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!entry) return;
      const { error } = await supabase.from('content_calendar').delete().eq('id', entry.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content_calendar'] });
      toast.success('Post deleted');
      onOpenChange(false);
    },
    onError: () => toast.error('Failed to delete post'),
  });

  const onSubmit = (values: FormValues) => {
    isEditing ? updateMutation.mutate(values) : createMutation.mutate(values);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Post' : 'Schedule Post'}</DialogTitle>
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

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="post_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Post Date</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="platform" render={({ field }) => (
                <FormItem>
                  <FormLabel>Platform</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="Instagram">Instagram</SelectItem>
                      <SelectItem value="YouTube">YouTube</SelectItem>
                      <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                      <SelectItem value="TikTok">TikTok</SelectItem>
                      <SelectItem value="Twitter">Twitter</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="posting_status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Posting Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="posted">Posted</SelectItem>
                      <SelectItem value="missed">Missed</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />

              <FormField control={form.control} name="caption_status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Caption Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="post_url" render={({ field }) => (
              <FormItem>
                <FormLabel>Post URL (optional)</FormLabel>
                <FormControl><Input placeholder="https://..." {...field} /></FormControl>
              </FormItem>
            )} />

            <div className="flex justify-between pt-4">
              {isEditing && (
                <Button type="button" variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                </Button>
              )}
              <div className="flex gap-3 ml-auto">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit" disabled={isPending}>{isPending ? 'Saving...' : isEditing ? 'Update' : 'Schedule'}</Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
