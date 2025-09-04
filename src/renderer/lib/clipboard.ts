/**
 * Safely copy text to clipboard with fallbacks
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // First try using the preload API (Electron) - only if running in Electron
    if (window.cloudpass && typeof window.cloudpass.copyToClipboard === 'function') {
      try {
        window.cloudpass.copyToClipboard(text)
        return true
      } catch (err) {
        console.warn('Electron clipboard API failed, falling back:', err)
      }
    }
    
    // Fallback to modern clipboard API (works in secure contexts)
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text)
        return true
      } catch (err) {
        console.warn('Modern clipboard API failed, falling back:', err)
      }
    }
    
    // Final fallback to legacy method (works in most environments including development)
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    textArea.style.opacity = '0'
    textArea.style.pointerEvents = 'none'
    textArea.style.zIndex = '-1000'
    textArea.setAttribute('tabindex', '-1')
    textArea.setAttribute('aria-hidden', 'true')
    textArea.readOnly = true
    
    document.body.appendChild(textArea)
    
    // Focus and select text
    textArea.focus()
    textArea.select()
    textArea.setSelectionRange(0, textArea.value.length)
    
    // Try to copy
    let success = false
    try {
      success = document.execCommand('copy')
    } catch (err) {
      console.warn('execCommand copy failed:', err)
    }
    
    // Clean up
    document.body.removeChild(textArea)
    
    if (!success) {
      console.error('All clipboard methods failed')
    }
    
    return success
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
    return false
  }
}

/**
 * Copy text with user feedback via toast
 */
export async function copyWithFeedback(
  text: string, 
  successMessage = 'Copied to clipboard',
  showToast?: (message: string, type?: 'success' | 'error') => void
): Promise<void> {
  const success = await copyToClipboard(text)
  
  if (success) {
    if (showToast) {
      showToast(successMessage, 'success')
    } else {
      console.log(successMessage)
    }
  } else {
    if (showToast) {
      showToast('Failed to copy to clipboard', 'error')
    } else {
      console.error('Failed to copy to clipboard')
    }
  }
}
