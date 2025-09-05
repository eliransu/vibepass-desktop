import React from 'react'
import { Button, type ButtonProps } from './button'
import { Icon, type IconName, LoadingIcon } from './icon'
import { cn } from '../../lib/utils'

export interface IconButtonProps extends Omit<ButtonProps, 'children'> {
  icon: IconName | React.ReactNode
  label?: string
  iconSize?: number | string
  iconStrokeWidth?: number
  isLoading?: boolean
  isActive?: boolean
}

export function IconButton({ 
  icon, 
  label, 
  className, 
  size = 'icon',
  iconSize,
  iconStrokeWidth = 2,
  isLoading = false,
  isActive = false,
  disabled,
  ...props 
}: IconButtonProps): React.JSX.Element {
  const iconElement = typeof icon === 'string' 
    ? <Icon name={icon as IconName} size={iconSize} strokeWidth={iconStrokeWidth} />
    : icon

  return (
    <Button
      size={size}
      className={cn(
        'flex-shrink-0 relative',
        isActive && 'bg-accent text-accent-foreground shadow-sm',
        className
      )}
      title={label}
      aria-label={label}
      aria-pressed={isActive}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <LoadingIcon size={iconSize || 16} />
        </div>
      )}
      <span className={cn(isLoading ? 'opacity-0' : 'opacity-100', 'transition-opacity')}>
        {iconElement}
      </span>
    </Button>
  )
}


