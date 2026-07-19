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
import type { Client, PlanType, ClientStatus } from '@/types/crm';
import { Loader2 } from 'lucide-react';

const clientFormSchema = z.object({
  client_name: z.string().min(1, 'Client name is required'),
  brand_name: z.string().optional(),
  niche: z.string().optional(),
  plan_type: z.enum(['essential', 'accelerator', 'dominator']),
  platforms_managed: z.array(z.string()).optional(),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().optional(),
  status: z.enum(['active', 'paused', 'at_risk', 'completed']),
  notes: z.string().optional(),
});

type ClientFormValues = z.infer<typeof clientFormSchema>;

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
  onSuccess: () => void;
}

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'twitter', label: 'Twitter' },
  { value: 'facebook', label: 'Facebook' },
];

export function ClientFormDialog({
  open,
  onOpenChange,
  client,
  onSuccess,
}: ClientFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!client;

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      client_name: '',
      brand_name: '',
      niche: '',
      plan_type: 'essential',
      platforms_managed: [],
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      status: 'active',
      notes: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (client) {
        form.reset({
          client_name: client.client_name,
          brand_name: client.brand_name || '',
          niche: client.niche || '',
          plan_type: client.plan_type,
          platforms_managed: client.platforms_managed || [],
          start_date: client.start_date,
          end_date: client.end_date || '',
          status: client.status,
          notes: client.notes || '',
        });
      } else {
        form.reset({
          client_name: '',
          brand_name: '',
          niche: '',
          plan_type: 'essential',
          platforms_managed: [],
          start_date: new Date().toISOString().split('T')[0],
          end_date: '',
          status: 'active',
          notes: '',
        });
      }
    }
  }, [open, client, form]);

  const onSubmit = async (values: ClientFormValues) => {
    setIsSubmitting(true);
    try {
      const payload = {
        client_name: values.client_name,
        brand_name: values.brand_name || null,
        niche: values.niche || null,
        plan_type: values.plan_type as PlanType,
        platforms_managed: values.platforms_managed || [],
        start_date: values.start_date,
        end_date: values.end_date || null,
        status: values.status as ClientStatus,
        notes: values.notes || null,
      };

      if (isEditing && client) {
        const { error } = await supabase
          .from('clients')
          .update(payload)
          .eq('id', client.id);
        if (error) throw error;
        toast.success('Client updated successfully');
      } else {
        const { error } = await supabase
          .from('clients')
          .insert(payload);
        if (error) throw error;
        toast.success('Client created successfully');
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save client');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Client' : 'Add New Client'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="client_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="brand_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Brand Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Brand Inc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="niche"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Niche</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Fitness, Finance" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="plan_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plan Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select plan" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="essential">Essential</SelectItem>
                        <SelectItem value="accelerator">Accelerator</SelectItem>
                        <SelectItem value="dominator">Dominator</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Dates */}
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
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="at_risk">At Risk</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Platforms */}
            <FormField
              control={form.control}
              name="platforms_managed"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Platforms Managed</FormLabel>
                  <div className="flex gap-4 flex-wrap">
                    {PLATFORMS.map((platform) => (
                      <div key={platform.value} className="flex items-center space-x-2 space-y-0">
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
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes about this client..."
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
                {isEditing ? 'Update Client' : 'Create Client'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
