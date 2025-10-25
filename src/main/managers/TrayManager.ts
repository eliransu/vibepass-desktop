import { Tray, Menu, nativeImage, app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

/**
 * Manages the system tray icon and menu
 * Provides a persistent UI element in the macOS menu bar
 */
export class TrayManager {
  private tray: Tray | null = null
  private onSearchClickCallback?: () => void
  private onExitClickCallback?: () => void
  private onShowAppClickCallback?: () => void
  private onAddNewClickCallback?: () => void
  private vaultSource: 'local' | 'cloud' = 'local'
  private onVaultSourceChangeCallback?: (source: 'local' | 'cloud') => void

  /**
   * Initialize the system tray with icon and menu
   */
  public initialize(): void {
    try {
      const iconPath = this.resolveIconPath()
      // Resolved icon path
      
      const icon = nativeImage.createFromPath(iconPath)
      const isDev = process.env.NODE_ENV === 'development'
      
      // Always provide an image (macOS can hide items without an image)
      const visibleFallback = nativeImage
        .createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAYAAAAfSC3RAAAALElEQVQoU2NkwA34z0AEGDEYo4BxGQYGBkYQw4hFwxgGg0g1gUQhWQhQFQAAkY0gqT8C3wQAAAABJRU5ErkJggg==')
        .resize({ width: 16, height: 16 })

      if (icon.isEmpty()) {
        // Icon is empty, using fallback image
        if (isDev) {
          // Non-template so it remains visible in dark/light themes
          visibleFallback.setTemplateImage(false)
          this.tray = new Tray(visibleFallback)
        } else {
          visibleFallback.setTemplateImage(true)
          this.tray = new Tray(visibleFallback)
        }
      } else {
        // Resize icon for menu bar (16x16 is standard for macOS tray)
        const resizedIcon = icon.resize({ width: 16, height: 16 })
        if (isDev) {
          // Force non-template to guarantee visibility
          resizedIcon.setTemplateImage(false)
          this.tray = new Tray(resizedIcon)
        } else {
          resizedIcon.setTemplateImage(true)
          this.tray = new Tray(resizedIcon)
        }
      }
      
      this.tray.setToolTip('CloudPass - Quick Access')
      this.updateMenu()
      // Title is already set in dev codepath

      // Left-click toggles quick search if callback registered
      this.tray.on('click', () => {
        if (this.onSearchClickCallback) this.onSearchClickCallback()
      })
      // System tray initialized successfully
    } catch {
      // Failed to initialize tray
    }
  }

  /**
   * Register callback for search action
   */
  public onSearchClick(callback: () => void): void {
    this.onSearchClickCallback = callback
    this.updateMenu()
  }

  /**
   * Register callback for exit action
   */
  public onExitClick(callback: () => void): void {
    this.onExitClickCallback = callback
    this.updateMenu()
  }

  /**
   * Register callback for show app action
   */
  public onShowAppClick(callback: () => void): void {
    this.onShowAppClickCallback = callback
    this.updateMenu()
  }

  /**
   * Register callback for add new action
   */
  public onAddNewClick(callback: () => void): void {
    this.onAddNewClickCallback = callback
    this.updateMenu()
  }

  /**
   * Update the tray menu with current callbacks
   */
  private updateMenu(): void {
    if (!this.tray) return

    const menuTemplate = [
      {
        label: 'Vault Source',
        submenu: [
          {
            label: 'Cloud',
            type: 'radio' as const,
            checked: this.vaultSource === 'cloud',
            click: () => { this.setVaultSource('cloud') },
          },
          {
            label: 'Local',
            type: 'radio' as const,
            checked: this.vaultSource === 'local',
            click: () => { this.setVaultSource('local') },
          },
        ],
      },
      { type: 'separator' as const },
      {
        label: 'Quick Search',
        accelerator: 'CommandOrControl+Shift+Alt+P',
        click: () => {
          if (this.onSearchClickCallback) {
            this.onSearchClickCallback()
          }
        },
      },
      {
        label: 'Add New…',
        click: () => {
          if (this.onAddNewClickCallback) {
            this.onAddNewClickCallback()
          } else if (this.onShowAppClickCallback) {
            this.onShowAppClickCallback()
          }
        },
      },
      { type: 'separator' as const },
      {
        label: 'Open CloudPass',
        click: () => {
          if (this.onShowAppClickCallback) {
            this.onShowAppClickCallback()
          }
        },
      },
      { type: 'separator' as const },
      {
        label: 'Quit',
        accelerator: 'CommandOrControl+Q',
        click: () => {
          if (this.onExitClickCallback) {
            this.onExitClickCallback()
          } else {
            app.quit()
          }
        },
      },
    ]

    const contextMenu = Menu.buildFromTemplate(menuTemplate)
    this.tray.setContextMenu(contextMenu)
  }

  /**
   * Resolve the icon path for the tray
   */
  private resolveIconPath(): string {
    const isDev = process.env.NODE_ENV === 'development'
    if (isDev) {
      // In dev mode, __dirname is dist/main, so go up two levels to project root
      return path.join(__dirname, '../../src/assets/icon.png')
    }
    // In production, try multiple possible locations
    const possiblePaths = [
      path.join(__dirname, '../renderer/tray-icon.png'),
      path.join(__dirname, '../renderer/icon.png'),
      path.join(__dirname, '../../renderer/tray-icon.png'),
      path.join(__dirname, '../../renderer/icon.png'),
      path.join(process.resourcesPath, 'icon.png'),
      path.join(app.getAppPath(), 'dist/renderer/icon.png'),
    ]
    
    for (const iconPath of possiblePaths) {
      if (fs.existsSync(iconPath)) {
        // Found tray icon at resolved path
        return iconPath
      }
    }
    
    // Tray icon not found in any location, trying to create fallback
    // If no icon found, return the first path (will create empty icon as fallback in initialize)
    return possiblePaths[0]
  }

  /**
   * Get current vault source selection
   */
  public getVaultSource(): 'local' | 'cloud' {
    return this.vaultSource
  }

  /**
   * Set current vault source and refresh menu
   */
  public setVaultSource(source: 'local' | 'cloud'): void {
    this.vaultSource = source
    if (this.onVaultSourceChangeCallback) {
      try { this.onVaultSourceChangeCallback(source) } catch {}
    }
    this.updateMenu()
  }

  /**
   * Subscribe to vault source changes
   */
  public onVaultSourceChange(callback: (source: 'local' | 'cloud') => void): void {
    this.onVaultSourceChangeCallback = callback
  }

  /**
   * Destroy the tray icon
   */
  public destroy(): void {
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
    }
  }

  /**
   * Check if tray is initialized
   */
  public isInitialized(): boolean {
    return this.tray !== null
  }
}

