## Landing Page Creator LLM — Brief for cloudpass.dev

Goal
Create a single‑screen product landing page for cloudpass.dev that communicates a self‑hosted, enterprise‑grade password manager alternative to 1Password. The page should feel modern, clean, and fast, with a dark/light theme preview. Support both LTR and RTL layouts.

Audience
- AWS teams who want complete control over their password management infrastructure
- Enterprise organizations seeking cost‑effective alternatives to expensive SaaS password managers
- Security‑conscious teams who prefer self‑hosted solutions over third‑party services

Core Message
- cloudpass.dev is your own‑cloud alternative to 1Password. Deploy on your AWS infrastructure for 100% control, radical cost savings, and enterprise‑grade security without vendor lock‑in or third‑party breaches.

Tone and Style
- Authoritative, security‑focused, enterprise‑ready
- Emphasize ownership, cost savings, and security superiority over SaaS alternatives
- Modern, clean interface with professional appearance

Sections (content to be provided directly in copy)
1) Hero
   - Headline: "Your Own‑Cloud Alternative to 1Password"
   - Subheadline: "Deploy cloudpass.dev on your AWS infrastructure. 100% control, massive cost savings, zero third‑party risk."
   - Primary CTA: "Download Desktop App"
   - Secondary CTA: "Deploy on AWS"
   - Visual: Split comparison showing 1Password (SaaS) vs CloudPass (your AWS)

2) Why Teams Choose cloudpass.dev Over 1Password
   - Comparison table or grid:
     - "Your AWS account vs Their servers"
     - "~$0.50/user/month vs $8‑15/user/month"
     - "Your encryption keys vs Shared infrastructure"
     - "Your audit trail vs Third‑party dependency"
     - "Immune to SaaS breaches vs Regular targets"

3) Enterprise Features
   - Feature grid with enterprise focus:
     - Deploy on your AWS infrastructure
     - 95%+ cost reduction vs 1Password Business
     - Zero third‑party access to your secrets
     - Enterprise‑grade security in your environment
     - Separate vaults per team/project
     - Biometric unlock on macOS
     - Can be paid with your existing AWS credits

4) How it works (Your Infrastructure)
   - 3‑step deployment diagram:
     - "Deploy to your AWS account"
     - "Encrypted storage in your Secrets Manager"
     - "Team access with your IAM policies"

5) Security Advantage
   - Security comparison points:
     - "Your encryption keys never leave your infrastructure"
     - "Not a target for SaaS password manager breaches"
     - "Full audit trail in your CloudTrail"
     - "Enterprise security within your controlled environment"

6) Cost Comparison
   - Simple cost calculator section:
     - "Calculate Your Savings"
     - "1Password Business: $8/user/month"
     - "cloudpass.dev + AWS: ~$0.50/user/month"
     - "Save 93%+ annually"
     - "Use your existing AWS credits"

7) Current Limitations (Honest)
   - "What We're Building Next"
   - "Browser extensions (coming Q2 2024)"
   - "Mobile apps (coming Q3 2024)"
   - "Desktop app available now"

8) CTA block
   - Headline: "Take Control of Your Password Infrastructure"
   - Primary button: "Deploy on Your AWS"
   - Secondary button: "Download Desktop App"

Requirements for the LLM output
- Provide HTML + Tailwind classes
- Include a data‑attribute `data-dir` on `<html>` root. The page must switch direction by setting `dir` to `rtl` when current language is Hebrew; otherwise `ltr`.
- Include both dark and light classes in examples; prefer neutral colors from Tailwind tokens.
- Emphasize enterprise/AWS branding colors and professional appearance

SEO
- Title: "cloudpass.dev: Self‑Hosted 1Password Alternative for AWS Teams"
- Description: "Deploy your own password manager on AWS. 95%+ cost savings, 100% control, zero third‑party risk. Enterprise alternative to 1Password."
- Social image placeholder and Open Graph tags

Deliverables
- One HTML file (no JS frameworks required) with TailwindCDN
- Simple language switch mock (buttons) that toggles `dir` and `lang` attributes
- Cost calculator component (simple)
- Comparison table highlighting advantages over 1Password

References
- Product README and features: ./README.md
- Messaging cues: ./marketing.md
