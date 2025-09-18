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
        <h3 className="text-heading-4 text-foreground mb-2 crisp-text">{title}</h3>
        {description && (
          <p className="text-body-sm text-muted-foreground mb-4 crisp-text">{description}</p>
        )}
        {action}
      </div>
    </div>
  )
}


