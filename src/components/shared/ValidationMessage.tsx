import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ValidationMessageProps {
  message: string;
  className?: string;
}

export function ValidationMessage({ message, className = '' }: ValidationMessageProps) {
  if (!message) return null;

  return (
    <Alert variant="destructive" className={`py-2 ${className}`}>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="text-sm">{message}</AlertDescription>
    </Alert>
  );
}
