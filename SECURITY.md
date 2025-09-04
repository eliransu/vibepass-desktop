## Security Policy

- Please report vulnerabilities privately via email: security@cloudpass.dev (or open a GitHub Security Advisory).
- Do not file public GitHub issues for sensitive security reports.
- We aim to acknowledge within 72 hours and fix high severity issues promptly.

### Supported Versions
We support the latest minor release. Older versions may not receive security fixes.

### Security Overview
- Electron hardening: `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true` in renderer.
- Renderer served via localhost in production to avoid `file://` OAuth issues; strict allowlist for `window.open`.
- Strong crypto: PBKDF2 (100k iterations) and AES‑256 for vault encryption.
- Biometric unlock on macOS via secure keychain (Keytar).
- Remote storage (optional): encrypted single‑blob per vault in AWS Secrets Manager; Firestore only stores non‑sensitive metadata.
- Auto‑update is opt‑in via `VIBEPASS_AUTOUPDATE=1` to avoid unintended outbound checks.
- Notarized distribution on macOS with hardened runtime and entitlements.

### Responsible Disclosure
If you find a security issue, please provide:
- Affected version and platform
- Reproduction steps or proof‑of‑concept
- Impact assessment (what can a realistic attacker do)

We will coordinate a fix and credit you (if desired) after remediation.
