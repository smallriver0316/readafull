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

- Node.js 18 or later
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

### Staging Environment

```bash
npm run cdk:deploy:staging
```

Or:

```bash
./scripts/deploy.sh staging
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

After deploying the Auth Stack, you need to manually configure social identity providers in the Cognito User Pool:

1. Google: Add Google OAuth client ID and secret
2. Facebook: Add Facebook App ID and secret
3. Apple: Add Apple Sign In credentials

These cannot be added via CDK due to security best practices (credentials should not be in code).

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
