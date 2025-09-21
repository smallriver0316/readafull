# Project Structure

## Current Organization

```
readafull/
├── docs/                    # Project documentation
│   └── concept.md          # Product concept and feature specifications
├── .kiro/                  # Kiro AI assistant configuration
│   ├── specs/              # Feature specifications and implementation plans
│   └── steering/           # AI guidance documents
├── LICENSE                 # MIT license
├── README.md              # Project overview
└── .gitignore             # Git ignore rules (Node.js focused)
```

## AWS Cloud-Native Structure (To be implemented)

```
readafull/
├── infrastructure/          # AWS CDK infrastructure code
│   ├── lib/                # CDK stack definitions
│   │   ├── auth-stack.ts   # Cognito authentication resources
│   │   ├── api-stack.ts    # API Gateway and Lambda functions
│   │   ├── storage-stack.ts # DynamoDB and S3 resources
│   │   └── monitoring-stack.ts # CloudWatch and X-Ray setup
│   ├── lambda/             # Lambda function source code
│   │   ├── text-generation/ # Bedrock text generation service
│   │   ├── translation/    # Amazon Translate integration
│   │   ├── tts-generation/ # Amazon Polly TTS service
│   │   ├── audio-processing/ # S3 audio file processing
│   │   └── user-profile/   # User management and preferences
│   └── cdk.json           # CDK configuration
├── mobile/                 # React Native mobile application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   │   ├── auth/       # Authentication components
│   │   │   ├── audio/      # Audio recording/playback components
│   │   │   ├── text/       # Text display and generation components
│   │   │   └── common/     # Shared UI components
│   │   ├── screens/        # Application screens
│   │   │   ├── AuthScreen.tsx      # Sign in/up screens
│   │   │   ├── PracticeScreen.tsx  # Main practice interface
│   │   │   ├── ContentScreen.tsx   # Content management
│   │   │   └── SettingsScreen.tsx  # User settings and profile
│   │   ├── services/       # AWS service integrations
│   │   │   ├── auth/       # Cognito authentication service
│   │   │   ├── api/        # API Gateway client
│   │   │   ├── audio/      # Audio recording and S3 upload
│   │   │   └── storage/    # Local storage and caching
│   │   ├── hooks/          # Custom React hooks
│   │   ├── utils/          # Utility functions and helpers
│   │   ├── types/          # TypeScript type definitions
│   │   └── config/         # App configuration and constants
│   ├── assets/             # Static assets (images, sounds)
│   ├── __tests__/          # Mobile app tests
│   └── amplify/            # AWS Amplify configuration
├── shared/                 # Shared code between mobile and Lambda
│   ├── types/              # Common TypeScript interfaces
│   ├── utils/              # Shared utility functions
│   └── constants/          # Shared constants and enums
├── tests/                  # Integration and E2E tests
│   ├── integration/        # AWS service integration tests
│   ├── e2e/               # End-to-end mobile app tests
│   └── fixtures/          # Test data and mocks
├── docs/                   # Documentation
│   ├── api/               # API documentation
│   ├── deployment/        # Deployment guides
│   └── architecture/      # Architecture diagrams and decisions
├── scripts/               # Build and deployment scripts
│   ├── deploy.sh          # Deployment automation
│   ├── test.sh           # Test execution scripts
│   └── setup.sh          # Environment setup
└── config/                # Configuration files
    ├── environments/      # Environment-specific configs
    └── aws/              # AWS service configurations
```

## Key Directories Purpose

### Infrastructure Layer (`infrastructure/`)

- **lib/**: CDK stack definitions for modular AWS resource management
- **lambda/**: Serverless function implementations for each business capability
- Each Lambda function is self-contained with its own dependencies and tests

### Mobile Application (`mobile/`)

- **components/**: Reusable UI components organized by feature domain
- **screens/**: Top-level application screens with navigation integration
- **services/**: AWS service integrations with proper error handling and caching
- **hooks/**: Custom React hooks for state management and AWS service integration

### Shared Code (`shared/`)

- **types/**: TypeScript interfaces shared between mobile app and Lambda functions
- **utils/**: Common utility functions used across different parts of the system
- **constants/**: Shared enums, error codes, and configuration constants

## File Naming Conventions

### Infrastructure Code

- CDK stacks: `kebab-case-stack.ts` (e.g., `auth-stack.ts`)
- Lambda functions: `camelCase.ts` for handlers (e.g., `textGeneration.ts`)
- CDK constructs: `PascalCase.ts` (e.g., `ReadafullApi.ts`)

### Mobile Application

- React components: `PascalCase.tsx` (e.g., `AudioRecorder.tsx`)
- Service files: `camelCase.ts` (e.g., `authService.ts`)
- Screen components: `PascalCaseScreen.tsx` (e.g., `PracticeScreen.tsx`)
- Custom hooks: `use + PascalCase.ts` (e.g., `useAudioRecording.ts`)

### Testing

- Unit tests: `*.test.ts` or `*.test.tsx`
- Integration tests: `*.integration.test.ts`
- E2E tests: `*.e2e.test.ts`

## Module Organization Principles

### Separation of Concerns

- **Infrastructure**: AWS resources and serverless functions
- **Mobile**: User interface and client-side logic
- **Shared**: Common code to avoid duplication

### Domain-Driven Structure

- Group related functionality by business domain (auth, audio, text, etc.)
- Each domain has its own components, services, and types
- Clear boundaries between different feature areas

### AWS Service Integration

- Each AWS service has its own service module with proper abstraction
- Error handling and retry logic encapsulated within service modules
- Configuration and credentials managed centrally

### Testing Strategy

- Unit tests co-located with source code
- Integration tests in dedicated test directory
- Mocks and fixtures organized by test type

## Import/Export Patterns

### Barrel Exports

```typescript
// src/components/index.ts
export { AudioRecorder } from './audio/AudioRecorder';
export { TextDisplay } from './text/TextDisplay';
export { AuthForm } from './auth/AuthForm';
```

### Service Abstractions

```typescript
// src/services/index.ts
export { authService } from './auth/authService';
export { apiService } from './api/apiService';
export { audioService } from './audio/audioService';
```

### Type Definitions

```typescript
// shared/types/index.ts
export type { User, UserPreferences } from './auth';
export type { TextContent, AudioSession } from './content';
export type { APIResponse, ErrorResponse } from './api';
```

This structure supports the AWS cloud-native architecture while maintaining clear separation between infrastructure, mobile application, and shared code components.
