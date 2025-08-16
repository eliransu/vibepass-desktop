## VibePass

Secure, modern, local‑first password manager with enterprise options. Built with Electron, React, and TypeScript.

- React 19 • Electron 37 • TypeScript • TailwindCSS
- Biometric unlock on macOS (Touch ID)
- Local AES‑256 encryption with PBKDF2 (100k iterations)
- Per‑vault consolidated storage via AWS Secrets Manager (encrypted blob)
- Lightweight metadata in Firebase Firestore (optional)
- Multiple vaults: personal, work, and custom
- i18n (English/Hebrew) with automatic RTL/LTR direction
- macOS notarized builds (hardened runtime, entitlements)

### Why VibePass

- Local‑first security: Only encrypted strings can leave your machine.
- Enterprise‑ready: Uses your AWS profile/region and AWS Secrets Manager for shared or regulated environments.
- Delightful UX: A focused, fast UI inspired by the best password managers.

### Screenshots

Add screenshots of `Login`, `Unlock`, and `Vault` views here.

### Getting Started

Prerequisites
- Node.js 18+
- npm 9+
- macOS, Windows, or Linux
- Optional (for team/enterprise features): AWS CLI v2 with SSO and an AWS profile; Firebase project if you want cloud metadata sync

Install
```
npm install
```

Run (development)
```
npm run dev
```

Package/distribute
```
# All platforms (from host OS)
npm run dist

# macOS only (from macOS host)
npm run dist:mac
```

### Configuration

Firebase (optional, used for lightweight item metadata): create `.env` with
```
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...
FIREBASE_PROJECT_ID=...
FIREBASE_STORAGE_BUCKET=...
FIREBASE_MESSAGING_SENDER_ID=...
FIREBASE_APP_ID=...
```

If these are absent, the app runs locally with empty remote metadata and full local encryption.

AWS (optional, enables consolidated per‑vault storage and team workflows)
- Install AWS CLI v2 and configure SSO/profile
- In the app’s top bar, choose your `AWS Profile` and `AWS Region`
- Click SSO Login, then VibePass will read/write a single encrypted blob per vault to AWS Secrets Manager

### Security Model

- Master key derivation: PBKDF2 with 100k iterations; AES‑256 for encryption
- On first setup, VibePass stores a salt and an encrypted verifier locally (no master password is stored)
- Biometric unlock: macOS Touch ID prompt gates retrieval of the master password stored in secure OS keychain (via Keytar)
- Storage
  - Local: all secrets are encrypted at rest; UI decrypts in memory after unlock
  - Remote: a single consolidated encrypted JSON per vault in AWS Secrets Manager; Firestore stores non‑sensitive metadata (title/tags/category)
- No auto‑lock on window blur; explicit unlock flow provides smoother UX

### Internationalization and RTL/LTR

The renderer uses i18next with English and Hebrew strings. Direction switches automatically based on language, so Hebrew renders RTL across the UI.

### App Structure

- `src/main/` Electron main process, IPC, AWS, keychain, and local embedded server for packaged builds
- `src/renderer/` React UI, routing, features, and i18n
- `src/shared/` cross‑process utilities (crypto, storage, Firebase)
- `release/` packaged artifacts

Key files to explore
- `src/renderer/features/security/MasterGate.tsx` – unlock/create master password, biometric flow
- `src/shared/security/crypto.ts` – PBKDF2 + AES helpers
- `src/renderer/services/vaultApi.ts` – CRUD, Firestore metadata + AWS consolidated blob
- `src/main/preload.ts` and `types/preload.d.ts` – secure bridge API
- `src/renderer/i18n.ts` – i18n resources (en/he)

### Troubleshooting

- AWS CLI not found: install AWS CLI v2 and ensure it’s on PATH, or set `AWS_CLI_PATH`
- AWS SSO expired: click SSO Login in the top bar; errors will mention expired tokens
- Firebase misconfigured: you’ll see an in‑app banner; set `.env` or proceed without cloud metadata

### Roadmap

- Windows Hello and Linux biometric support
- Browser extension integration for autofill
- Attachments and advanced sharing controls

### Contributing

PRs welcome. Please run before submitting:
```
npm run lint
npm run typecheck
npm test
```

### License

PolyForm Noncommercial 1.0.0 — free for noncommercial use. Commercial use requires a separate license. See `LICENSE`.

### Releasing on macOS (Notarized)

We provide an automated script that builds, submits for notarization, staples, and validates the DMG.

Prerequisites (set in your shell):
```
export APPLE_ID="<your-apple-id>"
export APPLE_APP_SPECIFIC_PASSWORD="<app-specific-password>"
export APPLE_TEAM_ID="<team-id>"
```

Then run:
```
npm run release:mac
```

The notarized DMG is placed in `release/` and is safe to distribute (passes Gatekeeper after download).


