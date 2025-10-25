import { BrowserWindow, screen } from 'electron'
import path from 'node:path'
import http from 'node:http'
import fs from 'node:fs'

/**
 * Manages the quick search popup window
 * Handles creation, positioning, and lifecycle of the lightweight search interface
 */
export class QuickSearchWindowManager {
  private searchWindow: BrowserWindow | null = null
  private server: http.Server | null = null

  /**
   * Create and show the quick search window
   */
  public show(): void {
    if (this.searchWindow) {
      // Window already exists, just show and focus it
      this.searchWindow.show()
      this.searchWindow.focus()
      return
    }

    this.createWindow()
  }

  /**
   * Hide the quick search window without destroying it
   */
  public hide(): void {
    if (this.searchWindow && !this.searchWindow.isDestroyed()) {
      this.searchWindow.hide()
      // Destroy the window to reset auth state next time
      setTimeout(() => {
        this.destroy()
      }, 100)
    }
  }

  /**
   * Toggle window visibility
   */
  public toggle(): void {
    if (this.searchWindow && !this.searchWindow.isDestroyed() && this.searchWindow.isVisible()) {
      this.hide()
    } else {
      // Always create fresh window to ensure clean auth state
      this.destroy()
      this.show()
    }
  }

  /**
   * Create the search window
   */
  private createWindow(): void {
    const display = screen.getPrimaryDisplay()
    const { width: screenWidth, height: screenHeight } = display.workAreaSize

    // Small, centered window
    const windowWidth = 650
    const windowHeight = 500
    const x = Math.floor((screenWidth - windowWidth) / 2)
    const y = Math.floor((screenHeight - windowHeight) / 3) // Positioned higher for better UX

    this.searchWindow = new BrowserWindow({
      width: windowWidth,
      height: windowHeight,
      x,
      y,
      show: false,
      frame: false,
      transparent: false,
      resizable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      backgroundColor: '#1a1a1a',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    })

    // Load content
    this.loadContent()

    // Show when ready
    this.searchWindow.once('ready-to-show', () => {
      this.searchWindow?.show()
      this.searchWindow?.focus()
    })

    // Handle window close - but don't hide on blur during auth
    // to prevent window from disappearing during Touch ID prompt
    let isAuthenticating = true
    
    // Listen for auth completion (window content will send this)
    this.searchWindow.webContents.on('did-finish-load', () => {
      // Give some time for auth to complete
      setTimeout(() => {
        isAuthenticating = false
      }, 2000)
    })

    this.searchWindow.on('blur', () => {
      // Only hide on blur if not authenticating
      if (!isAuthenticating) {
        this.hide()
      }
    })

    this.searchWindow.on('closed', () => {
      this.searchWindow = null
      this.cleanupServer()
    })
  }

  /**
   * Load content into the window
   */
  private loadContent(): void {
    if (!this.searchWindow) return

    const isDev = process.env.NODE_ENV === 'development'
    
    if (isDev && !process.mas) {
      // In dev, load from webpack dev server
      this.searchWindow.loadURL('http://localhost:3000/tray-search.html')
      this.searchWindow.webContents.openDevTools({ mode: 'detach' })
    } else {
      // In production, serve from local HTTP server
      this.startProductionServer()
    }
  }

  /**
   * Start HTTP server for production builds
   */
  private startProductionServer(): void {
    const FIXED_PORT = 17897 // Different from main window port
    const rendererDir = path.join(__dirname, '../renderer')

    this.server = http.createServer((req, res) => {
      try {
        const reqUrl = new URL(req.url ?? '/', 'http://127.0.0.1')
        let pathname = decodeURIComponent(reqUrl.pathname)
        
        if (pathname === '/' || pathname === '/tray-search.html') {
          pathname = '/tray-search.html'
        }
        
        let filePath = path.join(rendererDir, pathname)
        
        // Prevent path traversal
        if (!filePath.startsWith(rendererDir)) {
          filePath = path.join(rendererDir, 'tray-search.html')
        }

        fs.readFile(filePath, (err, data) => {
          if (err) {
            // Fallback to tray-search.html
            fs.readFile(path.join(rendererDir, 'tray-search.html'), (err2, data2) => {
              if (err2) {
                res.writeHead(404)
                res.end('Not Found')
              } else {
                res.setHeader('Content-Type', 'text/html; charset=UTF-8')
                res.writeHead(200)
                res.end(data2)
              }
            })
            return
          }

          const ext = path.extname(filePath).toLowerCase()
          const type = this.getContentType(ext)
          res.setHeader('Content-Type', type)
          res.writeHead(200)
          res.end(data)
        })
      } catch {
        res.writeHead(500)
        res.end('Server error')
      }
    })

    const tryListen = (port: number, attemptsLeft: number): void => {
      this.server?.once('error', (err: any) => {
        if ((err?.code === 'EADDRINUSE' || err?.code === 'EACCES') && attemptsLeft > 0) {
          tryListen(port + 1, attemptsLeft - 1)
        } else {
          // Fallback to file protocol
          const htmlPath = path.join(rendererDir, 'tray-search.html')
          this.searchWindow?.loadFile(htmlPath)
        }
      })

      this.server?.listen(port, '127.0.0.1', () => {
        const url = `http://127.0.0.1:${port}/tray-search.html`
        this.searchWindow?.loadURL(url)
      })
    }

    tryListen(FIXED_PORT, 5)
  }

  /**
   * Get content type for file extension
   */
  private getContentType(ext: string): string {
    const types: Record<string, string> = {
      '.html': 'text/html; charset=UTF-8',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.map': 'application/json',
    }
    return types[ext] || 'application/octet-stream'
  }

  /**
   * Cleanup the HTTP server
   */
  private cleanupServer(): void {
    if (this.server) {
      this.server.close()
      this.server = null
    }
  }

  /**
   * Destroy the window and cleanup
   */
  public destroy(): void {
    if (this.searchWindow && !this.searchWindow.isDestroyed()) {
      this.searchWindow.destroy()
      this.searchWindow = null
    }
    this.cleanupServer()
  }

  /**
   * Check if window exists and is visible
   */
  public isVisible(): boolean {
    return this.searchWindow !== null && 
           !this.searchWindow.isDestroyed() && 
           this.searchWindow.isVisible()
  }

  /**
   * Get the window instance (for advanced use cases)
   */
  public getWindow(): BrowserWindow | null {
    return this.searchWindow
  }
}

