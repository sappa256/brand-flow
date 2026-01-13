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
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Reel, ScriptStatus, EditStatus, BatchType, PriorityType, Profile } from '@/types/crm';
import { Loader2, AlertCircle } from 'lucide-react';
import { useWorkflowValidation } from '@/hooks/useWorkflowValidation';
import { ValidationMessage } from '@/components/shared/ValidationMessage';

const reelFormSchema = z.object({
  client_id: z.string().min(1, 'Client is required'),
  month_number: z.number().min(1, 'Month number is required'),
  reel_number: z.number().min(1, 'Reel number is required'),
  script_status: z.enum(['pending', 'approved']),
  edit_status: z.enum(['not_started', 'editing', 'ready_for_review', 'approved']),
  editor_id: z.string().nullable(),
  batch: z.enum(['batch_1', 'batch_2']).nullable(),
  priority: z.enum(['high', 'normal']).nullable(),
  notes: z.string().optional(),
});

type ReelFormValues = z.infer<typeof reelFormSchema>;

interface Client {
  id: string;
  client_name: string;
}

interface ReelFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reel?: Reel | null;
  clients: Client[];
  onSuccess: () => void;
}

export function ReelFormDialog({
  open,
  onOpenChange,
  reel,
  clients,
  onSuccess,
}: ReelFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editors, setEditors] = useState<Profile[]>([]);
  const [shootCompleted, setShootCompleted] = useState<boolean | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const isEditing = !!reel;
  const { canReelMoveToEditing } = useWorkflowValidation();

  const form = useForm<ReelFormValues>({
    resolver: zodResolver(reelFormSchema),
    defaultValues: {
      client_id: '',
      month_number: 1,
      reel_number: 1,
      script_status: 'pending',
      edit_status: 'not_started',
      editor_id: null,
      batch: 'batch_1',
      priority: 'normal',
      notes: '',
    },
  });

  useEffect(() => {
    fetchEditors();
  }, []);

  useEffect(() => {
    if (reel) {
      form.reset({
        client_id: reel.client_id,
        month_number: reel.month_number,
        reel_number: reel.reel_number,
        script_status: reel.script_status,
        edit_status: reel.edit_status,
        editor_id: reel.editor_id,
        batch: reel.batch,
        priority: reel.priority,
        notes: reel.notes || '',
      });
    } else {
      form.reset({
        client_id: '',
        month_number: 1,
        reel_number: 1,
        script_status: 'pending',
        edit_status: 'not_started',
        editor_id: null,
        batch: 'batch_1',
        priority: 'normal',
        notes: '',
      });
    }
  }, [reel, form]);

  const fetchEditors = async () => {
    // Get users with editor role
    const { data: editorRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'editor');

    if (editorRoles && editorRoles.length > 0) {
      const editorIds = editorRoles.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', editorIds);

      if (profiles) {
        setEditors(profiles as Profile[]);
      }
    }
  };

  // Check shoot status when client/month changes
  const watchClientId = form.watch('client_id');
  const watchMonthNumber = form.watch('month_number');
  const watchEditStatus = form.watch('edit_status');

  useEffect(() => {
    const checkShootStatus = async () => {
      if (watchClientId && watchMonthNumber) {
        const canEdit = await canReelMoveToEditing(watchClientId, watchMonthNumber);
        setShootCompleted(canEdit);
        
        if (!canEdit && watchEditStatus !== 'not_started') {
          setValidationError('Shoot must be completed before editing can begin');
        } else {
          setValidationError(null);
        }
      }
    };
    checkShootStatus();
  }, [watchClientId, watchMonthNumber, watchEditStatus, canReelMoveToEditing]);

  const onSubmit = async (values: ReelFormValues) => {
    setIsSubmitting(true);
    setValidationError(null);
    
    try {
      // Validate edit status transition
      if (values.edit_status !== 'not_started') {
        const canEdit = await canReelMoveToEditing(values.client_id, values.month_number);
        if (!canEdit) {
          setValidationError('Cannot set edit status: Shoot must be completed first');
          setIsSubmitting(false);
          return;
        }
      }

      const payload = {
        client_id: values.client_id,
        month_number: values.month_number,
        reel_number: values.reel_number,
        script_status: values.script_status,
        edit_status: values.edit_status,
        editor_id: values.editor_id,
        batch: values.batch,
        priority: values.priority,
        notes: values.notes || null,
      };

      if (isEditing && reel) {
        const { error } = await supabase
          .from('reels')
          .update(payload)
          .eq('id', reel.id);
        if (error) throw error;
        toast.success('Reel updated successfully');
      } else {
        const { error } = await supabase.from('reels').insert(payload);
        if (error) throw error;
        toast.success('Reel created successfully');
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save reel');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Reel' : 'Add New Reel'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Client */}
            <FormField
              control={form.control}
              name="client_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client *</FormLabel>
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

            {/* Month and Reel Number */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="month_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Month Number *</FormLabel>
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

              <FormField
                control={form.control}
                name="reel_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reel Number *</FormLabel>
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

            {/* Script and Edit Status */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="script_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Script Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="edit_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Edit Status</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="not_started">Not Started</SelectItem>
                        <SelectItem 
                          value="editing" 
                          disabled={shootCompleted === false}
                        >
                          Editing {shootCompleted === false && '(Shoot Required)'}
                        </SelectItem>
                        <SelectItem 
                          value="ready_for_review"
                          disabled={shootCompleted === false}
                        >
                          Ready for Review {shootCompleted === false && '(Shoot Required)'}
                        </SelectItem>
                        <SelectItem 
                          value="approved"
                          disabled={shootCompleted === false}
                        >
                          Approved {shootCompleted === false && '(Shoot Required)'}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {validationError && (
              <ValidationMessage message={validationError} type="error" />
            )}

            {shootCompleted === false && (
              <ValidationMessage 
                message="Shoot must be completed before this reel can be edited" 
                type="warning" 
              />
            )}

            {/* Editor */}
            <FormField
              control={form.control}
              name="editor_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assigned Editor</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
                    value={field.value || 'none'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select editor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {editors.map((editor) => (
                        <SelectItem key={editor.id} value={editor.id}>
                          {editor.full_name || editor.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Batch and Priority */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="batch"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Batch</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
                      value={field.value || 'none'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select batch" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No Batch</SelectItem>
                        <SelectItem value="batch_1">Batch 1</SelectItem>
                        <SelectItem value="batch_2">Batch 2</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
                      value={field.value || 'none'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No Priority</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add notes about this reel..."
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
                {isEditing ? 'Update Reel' : 'Create Reel'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
