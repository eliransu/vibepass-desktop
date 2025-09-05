import React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm hover:shadow-md active:shadow-sm',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary-hover border border-border shadow-xs hover:shadow-sm',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        outline: 'border border-border bg-background hover:bg-accent hover:text-accent-foreground shadow-xs hover:shadow-sm',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm hover:shadow-md active:shadow-sm',
        success: 'bg-success text-success-foreground hover:bg-success/90 shadow-sm hover:shadow-md active:shadow-sm',
        warning: 'bg-warning text-warning-foreground hover:bg-warning/90 shadow-sm hover:shadow-md active:shadow-sm',
        'ghost-primary': 'text-primary hover:bg-primary-light hover:text-primary',
        'ghost-destructive': 'text-destructive hover:bg-destructive-light hover:text-destructive',
      },
      size: {
        xs: 'h-6 px-2 text-xs',
        sm: 'h-7 px-3 text-xs',
        default: 'h-9 px-4 text-sm',
        lg: 'h-11 px-6 text-base',
        xl: 'h-12 px-8 text-lg',
        icon: 'h-9 w-9',
        'icon-sm': 'h-7 w-7',
        'icon-lg': 'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps): React.JSX.Element {
  const Comp: any = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />
}


