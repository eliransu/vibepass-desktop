import { useToast } from '../components/ui/toast-provider'

/**
 * Safe toast hook that won't throw if ToastProvider is not available
 */
export function useSafeToast() {
  try {
    return useToast()
  } catch {
    // Return a no-op function if ToastProvider is not available
    return {
      showToast: (message: string, type?: 'success' | 'error') => {
        console.log('🚫 ToastProvider not available, showing toast:', message, type)
        // no-op in environments without ToastProvider
      }
    }
  }
}
