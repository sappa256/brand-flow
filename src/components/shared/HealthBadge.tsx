import { Badge } from '@/components/ui/badge';
import { Heart, AlertTriangle, ShieldAlert } from 'lucide-react';
import type { HealthStatus } from '@/types/crm';

interface HealthBadgeProps {
  status: HealthStatus;
  showIcon?: boolean;
  size?: 'sm' | 'default';
}

export function HealthBadge({ status, showIcon = true, size = 'default' }: HealthBadgeProps) {
  const config = {
    good: {
      variant: 'default' as const,
      className: 'bg-success/20 text-success border-success/30 hover:bg-success/30',
      icon: Heart,
      label: 'Good',
    },
    watch: {
      variant: 'default' as const,
      className: 'bg-warning/20 text-warning border-warning/30 hover:bg-warning/30',
      icon: AlertTriangle,
      label: 'Watch',
    },
    risk: {
      variant: 'default' as const,
      className: 'bg-destructive/20 text-destructive border-destructive/30 hover:bg-destructive/30',
      icon: ShieldAlert,
      label: 'At Risk',
    },
  };

  const { className, icon: Icon, label } = config[status];
  const sizeClass = size === 'sm' ? 'text-xs px-1.5 py-0.5' : '';

  return (
    <Badge variant="outline" className={`${className} ${sizeClass}`}>
      {showIcon && <Icon className={`${size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} mr-1`} />}
      {label}
    </Badge>
  );
}
