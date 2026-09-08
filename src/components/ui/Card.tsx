import React from 'react';
import { cn } from '../../utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({
  className,
  hoverEffect = false,
  children,
  ...props
}) => {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm transition-all',
        hoverEffect && 'hover:shadow-md hover:border-primary/30',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
