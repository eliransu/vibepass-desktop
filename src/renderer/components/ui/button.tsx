import React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg font-semibold ring-offset-background transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] crisp-text enhanced-button',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm hover:shadow-md active:shadow-sm border border-primary-border/20',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary-hover border-2 border-border shadow-sm hover:shadow-md',
        ghost: 'hover:bg-accent hover:text-accent-foreground border border-transparent hover:border-border/30',
        outline: 'border-2 border-border bg-background hover:bg-accent hover:text-accent-foreground shadow-sm hover:shadow-md hover:border-border/60',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm hover:shadow-md active:shadow-sm border border-destructive/20',
        success: 'bg-success text-success-foreground hover:bg-success/90 shadow-sm hover:shadow-md active:shadow-sm border border-success/20',
        warning: 'bg-warning text-warning-foreground hover:bg-warning/90 shadow-sm hover:shadow-md active:shadow-sm border border-warning/20',
        'ghost-primary': 'text-primary hover:bg-primary-light hover:text-primary border border-transparent hover:border-primary/20',
        'ghost-destructive': 'text-destructive hover:bg-destructive-light hover:text-destructive border border-transparent hover:border-destructive/20',
      },
      size: {
        xs: 'h-6 px-2 text-caption font-medium',
        sm: 'h-7 px-3 text-body-sm font-medium',
        default: 'h-9 px-4 text-body-sm',
        lg: 'h-11 px-6 text-body',
        xl: 'h-12 px-8 text-body-lg',
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


