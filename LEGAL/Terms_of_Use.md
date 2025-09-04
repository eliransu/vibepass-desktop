# Terms of Use

Effective date: 2025-01-01

These Terms of Use ("Terms") govern your use of the cloudpass.dev desktop application (the "App"). By installing or using the App, you agree to these Terms.

1. License and Restrictions
- We grant you a revocable, non-exclusive, non-transferable license to install and use the App for your personal or internal business purposes.
- You may not: (a) reverse engineer or decompile the App except as permitted by law; (b) resell, lease, or sublicense the App; (c) use the App to develop a competing service; (d) use the App in violation of any applicable law or third-party rights.

2. BYO-AWS Architecture; No Vendor Servers
- The App is designed to operate entirely with your own AWS account ("BYO-AWS"). It reads/writes encrypted vault data only to AWS services you configure (primarily AWS Secrets Manager) using your credentials.
- The App does not transmit your vault contents, master password, or related personal data to our servers. There is no vendor-hosted backend for vault data.
- Optional auto-updates may perform metadata checks against the configured update feed only when explicitly enabled via environment variables.

3. Your Responsibilities
- You are solely responsible for: (a) your AWS account configuration, IAM policies, regions, and costs; (b) safeguarding your master password and local device; (c) complying with all laws and your organization’s policies.
- You understand that loss of your master password can result in permanent loss of access to encrypted data.

4. Security and Encryption
- The App encrypts vault data client-side prior to any storage in AWS. Cryptography includes PBKDF2-based key derivation and AES encryption as implemented in the App.
- You acknowledge that no security measure is perfect and that residual risk remains when using software.

5. Updates
- We may from time to time provide updates or patches. Auto-update checks are disabled by default and can be enabled by you (e.g., via an environment variable). Installing updates may be necessary to maintain security and functionality.

6. Third-Party Components
- The App includes third-party open-source components (e.g., Electron, React, Redux Toolkit, i18next, CryptoJS, AWS SDK, electron-store, keytar). Licenses for those components apply in addition to these Terms.
- The App communicates only with AWS endpoints you configure, except for optional update checks when enabled by you.

7. Intellectual Property
- We and our licensors retain all right, title, and interest in and to the App, including all software, documentation, and trademarks.

8. Disclaimers
- THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.

9. Limitation of Liability
- TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR ANY LOSS OF DATA, PROFITS, OR REVENUE, ARISING FROM OR RELATED TO YOUR USE OF THE APP.
- OUR TOTAL LIABILITY FOR ALL CLAIMS RELATING TO THE APP WILL NOT EXCEED THE AMOUNT YOU PAID (IF ANY) FOR THE APP IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.

10. Indemnity
- You agree to defend, indemnify, and hold us harmless from any claims, damages, liabilities, and expenses (including reasonable attorneys’ fees) arising out of your use of the App, your AWS configuration, or your violation of these Terms.

11. Termination
- We may suspend or terminate your license to use the App at any time if you violate these Terms. Upon termination, you must cease use and uninstall the App.

12. Export and Sanctions Compliance
- You agree to comply with all applicable export control and economic sanctions laws and regulations.

13. Governing Law; Venue
- These Terms are governed by the laws of the jurisdiction of our principal place of business, without regard to conflict of law principles. Courts located in that jurisdiction will have exclusive jurisdiction.

14. Changes to These Terms
- We may update these Terms from time to time. Material changes will be indicated by updating the effective date above. Your continued use of the App after changes become effective constitutes acceptance.

15. Contact
- For questions about these Terms, contact: support@cloudpass.dev
