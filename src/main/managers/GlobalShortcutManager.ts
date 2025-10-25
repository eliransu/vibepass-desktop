import { globalShortcut, app } from 'electron'

/**
 * Manages global keyboard shortcuts
 * Handles registration and lifecycle of system-wide hotkeys
 */
export class GlobalShortcutManager {
  private registeredShortcuts: Set<string> = new Set()

  /**
   * Register a global shortcut
   * @param accelerator The keyboard shortcut (e.g., 'CommandOrControl+Shift+K')
   * @param callback Function to execute when shortcut is triggered
   * @returns true if registration succeeded, false otherwise
   */
  public register(accelerator: string, callback: () => void): boolean {
    try {
      const success = globalShortcut.register(accelerator, callback)
      if (success) {
        this.registeredShortcuts.add(accelerator)
        // Registered global shortcut successfully
      } else {
        // Failed to register global shortcut
      }
      return success
    } catch {
      // Error registering shortcut
      return false
    }
  }

  /**
   * Unregister a specific shortcut
   */
  public unregister(accelerator: string): void {
    if (this.registeredShortcuts.has(accelerator)) {
      globalShortcut.unregister(accelerator)
      this.registeredShortcuts.delete(accelerator)
      // Unregistered shortcut
    }
  }

  /**
   * Unregister all shortcuts
   */
  public unregisterAll(): void {
    globalShortcut.unregisterAll()
    this.registeredShortcuts.clear()
    // Unregistered all shortcuts
  }

  /**
   * Check if a shortcut is registered
   */
  public isRegistered(accelerator: string): boolean {
    return globalShortcut.isRegistered(accelerator)
  }

  /**
   * Initialize cleanup on app quit
   */
  public initialize(): void {
    app.on('will-quit', () => {
      this.unregisterAll()
    })
  }

  /**
   * Get all registered shortcuts
   */
  public getRegisteredShortcuts(): string[] {
    return Array.from(this.registeredShortcuts)
  }
}

