import { useToast } from '../components/ui/toast-provider'

export function useSafeToast() {
  try {
    return useToast()
  } catch {
    return {
      showToast: (_message: string, _type?: 'success' | 'error') => {
        // ToastProvider not available, showing toast
      }
    }
  }
}
