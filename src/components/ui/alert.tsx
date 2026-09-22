import * as React from 'react';
import { cn } from '@/lib/utils';

export function Alert({
  className,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: 'default' | 'destructive' | 'success' }) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-xl border p-4 text-sm',
        variant === 'default' && 'border-card-border bg-muted text-foreground',
        variant === 'destructive' && 'border-danger/30 bg-danger/10 text-danger',
        variant === 'success' && 'border-success/30 bg-success/10 text-success',
        className,
      )}
      {...props}
    />
  );
}
