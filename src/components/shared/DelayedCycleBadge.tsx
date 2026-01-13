import { Badge } from '@/components/ui/badge';
import { AlertOctagon } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface DelayedCycleBadgeProps {
  isDelayed?: boolean;
  reason?: string | null;
}

export function DelayedCycleBadge({ isDelayed = true, reason }: DelayedCycleBadgeProps) {
  if (!isDelayed) return null;

  const badge = (
    <Badge variant="destructive" className="gap-1 bg-warning text-warning-foreground border-warning">
      <AlertOctagon className="h-3 w-3" />
      Delayed
    </Badge>
  );

  if (reason) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {badge}
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-sm font-medium">Delay Reason:</p>
            <p className="text-sm">{reason}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}
