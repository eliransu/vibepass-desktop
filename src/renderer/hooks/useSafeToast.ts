import { useToast } from '../components/ui/toast-provider'

export function useSafeToast() {
  try {
    return useToast()
  } catch {
    return {
      showToast: (message: string, type?: 'success' | 'error') => {
        console.log('🚫 ToastProvider not available, showing toast:', message, type)
      }
    }
  }
}
