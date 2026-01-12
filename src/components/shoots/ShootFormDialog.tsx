import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type Shoot = Tables<'shoots'>;
type Client = Tables<'clients'>;

const shootSchema = z.object({
  client_id: z.string().min(1, 'Client is required'),
  month_number: z.coerce.number().min(1, 'Month number is required'),
  location: z.string().optional(),
  reels_planned: z.coerce.number().min(0).optional(),
  shoot_day_1: z.string().optional(),
  shoot_day_2: z.string().optional(),
  shoot_day_3: z.string().optional(),
  status: z.enum(['not_scheduled', 'dates_fixed', 'completed', 'pending_client']),
});

type ShootFormValues = z.infer<typeof shootSchema>;

interface ShootFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shoot: Shoot | null;
  clients: Client[];
}

export function ShootFormDialog({ open, onOpenChange, shoot, clients }: ShootFormDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!shoot;

  const form = useForm<ShootFormValues>({
    resolver: zodResolver(shootSchema),
    defaultValues: {
      client_id: '',
      month_number: 1,
      location: '',
      reels_planned: 8,
      shoot_day_1: '',
      shoot_day_2: '',
      shoot_day_3: '',
      status: 'not_scheduled',
    },
  });

  useEffect(() => {
    if (shoot) {
      form.reset({
        client_id: shoot.client_id,
        month_number: shoot.month_number,
        location: shoot.location || '',
        reels_planned: shoot.reels_planned || 8,
        shoot_day_1: shoot.shoot_day_1 || '',
        shoot_day_2: shoot.shoot_day_2 || '',
        shoot_day_3: shoot.shoot_day_3 || '',
        status: shoot.status,
      });
    } else {
      form.reset({
        client_id: '',
        month_number: 1,
        location: '',
        reels_planned: 8,
        shoot_day_1: '',
        shoot_day_2: '',
        shoot_day_3: '',
        status: 'not_scheduled',
      });
    }
  }, [shoot, form]);

  const createMutation = useMutation({
    mutationFn: async (values: ShootFormValues) => {
      const { error } = await supabase.from('shoots').insert({
        client_id: values.client_id,
        month_number: values.month_number,
        location: values.location || null,
        reels_planned: values.reels_planned || 8,
        shoot_day_1: values.shoot_day_1 || null,
        shoot_day_2: values.shoot_day_2 || null,
        shoot_day_3: values.shoot_day_3 || null,
        status: values.status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shoots'] });
      toast.success('Shoot scheduled successfully');
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Failed to schedule shoot');
      console.error(error);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: ShootFormValues) => {
      if (!shoot) return;
      const { error } = await supabase
        .from('shoots')
        .update({
          client_id: values.client_id,
          month_number: values.month_number,
          location: values.location || null,
          reels_planned: values.reels_planned || 8,
          shoot_day_1: values.shoot_day_1 || null,
          shoot_day_2: values.shoot_day_2 || null,
          shoot_day_3: values.shoot_day_3 || null,
          status: values.status,
        })
        .eq('id', shoot.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shoots'] });
      toast.success('Shoot updated successfully');
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Failed to update shoot');
      console.error(error);
    },
  });

  const onSubmit = (values: ShootFormValues) => {
    if (isEditing) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Shoot' : 'Schedule Shoot'}</DialogTitle>
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
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select client" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.client_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="month_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Month #</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reels_planned"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reels Planned</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input placeholder="Shoot location" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="not_scheduled">Not Scheduled</SelectItem>
                      <SelectItem value="pending_client">Pending Client</SelectItem>
                      <SelectItem value="dates_fixed">Dates Fixed</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <FormLabel>Shoot Days</FormLabel>
              <div className="grid grid-cols-3 gap-2">
                <FormField
                  control={form.control}
                  name="shoot_day_1"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="shoot_day_2"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="shoot_day_3"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : isEditing ? 'Update' : 'Schedule'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
