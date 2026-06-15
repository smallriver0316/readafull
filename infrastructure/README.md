# Readafull Infrastructure

AWS CDK infrastructure code for the Readafull mobile application.

## Overview

This directory contains the Infrastructure as Code (IaC) for deploying the Readafull application on AWS using the AWS Cloud Development Kit (CDK).

## Architecture

The infrastructure is organized into four main stacks:

1. **Auth Stack** - Amazon Cognito user authentication with social login support
2. **Storage Stack** - DynamoDB tables and S3 buckets for data storage
3. **API Stack** - API Gateway and Lambda functions for business logic
4. **Monitoring Stack** - CloudWatch dashboards, alarms, and X-Ray tracing

## Prerequisites

- Node.js 24 or later
- AWS CLI configured with appropriate credentials
- AWS CDK CLI (installed via npm)
- An AWS account with sufficient permissions

## Setup

Run the setup script to install dependencies and bootstrap CDK:

```bash
cd infrastructure
./scripts/setup.sh
```

This will:
- Install npm dependencies
- Build TypeScript code
- Bootstrap CDK in your AWS account (if not already done)

## Deployment

### Development Environment

```bash
npm run cdk:deploy:dev
```

Or using the deployment script:

```bash
./scripts/deploy.sh development
```

Add `-y` to skip the confirmation prompt (useful for CI/CD):

```bash
./scripts/deploy.sh development -y
```

### Staging Environment

```bash
npm run cdk:deploy:staging
```

Or:

```bash
./scripts/deploy.sh staging
```

Add `-y` to skip the confirmation prompt (useful for CI/CD):

```bash
./scripts/deploy.sh staging -y
```

### Production Environment

```bash
npm run cdk:deploy:prod
```

Or:

```bash
./scripts/deploy.sh production
```

## Configuration

Environment-specific configurations are located in `config/environment.ts`. Each environment has its own settings for:

- Cognito user pools
- DynamoDB tables
- S3 buckets
- API Gateway throttling
- Lambda function settings
- Monitoring and logging

## Available Commands

- `npm run build` - Compile TypeScript to JavaScript
- `npm run watch` - Watch for changes and recompile
- `npm run test` - Run unit tests
- `npm run cdk:synth` - Synthesize CloudFormation templates
- `npm run cdk:diff` - Compare deployed stack with current state
- `npm run cdk:deploy` - Deploy all stacks
- `npm run cdk:destroy` - Destroy all stacks

## Lambda Functions

Lambda function code is organized in the `lambda/` directory:

- `auth-triggers/` - Cognito triggers (e.g. post-confirmation profile creation)
- `custom-resources/` - CloudFormation Custom Resource handlers (e.g. social IdP registration)
- `text-generation/` - Bedrock text generation service
- `translation/` - Amazon Translate integration
- `tts-generation/` - Amazon Polly TTS service
- `audio-processing/` - S3 audio file processing
- `user-profile/` - User management and preferences

Note: Currently, Lambda functions contain placeholder implementations. These will be implemented in subsequent tasks.

## Project Structure

```
infrastructure/
├── bin/                    # CDK app entry point
│   └── readafull.ts       # Main CDK application
├── lib/                   # CDK stack definitions
│   ├── auth-stack.ts      # Cognito authentication
│   ├── storage-stack.ts   # DynamoDB and S3
│   ├── api-stack.ts       # API Gateway and Lambda
│   └── monitoring-stack.ts # CloudWatch and X-Ray
├── lambda/                # Lambda function code
│   ├── text-generation/
│   ├── translation/
│   ├── tts-generation/
│   ├── audio-processing/
│   └── user-profile/
├── config/                # Environment configurations
│   └── environment.ts
├── scripts/               # Deployment scripts
│   ├── setup.sh
│   ├── deploy.sh
│   └── destroy.sh
├── cdk.json              # CDK configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Dependencies and scripts
```

## Social Login Configuration

Social identity providers (Google, Facebook, Login with Amazon) are managed by CDK using credentials stored in AWS Systems Manager Parameter Store. Each provider is registered by a **Lambda-backed Custom Resource** (`lambda/custom-resources/socialIdpProvider.ts`) that reads the credentials via the AWS SDK at deploy time and calls the Cognito `CreateIdentityProvider` / `UpdateIdentityProvider` / `DeleteIdentityProvider` APIs directly. The synthesized CloudFormation template only contains the SSM parameter **names** — neither the secret values nor any `{{resolve:...}}` reference to them appears in the template or stack events.

> ✅ **Client secrets are stored as `SecureString` (encrypted at rest).** CloudFormation does not support the `{{resolve:ssm-secure:...}}` dynamic reference for `AWS::Cognito::UserPoolIdentityProvider/ProviderDetails/client_secret`, which previously forced us to store secrets as plain `String`. The Custom Resource works around that limitation: it fetches each parameter with `WithDecryption: true`, so secrets can — and should — be registered as `SecureString`. The provider Lambda's IAM role is scoped to `ssm:GetParameter*` on `/readafull/<env>/auth/*`, `kms:Decrypt` via the SSM service only, and the four `cognito-idp:*IdentityProvider` actions on this user pool.
>
> **Non-secret IDs** (`client-id`, `app-id`) may stay as `String` — they are public. `WithDecryption: true` is a no-op for `String` parameters, so either type works.
>
> **Rotating a secret:** update the SSM value, then redeploy. The Custom Resource re-runs and applies the latest decrypted value whenever its CloudFormation properties change (e.g. on any stack update touching the Auth stack). To force a refresh without other changes, run `cdk deploy` after bumping the parameter — the handler always performs an upsert with the freshly fetched value.

> **Apple Sign-In is temporarily disabled** because the Apple Developer Program requires a paid membership. The Apple-related infrastructure code, env flag (`READAFULL_AUTH_APPLE_ENABLED`), and SSM parameter paths are kept commented out in the codebase. When the Developer Program enrollment is complete, restore them in `infrastructure/config/environment.ts`, `infrastructure/lib/auth-stack.ts`, `infrastructure/test/auth-stack.test.ts`, and the commented section of this README.

### 1. Store credentials in SSM Parameter Store

For each environment (`development` / `staging` / `production`), register the parameters below. **Secrets use `SecureString`; public IDs use `String`** — see the note above.

```bash
ENV=development  # or staging | production

# Google
aws ssm put-parameter --name "/readafull/$ENV/auth/google/client-id" \
  --type String --value "<google-oauth-client-id>"
aws ssm put-parameter --name "/readafull/$ENV/auth/google/client-secret" \
  --type SecureString --value "<google-oauth-client-secret>"

# Facebook
aws ssm put-parameter --name "/readafull/$ENV/auth/facebook/app-id" \
  --type String --value "<facebook-app-id>"
aws ssm put-parameter --name "/readafull/$ENV/auth/facebook/app-secret" \
  --type SecureString --value "<facebook-app-secret>"

# Login with Amazon
aws ssm put-parameter --name "/readafull/$ENV/auth/amazon/client-id" \
  --type String --value "<amazon-lwa-client-id>"
aws ssm put-parameter --name "/readafull/$ENV/auth/amazon/client-secret" \
  --type SecureString --value "<amazon-lwa-client-secret>"

# Apple (DEFERRED — requires paid Apple Developer Program enrollment)
# aws ssm put-parameter --name "/readafull/$ENV/auth/apple/services-id" \
#   --type String --value "<apple-services-id>"
# aws ssm put-parameter --name "/readafull/$ENV/auth/apple/team-id" \
#   --type String --value "<apple-team-id>"
# aws ssm put-parameter --name "/readafull/$ENV/auth/apple/key-id" \
#   --type String --value "<apple-key-id>"
# aws ssm put-parameter --name "/readafull/$ENV/auth/apple/private-key" \
#   --type SecureString --value "$(cat AuthKey_XXXX.p8)"
```

> **Migrating from a previous `String` registration?** SSM does **not** allow changing an existing parameter's type with `--overwrite`, so delete the plain-`String` secrets first, then recreate them as `SecureString`:
> ```bash
> aws ssm delete-parameters --names \
>   "/readafull/$ENV/auth/google/client-secret" \
>   "/readafull/$ENV/auth/facebook/app-secret" \
>   "/readafull/$ENV/auth/amazon/client-secret"
> # then re-run the SecureString put-parameter commands above
> ```

### 2. Opt-in providers at deploy time

Providers are opt-in via environment variables so missing credentials never break a deployment. Enable each provider only after its SSM parameters are registered:

```bash
READAFULL_AUTH_GOOGLE_ENABLED=true \
READAFULL_AUTH_FACEBOOK_ENABLED=true \
READAFULL_AUTH_AMAZON_ENABLED=true \
./scripts/deploy.sh development

# Apple (DEFERRED): once the Developer Program enrollment is complete and
# the apple-related code is uncommented, add the flag below.
# READAFULL_AUTH_APPLE_ENABLED=true \
```

When a flag is unset (or set to anything other than `true`/`1`), the corresponding identity provider is omitted from the User Pool and the User Pool Client only advertises providers that are actually configured.

### 3. Post-confirmation trigger

A Lambda trigger (`lambda/auth-triggers/postConfirmation.ts`) is attached to the User Pool. When a user (including federated sign-ups) confirms for the first time, it creates the corresponding profile item in the main DynamoDB table (`PK=USER#<sub>, SK=PROFILE#main`) with default learner preferences. The write is idempotent — repeated invocations for the same user are ignored.

## Monitoring

After deployment, you can access:

- CloudWatch Dashboard: Check the `DashboardUrl` output from the Monitoring Stack
- CloudWatch Logs: `/aws/lambda/<function-name>`
- X-Ray Traces: AWS X-Ray console

Alarms are configured for:
- Lambda function errors
- Lambda function throttles
- Lambda function duration (approaching timeout)
- API Gateway 4XX/5XX errors

## Destroying Infrastructure

To destroy all infrastructure (use with caution):

```bash
npm run cdk:destroy
```

Or using the destruction script with safety confirmation:

```bash
./scripts/destroy.sh development
```

## Next Steps

1. Configure social identity providers in Cognito User Pool
2. Implement Lambda function code for each service
3. Set up CI/CD pipeline for automated deployments
4. Configure custom domain for API Gateway
5. Set up CloudFront distribution for global performance

## Support

For issues or questions, please refer to the main project documentation or create an issue in the repository.
