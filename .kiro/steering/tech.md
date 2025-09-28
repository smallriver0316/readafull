# Technology Stack

## Platform Architecture

- **Primary Target**: React Native mobile application
- **Backend**: AWS serverless cloud infrastructure
- **Secondary Target**: Web application (extended feature)
- **Development Approach**: Cloud-native, serverless-first architecture

## AWS Cloud Services

### Core Infrastructure

- **AWS CDK**: Infrastructure as Code for reproducible deployments
- **Amazon API Gateway**: RESTful API endpoints with built-in security
- **AWS Lambda**: Serverless compute for business logic
- **Amazon Cognito**: User authentication and authorization
- **Amazon DynamoDB**: NoSQL database with single-table design
- **Amazon S3**: Object storage for audio files and static assets

### AI/ML Services

- **Amazon Bedrock**: Foundation models for text generation (Claude/GPT)
- **Amazon Polly**: Neural text-to-speech with natural voices
- **Amazon Translate**: Real-time language translation (English ↔ Japanese)
- **Amazon Transcribe**: Speech-to-text (for future pronunciation analysis)

### Performance & Monitoring

- **Amazon ElastiCache (Redis)**: Caching layer for frequently accessed content
- **Amazon CloudWatch**: Metrics, logging, and monitoring
- **AWS X-Ray**: Distributed tracing and performance analysis

## Mobile Technology Stack

- **Frontend Framework**: React Native with TypeScript
- **AWS Integration**: AWS Amplify SDK for seamless cloud connectivity
- **State Management**: React Context API with custom hooks
- **Audio Processing**: react-native-audio-recorder-player
- **Navigation**: React Navigation with authentication guards
- **Testing**: Jest + React Native Testing Library

## Development Environment

- **Language**: TypeScript for type safety and better developer experience
- **Package Management**: npm/yarn for dependency management
- **Version Control**: Git with conventional commit standards
- **License**: MIT License for open source development
- **IDE Integration**: AWS Toolkit for VS Code

## Common Commands

```bash
# Infrastructure Management
npm run cdk:deploy          # Deploy AWS infrastructure
npm run cdk:destroy         # Tear down AWS resources
npm run cdk:diff           # Show infrastructure changes

# Mobile Development
npm install                # Install dependencies
npm run start              # Start React Native metro bundler
npm run ios                # Run on iOS simulator
npm run android            # Run on Android emulator
npm run build:ios          # Build iOS release
npm run build:android      # Build Android release

# Testing & Quality
npm test                   # Run unit tests
npm run test:integration   # Run integration tests
npm run lint               # Run ESLint
npm run type-check         # TypeScript type checking

# AWS Lambda Development
npm run lambda:build       # Build Lambda functions
npm run lambda:test        # Test Lambda functions locally
npm run lambda:deploy      # Deploy individual Lambda functions
```

## Architecture Principles

### Serverless-First Design

- Auto-scaling compute with AWS Lambda
- Pay-per-use pricing model
- No server management overhead
- Built-in high availability and fault tolerance

### Security by Design

- AWS IAM roles with least privilege access
- API Gateway with Cognito authorization
- Encryption at rest (S3, DynamoDB) and in transit (HTTPS/TLS)
- VPC isolation for sensitive operations

### Performance Optimization

- Multi-layer caching strategy (ElastiCache, API Gateway, mobile app)
- CDN distribution via CloudFront for global performance
- Lambda function optimization for cold start reduction
- Efficient DynamoDB access patterns with GSI

### Cost Management

- On-demand billing for unpredictable workloads
- S3 lifecycle policies for audio file cost optimization
- Lambda ARM-based Graviton2 processors for better price-performance
- ElastiCache for reducing expensive AI API calls

### Monitoring & Observability

- Comprehensive CloudWatch metrics and alarms
- X-Ray tracing for end-to-end request visibility
- Custom business metrics for user engagement tracking
- Automated error reporting and alerting

## Development Workflow

1. **Local Development**: Use AWS SAM CLI for local Lambda testing
2. **Infrastructure Changes**: CDK for version-controlled infrastructure updates
3. **Mobile Development**: React Native with Amplify for rapid prototyping
4. **Testing Strategy**: Unit tests for Lambda functions, integration tests for AWS services
5. **Deployment**: Automated CI/CD pipeline with staging and production environments
