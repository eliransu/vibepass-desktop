import React from 'react'
import { 
  Lock, 
  Key, 
  FileText, 
  CreditCard,
  Search,
  Plus,
  X,
  Eye,
  EyeOff,
  RotateCcw,
  Copy,
  ExternalLink,
  Edit,
  Trash2,
  Settings,
  User,
  Briefcase,
  Users,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Sun,
  Moon,
  Menu,
  Fingerprint,
  Shield,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Info,
  Upload,
  Download,
  Scan,
  QrCode,
  Camera,
  Monitor,
  Loader2,
  HelpCircle,
  type LucideIcon
} from 'lucide-react'
import { cn } from '../../lib/utils'

// Icon mapping for consistent usage
const iconMap = {
  // Core actions
  lock: Lock,
  key: Key,
  'file-text': FileText,
  'credit-card': CreditCard,
  search: Search,
  plus: Plus,
  x: X,
  eye: Eye,
  'eye-off': EyeOff,
  'rotate-ccw': RotateCcw,
  copy: Copy,
  'external-link': ExternalLink,
  edit: Edit,
  'trash-2': Trash2,
  settings: Settings,
  
  // User types
  user: User,
  briefcase: Briefcase,
  users: Users,
  
  // Navigation
  'chevron-right': ChevronRight,
  'chevron-left': ChevronLeft,
  'chevron-down': ChevronDown,
  
  // Theme
  sun: Sun,
  moon: Moon,
  
  // Menu
  menu: Menu,
  
  // Security
  fingerprint: Fingerprint,
  shield: Shield,
  
  // Status
  'alert-circle': AlertCircle,
  'check-circle': CheckCircle,
  'alert-triangle': AlertTriangle,
  info: Info,
  
  // File operations
  upload: Upload,
  download: Download,
  
  // QR/Scanning
  scan: Scan,
  'qr-code': QrCode,
  camera: Camera,
  monitor: Monitor,
  
  // Loading
  'loader-2': Loader2,
  
  // Help/Info
  'help-circle': HelpCircle,
} as const

export type IconName = keyof typeof iconMap

interface IconProps {
  name: IconName
  size?: number | string
  className?: string
  strokeWidth?: number
}

export function Icon({ name, size = 16, className, strokeWidth = 2, ...props }: IconProps): React.JSX.Element {
  const IconComponent = iconMap[name] as LucideIcon
  
  if (!IconComponent) {
    console.warn(`Icon "${name}" not found`)
    return <div className={cn('inline-block', className)} style={{ width: size, height: size }} />
  }
  
  return (
    <IconComponent
      size={size}
      strokeWidth={strokeWidth}
      className={cn('flex-shrink-0', className)}
      {...props}
    />
  )
}

// Specialized icon components for common use cases
export function PasswordIcon({ className, ...props }: Omit<IconProps, 'name'>): React.JSX.Element {
  return <Icon name="lock" className={className} {...props} />
}

export function ApiKeyIcon({ className, ...props }: Omit<IconProps, 'name'>): React.JSX.Element {
  return <Icon name="key" className={className} {...props} />
}

export function NotesIcon({ className, ...props }: Omit<IconProps, 'name'>): React.JSX.Element {
  return <Icon name="file-text" className={className} {...props} />
}

export function ResetIcon({ className, ...props }: Omit<IconProps, 'name'>): React.JSX.Element {
  return <Icon name="rotate-ccw" className={className} {...props} />
}

export function CopyIcon({ className, ...props }: Omit<IconProps, 'name'>): React.JSX.Element {
  return <Icon name="copy" className={className} {...props} />
}

export function EditIcon({ className, ...props }: Omit<IconProps, 'name'>): React.JSX.Element {
  return <Icon name="edit" className={className} {...props} />
}

export function CardsIcon({ className, ...props }: Omit<IconProps, 'name'>): React.JSX.Element {
  return <Icon name="credit-card" className={className} {...props} />
}

export function LoadingIcon({ className, ...props }: Omit<IconProps, 'name'>): React.JSX.Element {
  return <Icon name="loader-2" className={cn('animate-spin', className)} {...props} />
}

// Status icons with predefined styling
export function SuccessIcon({ className, ...props }: Omit<IconProps, 'name'>): React.JSX.Element {
  return <Icon name="check-circle" className={cn('text-success', className)} {...props} />
}

export function ErrorIcon({ className, ...props }: Omit<IconProps, 'name'>): React.JSX.Element {
  return <Icon name="alert-circle" className={cn('text-destructive', className)} {...props} />
}

export function WarningIcon({ className, ...props }: Omit<IconProps, 'name'>): React.JSX.Element {
  return <Icon name="alert-triangle" className={cn('text-warning', className)} {...props} />
}

export function InfoIcon({ className, ...props }: Omit<IconProps, 'name'>): React.JSX.Element {
  return <Icon name="info" className={cn('text-primary', className)} {...props} />
}
