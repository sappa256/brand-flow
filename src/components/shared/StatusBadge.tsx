import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusConfig {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';
}

const statusConfigs: Record<string, StatusConfig> = {
  // Lead statuses
  new: { label: 'New', variant: 'info' },
  contacted: { label: 'Contacted', variant: 'secondary' },
  qualified: { label: 'Qualified', variant: 'success' },
  proposal_required: { label: 'Proposal Required', variant: 'warning' },
  disqualified: { label: 'Disqualified', variant: 'destructive' },

  // Proposal statuses
  draft: { label: 'Draft', variant: 'secondary' },
  sent: { label: 'Sent', variant: 'info' },
  accepted: { label: 'Accepted', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'destructive' },

  // Client statuses
  active: { label: 'Active', variant: 'success' },
  paused: { label: 'Paused', variant: 'warning' },
  at_risk: { label: 'At Risk', variant: 'destructive' },
  completed: { label: 'Completed', variant: 'secondary' },

  // Contract statuses
  ending_soon: { label: 'Ending Soon', variant: 'warning' },
  renewed: { label: 'Renewed', variant: 'success' },
  closed: { label: 'Closed', variant: 'secondary' },

  // Payment statuses
  paid: { label: 'Paid', variant: 'success' },
  pending: { label: 'Pending', variant: 'warning' },
  overdue: { label: 'Overdue', variant: 'destructive' },

  // Strategy statuses
  strategy_call_done: { label: 'Call Done', variant: 'info' },
  approved: { label: 'Approved', variant: 'success' },

  // Shoot statuses
  not_scheduled: { label: 'Not Scheduled', variant: 'secondary' },
  dates_fixed: { label: 'Dates Fixed', variant: 'info' },
  pending_client: { label: 'Pending Client', variant: 'warning' },

  // Edit statuses
  not_started: { label: 'Not Started', variant: 'secondary' },
  editing: { label: 'Editing', variant: 'info' },
  ready_for_review: { label: 'Ready for Review', variant: 'warning' },

  // Posting statuses
  scheduled: { label: 'Scheduled', variant: 'info' },
  posted: { label: 'Posted', variant: 'success' },
  missed: { label: 'Missed', variant: 'destructive' },

  // Cycle statuses
  planned: { label: 'Planned', variant: 'secondary' },
  in_production: { label: 'In Production', variant: 'info' },
  publishing_live: { label: 'Publishing Live', variant: 'warning' },

  // Satisfaction
  happy: { label: 'Happy', variant: 'success' },
  neutral: { label: 'Neutral', variant: 'secondary' },
  risk: { label: 'Risk', variant: 'destructive' },

  // Priority
  high: { label: 'High', variant: 'destructive' },
  normal: { label: 'Normal', variant: 'secondary' },

  // Renewal probability
  medium: { label: 'Medium', variant: 'warning' },
  low: { label: 'Low', variant: 'destructive' },
};

const variantStyles: Record<string, string> = {
  success: 'bg-success/10 text-success hover:bg-success/20 border-success/20',
  warning: 'bg-warning/10 text-warning hover:bg-warning/20 border-warning/20',
  info: 'bg-info/10 text-info hover:bg-info/20 border-info/20',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfigs[status] || { label: status, variant: 'secondary' as const };
  
  const customStyle = variantStyles[config.variant];
  
  if (customStyle) {
    return (
      <Badge 
        variant="outline" 
        className={cn(customStyle, className)}
      >
        {config.label}
      </Badge>
    );
  }

  return (
    <Badge 
      variant={config.variant as 'default' | 'secondary' | 'destructive' | 'outline'} 
      className={className}
    >
      {config.label}
    </Badge>
  );
}
