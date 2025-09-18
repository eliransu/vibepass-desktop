import React from 'react'
import { cn } from '../../lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        'flex h-9 w-full rounded-lg border-2 border-border bg-input px-3 py-2 text-body-sm font-medium ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 hover:border-ring/50 focus-visible:shadow-sm shadow-xs hover:shadow-sm crisp-text enhanced-input',
        className,
      )}
      {...props}
    />
  )
})

Input.displayName = 'Input'


