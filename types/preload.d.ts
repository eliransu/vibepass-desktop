export {}

declare global {
      interface Window {
      vibepass: {
        copyToClipboard: (text: string) => void
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
        onLock: (handler: () => void) => void
      }
    }
}


