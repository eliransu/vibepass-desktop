import React from 'react'
import { cn } from '../../lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {}

export function Badge({ className, ...props }: BadgeProps): React.JSX.Element {
  return (
    <span
      className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs bg-accent text-accent-foreground', className)}
      {...props}
    />
  )
}


