import React from 'react'
import { Icon } from './icon'

type EmptyStateProps = {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps): React.JSX.Element {
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
          {icon ?? (
            <Icon name="help-circle" size={32} className="text-muted-foreground" />
          )}
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground mb-4">{description}</p>
        )}
        {action}
      </div>
    </div>
  )
}


