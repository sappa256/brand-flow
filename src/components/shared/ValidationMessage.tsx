import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface ValidationMessageProps {
  message: string;
  type?: 'error' | 'warning' | 'info';
  className?: string;
}

export function ValidationMessage({ message, type = 'error', className = '' }: ValidationMessageProps) {
  if (!message) return null;

  const variants = {
    error: {
      variant: 'destructive' as const,
      icon: AlertCircle,
      customClass: '',
    },
    warning: {
      variant: 'default' as const,
      icon: AlertTriangle,
      customClass: 'border-warning bg-warning/10 text-warning-foreground',
    },
    info: {
      variant: 'default' as const,
      icon: Info,
      customClass: 'border-info bg-info/10 text-info-foreground',
    },
  };

  const config = variants[type];
  const Icon = config.icon;

  return (
    <Alert 
      variant={config.variant} 
      className={`py-2 ${config.customClass} ${className}`}
    >
      <Icon className="h-4 w-4" />
      <AlertDescription className="text-sm">{message}</AlertDescription>
    </Alert>
  );
}
