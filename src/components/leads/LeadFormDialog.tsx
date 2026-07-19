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
import type { Lead, LeadStatus, BudgetRange, LeadSource, RevenueRange, PrimaryGoal } from '@/types/crm';
import { Loader2 } from 'lucide-react';

const leadFormSchema = z.object({
  full_name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  instagram_link: z.string().optional(),
  youtube_link: z.string().optional(),
  linkedin_link: z.string().optional(),
  niche: z.string().optional(),
  current_followers: z.number().min(0).optional(),
  monthly_revenue: z.enum(['below_50k', '50k_to_2l', '2l_to_5l', 'above_5l']).optional().nullable(),
  primary_goals: z.array(z.enum(['visibility', 'authority', 'monetization'])).optional(),
  budget_range: z.enum(['45k', '75k', '100k_plus']).optional().nullable(),
  lead_source: z.enum(['website', 'instagram', 'referral', 'ads']).optional().nullable(),
  status: z.enum(['new', 'contacted', 'qualified', 'proposal_required', 'disqualified']),
  notes: z.string().optional(),
});

type LeadFormValues = z.infer<typeof leadFormSchema>;

interface LeadFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead | null;
  onSuccess: () => void;
}

const PRIMARY_GOALS: { value: PrimaryGoal; label: string }[] = [
  { value: 'visibility', label: 'Visibility' },
  { value: 'authority', label: 'Authority' },
  { value: 'monetization', label: 'Monetization' },
];

export function LeadFormDialog({
  open,
  onOpenChange,
  lead,
  onSuccess,
}: LeadFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!lead;

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      full_name: '',
      phone: '',
      email: '',
      instagram_link: '',
      youtube_link: '',
      linkedin_link: '',
      niche: '',
      current_followers: 0,
      monthly_revenue: null,
      primary_goals: [],
      budget_range: null,
      lead_source: null,
      status: 'new',
      notes: '',
    },
  });

  useEffect(() => {
    if (lead) {
      form.reset({
        full_name: lead.full_name,
        phone: lead.phone || '',
        email: lead.email || '',
        instagram_link: lead.instagram_link || '',
        youtube_link: lead.youtube_link || '',
        linkedin_link: lead.linkedin_link || '',
        niche: lead.niche || '',
        current_followers: lead.current_followers || 0,
        monthly_revenue: lead.monthly_revenue,
        primary_goals: lead.primary_goals || [],
        budget_range: lead.budget_range,
        lead_source: lead.lead_source,
        status: lead.status as any,
        notes: lead.notes || '',
      });
    } else {
      form.reset({
        full_name: '',
        phone: '',
        email: '',
        instagram_link: '',
        youtube_link: '',
        linkedin_link: '',
        niche: '',
        current_followers: 0,
        monthly_revenue: null,
        primary_goals: [],
        budget_range: null,
        lead_source: null,
        status: 'new',
        notes: '',
      });
    }
  }, [lead, form]);

  const onSubmit = async (values: LeadFormValues) => {
    setIsSubmitting(true);
    try {
      const payload = {
        full_name: values.full_name,
        phone: values.phone || null,
        email: values.email || null,
        instagram_link: values.instagram_link || null,
        youtube_link: values.youtube_link || null,
        linkedin_link: values.linkedin_link || null,
        niche: values.niche || null,
        current_followers: values.current_followers || 0,
        monthly_revenue: values.monthly_revenue || null,
        primary_goals: values.primary_goals || [],
        budget_range: values.budget_range || null,
        lead_source: values.lead_source || null,
        status: values.status,
        notes: values.notes || null,
      };

      if (isEditing && lead) {
        const { error } = await supabase
          .from('leads')
          .update(payload)
          .eq('id', lead.id);
        if (error) throw error;
        toast.success('Lead updated successfully');
      } else {
        const { error } = await supabase
          .from('leads')
          .insert(payload);
        if (error) throw error;
        toast.success('Lead created successfully');
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save lead');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Lead' : 'Add New Lead'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+91 98765 43210" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="john@example.com" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Social Links */}
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="instagram_link"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instagram</FormLabel>
                    <FormControl>
                      <Input placeholder="@username or URL" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="youtube_link"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>YouTube</FormLabel>
                    <FormControl>
                      <Input placeholder="Channel URL" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="linkedin_link"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>LinkedIn</FormLabel>
                    <FormControl>
                      <Input placeholder="Profile URL" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Business Info */}
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="current_followers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Followers</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="10000"
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
                name="monthly_revenue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monthly Revenue</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select range" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="below_50k">Below ₹50K</SelectItem>
                        <SelectItem value="50k_to_2l">₹50K - ₹2L</SelectItem>
                        <SelectItem value="2l_to_5l">₹2L - ₹5L</SelectItem>
                        <SelectItem value="above_5l">Above ₹5L</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="budget_range"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budget Range</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select budget" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="45k">₹45K</SelectItem>
                        <SelectItem value="75k">₹75K</SelectItem>
                        <SelectItem value="100k_plus">₹100K+</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Lead Source and Status */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="lead_source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lead Source</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select source" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="website">Website</SelectItem>
                        <SelectItem value="instagram">Instagram</SelectItem>
                        <SelectItem value="referral">Referral</SelectItem>
                        <SelectItem value="ads">Ads</SelectItem>
                      </SelectContent>
                    </Select>
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
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="contacted">Contacted</SelectItem>
                        <SelectItem value="qualified">Qualified</SelectItem>
                        <SelectItem value="proposal_required">Proposal Required</SelectItem>
                        <SelectItem value="disqualified">Disqualified</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Primary Goals */}
            <FormField
              control={form.control}
              name="primary_goals"
              render={() => (
                <FormItem>
                  <FormLabel>Primary Goals</FormLabel>
                  <div className="flex gap-4">
                    {PRIMARY_GOALS.map((goal) => (
                      <FormField
                        key={goal.value}
                        control={form.control}
                        name="primary_goals"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(goal.value)}
                                onCheckedChange={(checked) => {
                                  const current = field.value || [];
                                  if (checked) {
                                    field.onChange([...current, goal.value]);
                                  } else {
                                    field.onChange(current.filter((v) => v !== goal.value));
                                  }
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              {goal.label}
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

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes about this lead..."
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
                {isEditing ? 'Update Lead' : 'Create Lead'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
