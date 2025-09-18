export {}

declare global {
      interface Window {
      cloudpass: {
        copyToClipboard: (text: string) => void
        getAwsUserIdentity: () => Promise<{ ok: true; userId: string } | { ok: false; error: string; code?: string }>
        keytarSet: (service: string, account: string, secret: string) => Promise<boolean>
        keytarGet: (service: string, account: string) => Promise<string | null>
        biometricCheck: () => Promise<boolean>
        biometricStore: (masterPassword: string) => Promise<boolean>
        biometricRetrieve: () => Promise<string | null>
        storeGet: <T = unknown>(key: string) => Promise<T | undefined>
        storeSet: (key: string, value: unknown) => Promise<boolean>
        configGet: () => Promise<any | null>
        configSet: (cfg: any | null) => Promise<boolean>
        fileOpenJson: () => Promise<{ name: string; content: string } | null>
        openExternal: (url: string) => Promise<boolean>
        awsSsoLogin: () => Promise<{ ok: boolean; error?: string }>
        teamGetSecretValue: (region: string, secretId: string, profile?: string) => Promise<string | null>
        // Consolidated vault secret helpers
        vaultRead: (region: string, name: string, profile?: string) => Promise<{ success: true; data: string | null } | { success: false; error: string; message: string }>
        vaultWrite: (region: string, name: string, secretString: string, profile?: string) => Promise<boolean>
        // QR / screen capture helpers
        captureScreen: () => Promise<string | null> // returns a data URL (image/png)
        // Native crop (macOS)
        cropScreen: () => Promise<string | null>
        onLock: (handler: () => void) => void
      }
    }
    namespace JSX {
      interface IntrinsicElements {
        'dotlottie-wc': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
          src?: string
          autoplay?: boolean | string
          loop?: boolean | string
          speed?: number | string
          data?: string
          segment?: string
          mode?: string
          'background-color'?: string
          'render-config'?: string
          style?: React.CSSProperties
        }
      }
    }
}


