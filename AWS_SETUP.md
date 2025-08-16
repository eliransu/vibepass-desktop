## VibePass — AWS Secrets Manager setup guide

This guide shows how to enable team/enterprise storage for VibePass using AWS Secrets Manager (ASM) with AWS IAM Identity Center (SSO).

- Tag used by VibePass on ASM secrets: App=VibePass
- VibePass lists and manages only secrets tagged with the key App and value VibePass.

### Prerequisites
- AWS account with IAM Identity Center (formerly AWS SSO) enabled
- AWS CLI v2 installed and configured on each user’s machine
- One or more AWS profiles configured via `aws configure sso`

### 1) Admin: grant yourself read/write on VibePass‑tagged secrets

Create or update an IAM policy or permission set that grants full control over ASM secrets that have the tag App=VibePass.

Policy (Administrator for VibePass secrets):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListSecretsForVibePass",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:ListSecrets"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ReadWriteVibePassTaggedSecrets",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:DescribeSecret",
        "secretsmanager:GetSecretValue",
        "secretsmanager:PutSecretValue",
        "secretsmanager:DeleteSecret",
        "secretsmanager:RestoreSecret",
        "secretsmanager:ListSecretVersionIds",
        "secretsmanager:TagResource",
        "secretsmanager:UntagResource"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": { "aws:ResourceTag/App": "VibePass" }
      }
    },
    {
      "Sid": "CreateSecretsOnlyWithVibePassTag",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:CreateSecret"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": { "aws:RequestTag/App": "VibePass" }
      }
    }
  ]
}
```

Notes:
- VibePass automatically creates secrets with the tag App=VibePass. If you have existing secrets you want visible in VibePass, add that tag.
- Some list actions require `Resource: "*"`. Read/write is constrained to resources where `aws:ResourceTag/App` equals `VibePass`.

### 2) Admin: provision team access by role

Create permission sets (or roles/policies) for different team needs. Apply the same tag conditions.

Read‑only (view secrets only):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["secretsmanager:ListSecrets"], "Resource": "*" },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:DescribeSecret",
        "secretsmanager:GetSecretValue",
        "secretsmanager:ListSecretVersionIds"
      ],
      "Resource": "*",
      "Condition": { "StringEquals": { "aws:ResourceTag/App": "VibePass" } }
    }
  ]
}
```

Contributor (create/update VibePass secrets):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["secretsmanager:ListSecrets"], "Resource": "*" },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:DescribeSecret",
        "secretsmanager:GetSecretValue",
        "secretsmanager:PutSecretValue",
        "secretsmanager:ListSecretVersionIds",
        "secretsmanager:TagResource",
        "secretsmanager:UntagResource"
      ],
      "Resource": "*",
      "Condition": { "StringEquals": { "aws:ResourceTag/App": "VibePass" } }
    },
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:CreateSecret"],
      "Resource": "*",
      "Condition": { "StringEquals": { "aws:RequestTag/App": "VibePass" } }
    }
  ]
}
```

If you want a maintainer role that can also delete, add `secretsmanager:DeleteSecret` to the contributor policy.

### 3) Users: sign in with your organization domain (SSO)

On each user’s machine:

1. Configure an AWS CLI profile with SSO:
   - Run: `aws configure sso`
   - Choose your organization’s Identity Center URL and SSO region
   - Select the account and permission set you were granted
   - Name the profile (e.g., `work`)
2. Log in: `aws sso login --profile work`
3. In VibePass (top bar):
   - Select your AWS Profile and Region
   - Click SSO Login
   - VibePass will list and manage ASM secrets tagged `App=VibePass`

### 4) About metadata vs secrets

VibePass only writes the encrypted secret blob to your AWS account. Optionally, non‑sensitive metadata (e.g., titles/tags/categories, users/org) can be managed in our SaaS for collaboration features. Your secret values never leave your AWS account.

### Troubleshooting
- AWS CLI not found: install AWS CLI v2 and ensure it’s on PATH; you can set `AWS_CLI_PATH` before launching VibePass
- SSO expired: run `aws sso login --profile <your-profile>` and retry in VibePass
- Can’t see any items: verify the tag `App=VibePass` exists on the intended secrets and your role uses the policies above


