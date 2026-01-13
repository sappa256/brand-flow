import { Badge } from '@/components/ui/badge';
import { AlertOctagon } from 'lucide-react';

interface DelayedCycleBadgeProps {
  isDelayed: boolean;
}

export function DelayedCycleBadge({ isDelayed }: DelayedCycleBadgeProps) {
  if (!isDelayed) return null;

  return (
    <Badge variant="destructive" className="gap-1">
      <AlertOctagon className="h-3 w-3" />
      Delayed
    </Badge>
  );
}
