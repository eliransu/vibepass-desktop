# Privacy Policy

Effective date: 2025-01-01

This Privacy Policy explains how the cloudpass.dev desktop application (the "App") handles information. We designed the App to operate with your own AWS account (BYO-AWS) and to avoid sending your vault data to vendor servers.

1. What We Do Not Collect
- Vault contents, master passwords, secrets, credentials, and metadata stored by you are not sent to our servers. The App does not include analytics, tracking pixels, or telemetry by default.

2. Data the App Processes
- The App processes data locally on your device and, when configured by you, reads/writes encrypted blobs to AWS Secrets Manager in your AWS account.
- Client-side cryptography: The App derives encryption keys locally and encrypts vault data prior to storing it in AWS.

3. Network Destinations
- AWS Only: The App communicates with AWS endpoints you select (e.g., region-specific Secrets Manager) using your credentials. No data is sent to vendor servers for vault operations.
- Updates (Optional): When explicitly enabled by you, the App may check for application updates via the configured update feed. This is disabled by default.

4. Local Storage
- The App may store limited configuration data locally (e.g., preferences) using an encrypted application store or the operating system keychain/secure storage where available.

5. Your AWS Account
- You control IAM roles, policies, regions, and retention in your AWS account. You are responsible for AWS costs, configuration, and compliance.

6. Security
- We use industry-standard cryptography (PBKDF2-based key derivation, AES) on the client. No cryptography is perfect; residual risk exists.

7. Children’s Privacy
- The App is not directed to children under 13 and is intended for general and enterprise audiences.

8. International Use
- You are responsible for compliance with local laws where you use the App and where your AWS resources are located.

9. Changes to This Policy
- We may update this Policy from time to time. Material changes will be indicated by updating the effective date above. Continued use of the App after changes become effective constitutes acceptance.

10. Contact
- Questions or requests: support@cloudpass.dev
