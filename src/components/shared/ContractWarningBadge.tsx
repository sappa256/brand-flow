import { Badge } from '@/components/ui/badge';
import { Clock, AlertTriangle } from 'lucide-react';

interface ContractWarningBadgeProps {
  contractMonth: number;
  showLabel?: boolean;
}

export function ContractWarningBadge({ contractMonth, showLabel = true }: ContractWarningBadgeProps) {
  if (contractMonth < 5) return null;

  const isMonth5 = contractMonth === 5;
  const isMonth6Plus = contractMonth >= 6;

  if (isMonth6Plus) {
    return (
      <Badge variant="destructive" className="animate-pulse">
        <AlertTriangle className="h-3 w-3 mr-1" />
        {showLabel && 'Contract Ending!'}
      </Badge>
    );
  }

  if (isMonth5) {
    return (
      <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30">
        <Clock className="h-3 w-3 mr-1" />
        {showLabel && 'Ending Soon'}
      </Badge>
    );
  }

  return null;
}
