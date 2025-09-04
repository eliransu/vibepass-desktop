## cloudpass.dev — AWS Secrets Manager setup guide

This guide shows how to enable team/enterprise storage for cloudpass.dev using AWS Secrets Manager (ASM) with AWS IAM Identity Center (SSO).

- Tags used on ASM secrets: App=cloudpass.dev, Scope=personal|work, OwnerUid=<uid|team>
- The app lists/manages only secrets tagged with `App=cloudpass.dev`.

### Prerequisites
- AWS account with IAM Identity Center (formerly AWS SSO) enabled
- AWS CLI v2 installed and configured on each user’s machine
- One or more AWS profiles configured via `aws configure sso`

### 1) Admin: grant yourself read/write on cloudpass.dev‑tagged secrets

Create or update a permission set that grants full control over ASM secrets tagged `App=cloudpass.dev`.

Policy (Administrator for cloudpass.dev secrets):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListSecretsForEneSecrets",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:ListSecrets"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ReadWriteEneSecretsTaggedSecrets",
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
      "Condition": { "StringEquals": { "aws:ResourceTag/App": "cloudpass.dev" } }
    },
    {
      "Sid": "CreateSecretsOnlyWithEneSecretsTag",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:CreateSecret"
      ],
      "Resource": "*",
      "Condition": { "StringEquals": { "aws:RequestTag/App": "cloudpass.dev" } }
    }
  ]
}
```

Notes:
- The app automatically creates secrets with tags: `App=cloudpass.dev`, `Scope=personal|work`, and `OwnerUid`.
- Some list actions require `Resource: "*"`. Read/write is constrained by tags via conditions.

### 2) Admin: provision access by role (personal vs work)

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
      "Condition": { "StringEquals": { "aws:ResourceTag/App": "cloudpass.dev" } }
    }
  ]
}
```

Contributor (create/update cloudpass.dev secrets):

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
      "Condition": { "StringEquals": { "aws:ResourceTag/App": "cloudpass.dev" } }
    },
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:CreateSecret"],
      "Resource": "*",
      "Condition": { "StringEquals": { "aws:RequestTag/App": "cloudpass.dev" } }

Work-only Editors (create/update work vaults, no delete):

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
      "Condition": {
        "StringEquals": { "aws:ResourceTag/App": "cloudpass.dev", "aws:ResourceTag/Scope": "work" }
      }
    },
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:CreateSecret"],
      "Resource": "*",
      "Condition": {
        "StringEquals": { "aws:RequestTag/App": "cloudpass.dev", "aws:RequestTag/Scope": "work" }
      }
    }
  ]
}
```

Personal CRUD (user can manage only their personal vaults by OwnerUid):

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
        "secretsmanager:DeleteSecret",
        "secretsmanager:RestoreSecret",
        "secretsmanager:ListSecretVersionIds",
        "secretsmanager:TagResource",
        "secretsmanager:UntagResource"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "aws:ResourceTag/App": "cloudpass.dev",
          "aws:ResourceTag/Scope": "personal",
          "aws:ResourceTag/OwnerUid": "${aws:PrincipalTag/uid}"
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:CreateSecret"],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "aws:RequestTag/App": "cloudpass.dev",
          "aws:RequestTag/Scope": "personal",
          "aws:RequestTag/OwnerUid": "${aws:PrincipalTag/uid}"
        }
      }
    }
  ]
}
```
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
3. In cloudpass.dev (top bar):
   - Select your AWS Profile and Region
   - Click SSO Login
   - The app will list and manage ASM secrets tagged `App=cloudpass.dev`

### 4) About metadata vs secrets

The app only writes the encrypted secret blob to your AWS account. Optionally, non‑sensitive metadata (e.g., titles/tags/categories, users/org) can be managed in our SaaS for collaboration features. Your secret values never leave your AWS account.

### Troubleshooting
- AWS CLI not found: install AWS CLI v2 and ensure it’s on PATH; you can set `AWS_CLI_PATH` before launching the app
- SSO expired: run `aws sso login --profile <your-profile>` and retry in the app
- Can’t see any items: verify the tag `App=cloudpass.dev` exists on the intended secrets and your role uses the policies above


