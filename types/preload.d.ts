export {}

declare global {
      interface Window {
      cloudpass: {
        copyToClipboard: (text: string) => void
        getOsUsername: () => Promise<string>
        keytarSet: (service: string, account: string, secret: string) => Promise<boolean>
        keytarGet: (service: string, account: string) => Promise<string | null>
        biometricCheck: () => Promise<boolean>
        biometricStore: (masterPassword: string) => Promise<boolean>
        biometricRetrieve: () => Promise<string | null>
        storeGet: <T = unknown>(key: string) => Promise<T | undefined>
        storeSet: (key: string, value: unknown) => Promise<boolean>
        awsGetProfiles: () => Promise<Record<string, string>>
        awsSsoLogin: (profile: string) => Promise<{ ok: boolean; error?: string }>
        awsGetAccount: (profile?: string) => Promise<string | null>
        teamList: (region: string, ids: string[]) => Promise<Record<string, string | null>>
        teamListWithProfile: (region: string, ids: string[], profile?: string) => Promise<Record<string, string | null>>
        teamCreate: (region: string, name: string, secretString: string, profile?: string) => Promise<string | undefined>
        teamUpdate: (region: string, id: string, secretString: string) => Promise<boolean>
        teamDelete: (region: string, id: string, force: boolean) => Promise<boolean>
        teamListApp: (region: string, profile?: string) => Promise<Array<{ arn?: string; name?: string; description?: string; lastChangedDate?: string }>>
        teamGetSecretValue: (region: string, secretId: string, profile?: string) => Promise<string | null>
        // Consolidated vault secret helpers
        vaultRead: (region: string, name: string, profile?: string) => Promise<string | null>
        vaultWrite: (region: string, name: string, secretString: string, profile?: string) => Promise<boolean>
        // QR / screen capture helpers
        captureScreen: () => Promise<string | null> // returns a data URL (image/png)
        // Composited active frame via getUserMedia
        captureActiveFrame: () => Promise<string | null>
        // OS picker capture via getDisplayMedia
        captureViaPicker: () => Promise<string | null>
        // Native crop (macOS)
        cropScreen: () => Promise<string | null>
        // Overlay cropper (legacy)
        openCropOverlay: () => Promise<void>
        closeCropOverlay: () => Promise<void>
        onCropResult: (handler: (text: string) => void) => void
        onLock: (handler: () => void) => void
      }
    }
    namespace JSX {
      interface IntrinsicElements {
        'dotlottie-player': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
          src?: string
          autoplay?: boolean
          loop?: boolean
          background?: string
          speed?: number
          controls?: boolean
          mode?: 'normal' | 'bounce'
          style?: React.CSSProperties
        }
      }
    }
}


