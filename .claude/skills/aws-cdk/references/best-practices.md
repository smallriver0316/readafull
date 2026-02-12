# AWS CDK Best Practices

This reference provides best practices for CDK development. Load this when making architectural decisions or optimizing CDK code.

## Table of Contents

1. [Project Organization](#project-organization)
2. [Security Best Practices](#security-best-practices)
3. [Performance and Cost Optimization](#performance-and-cost-optimization)
4. [Testing Best Practices](#testing-best-practices)
5. [Deployment Best Practices](#deployment-best-practices)
6. [Code Quality](#code-quality)

## Project Organization

### Stack Organization

**DO:**
- Create separate stacks for different lifecycle stages (network, database, application)
- Keep related resources in the same stack
- Limit stack size to ~200 resources for manageable deployments

```typescript
// Good: Organized by lifecycle
new NetworkStack(app, 'Network');
new DatabaseStack(app, 'Database', { vpc: networkStack.vpc });
new ApplicationStack(app, 'Application', { vpc: networkStack.vpc, db: dbStack.db });
```

**DON'T:**
- Mix dev and prod resources in the same stack
- Create too many small stacks (increases complexity)

### Construct Hierarchy

**DO:**
- Create reusable constructs for repeated patterns
- Use composition over inheritance
- Keep constructs focused on single responsibility

```typescript
// Good: Reusable construct
export class ApiLambdaConstruct extends Construct {
  public readonly api: apigateway.RestApi;
  public readonly handler: lambda.Function;

  constructor(scope: Construct, id: string, props: ApiLambdaProps) {
    super(scope, id);

    this.handler = new lambda.Function(this, 'Handler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      code: lambda.Code.fromAsset(props.codePath),
      handler: props.handler,
      environment: props.environment,
    });

    this.api = new apigateway.RestApi(this, 'Api', {
      restApiName: props.apiName,
    });

    const integration = new apigateway.LambdaIntegration(this.handler);
    this.api.root.addMethod('ANY', integration);
  }
}
```

### Environment Configuration

**DO:**
- Use CDK context for environment-specific values
- Externalize configuration from code
- Use Parameter Store or Secrets Manager for sensitive data

```typescript
// cdk.json
{
  "context": {
    "dev": {
      "instanceType": "t3.small",
      "maxCapacity": 2
    },
    "prod": {
      "instanceType": "m5.large",
      "maxCapacity": 10
    }
  }
}

// In code
const envConfig = this.node.tryGetContext(props.environment);
```

**DON'T:**
- Hard-code environment-specific values
- Commit secrets to version control

## Security Best Practices

### Always Use CDK Nag

**DO:**
- Integrate CDK Nag in all projects
- Run checks before deployment
- Fix violations rather than suppress them

```typescript
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';

// Apply to entire app
AwsSolutionsChecks.check(app);

// Only suppress with valid justification
NagSuppressions.addResourceSuppressions(
  myConstruct,
  [
    {
      id: 'AwsSolutions-IAM4',
      reason: 'AWS managed policy required for AWS service integration',
    },
  ]
);
```

### IAM Permissions

**DO:**
- Use least privilege principle
- Grant permissions at resource level, not wildcards
- Use grant methods over manual policy creation

```typescript
// Good: Specific permissions
table.grantReadWriteData(myFunction);
bucket.grantRead(myFunction);

// Good: Limited actions
myFunction.addToRolePolicy(new iam.PolicyStatement({
  actions: ['dynamodb:GetItem', 'dynamodb:PutItem'],
  resources: [table.tableArn],
}));
```

**DON'T:**
- Use wildcard permissions (`*`)
- Grant `AdministratorAccess` to Lambda functions
- Use AWS managed policies unless required

```typescript
// Bad: Overly permissive
myFunction.addToRolePolicy(new iam.PolicyStatement({
  actions: ['dynamodb:*'],
  resources: ['*'],
}));
```

### Secrets Management

**DO:**
- Use Secrets Manager for sensitive data
- Rotate secrets regularly
- Use environment variables for non-sensitive config

```typescript
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

const secret = new secretsmanager.Secret(this, 'DbSecret', {
  generateSecretString: {
    secretStringTemplate: JSON.stringify({ username: 'admin' }),
    generateStringKey: 'password',
    excludePunctuation: true,
  },
});

// Grant read access
secret.grantRead(myFunction);

// Pass secret ARN, not value
myFunction.addEnvironment('SECRET_ARN', secret.secretArn);
```

**DON'T:**
- Store secrets in code or environment variables
- Log sensitive information

### Encryption

**DO:**
- Enable encryption at rest for all data stores
- Use AWS KMS for sensitive data
- Enable encryption in transit (HTTPS/TLS)

```typescript
// DynamoDB with encryption
const table = new dynamodb.Table(this, 'Table', {
  encryption: dynamodb.TableEncryption.AWS_MANAGED,
  pointInTimeRecovery: true,
});

// S3 with encryption
const bucket = new s3.Bucket(this, 'Bucket', {
  encryption: s3.BucketEncryption.S3_MANAGED,
  enforceSSL: true,
});
```

### Network Security

**DO:**
- Use VPC for resources that need network isolation
- Implement security groups with minimal access
- Use private subnets for databases and compute

```typescript
const vpc = new ec2.Vpc(this, 'Vpc', {
  maxAzs: 2,
  natGateways: 1,
});

const dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSg', {
  vpc,
  description: 'Database security group',
  allowAllOutbound: false,
});

// Only allow access from Lambda security group
dbSecurityGroup.addIngressRule(
  lambdaSg,
  ec2.Port.tcp(5432),
  'Allow PostgreSQL from Lambda'
);
```

## Performance and Cost Optimization

### Lambda Optimization

**DO:**
- Right-size memory and timeout
- Use ARM (Graviton2) for cost savings
- Implement connection pooling for databases
- Use Lambda layers for shared dependencies

```typescript
const fn = new lambda.Function(this, 'Function', {
  runtime: lambda.Runtime.NODEJS_20_X,
  architecture: lambda.Architecture.ARM_64, // 20% cost reduction
  memorySize: 1024, // Right-sized
  timeout: Duration.seconds(30), // Not default 3 seconds
  handler: 'index.handler',
  code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
  layers: [sharedLayer], // Reuse dependencies
});
```

**DON'T:**
- Use maximum timeout/memory for all functions
- Include large dependencies in every function

### DynamoDB Optimization

**DO:**
- Use on-demand billing for unpredictable workloads
- Implement provisioned capacity for predictable, consistent workloads
- Use DynamoDB Accelerator (DAX) for read-heavy workloads
- Design efficient partition keys

```typescript
// On-demand for variable workload
const table = new dynamodb.Table(this, 'Table', {
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
});

// Auto-scaling for predictable workload
const provisionedTable = new dynamodb.Table(this, 'ProvisionedTable', {
  billingMode: dynamodb.BillingMode.PROVISIONED,
  readCapacity: 5,
  writeCapacity: 5,
});

provisionedTable.autoScaleReadCapacity({
  minCapacity: 5,
  maxCapacity: 100,
}).scaleOnUtilization({ targetUtilizationPercent: 70 });
```

### S3 Cost Optimization

**DO:**
- Implement lifecycle policies
- Use appropriate storage classes
- Enable intelligent tiering for unknown access patterns

```typescript
const bucket = new s3.Bucket(this, 'Bucket', {
  lifecycleRules: [
    {
      transitions: [
        {
          storageClass: s3.StorageClass.INFREQUENT_ACCESS,
          transitionAfter: Duration.days(30),
        },
        {
          storageClass: s3.StorageClass.GLACIER,
          transitionAfter: Duration.days(90),
        },
      ],
      expiration: Duration.days(365),
    },
  ],
  intelligentTieringConfigurations: [
    {
      name: 'archive',
      archiveAccessTierTime: Duration.days(90),
      deepArchiveAccessTierTime: Duration.days(180),
    },
  ],
});
```

## Testing Best Practices

### Unit Testing

**DO:**
- Test construct properties and configuration
- Use fine-grained assertions
- Test error conditions

```typescript
import { Template, Match } from 'aws-cdk-lib/assertions';

test('Lambda function has correct configuration', () => {
  const stack = new Stack();
  new MyConstruct(stack, 'Test');

  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::Lambda::Function', {
    Runtime: 'nodejs20.x',
    Timeout: 30,
    MemorySize: 512,
  });

  template.resourceCountIs('AWS::Lambda::Function', 1);
});
```

### Snapshot Testing

**DO:**
- Use snapshot tests to detect unintended changes
- Review snapshot diffs carefully

```typescript
test('Stack snapshot', () => {
  const app = new App();
  const stack = new MyStack(app, 'Test');

  expect(Template.fromStack(stack).toJSON()).toMatchSnapshot();
});
```

### Integration Testing

**DO:**
- Test deployed resources in non-prod environment
- Validate actual AWS behavior
- Clean up test resources

```typescript
// Integration test example
describe('Integration Tests', () => {
  beforeAll(async () => {
    // Deploy test stack
    await deployStack();
  });

  test('API returns expected response', async () => {
    const response = await fetch(apiUrl);
    expect(response.status).toBe(200);
  });

  afterAll(async () => {
    // Clean up
    await destroyStack();
  });
});
```

## Deployment Best Practices

### CI/CD Pipeline

**DO:**
- Use CDK Pipelines for self-mutating pipelines
- Implement manual approval for production
- Run CDK Nag in pipeline

```typescript
import { CodePipeline, CodePipelineSource, ShellStep } from 'aws-cdk-lib/pipelines';

const pipeline = new CodePipeline(this, 'Pipeline', {
  synth: new ShellStep('Synth', {
    input: CodePipelineSource.gitHub('org/repo', 'main'),
    commands: [
      'npm ci',
      'npm run build',
      'npx cdk synth',
    ],
  }),
});

// Add stages
pipeline.addStage(new ApplicationStage(this, 'Dev'));

const prodStage = new ApplicationStage(this, 'Prod');
pipeline.addStage(prodStage, {
  pre: [new ManualApprovalStep('PromoteToProd')],
});
```

### Deployment Strategy

**DO:**
- Use CloudFormation change sets to review changes
- Implement blue/green deployments for zero-downtime
- Tag resources for cost tracking

```typescript
// Tags for all resources in stack
Tags.of(this).add('Environment', props.environment);
Tags.of(this).add('Project', 'MyProject');
Tags.of(this).add('CostCenter', '12345');
```

### Rollback Strategy

**DO:**
- Test rollback procedures
- Keep previous versions for quick rollback
- Monitor deployments with CloudWatch Alarms

```typescript
// Lambda alias with traffic shifting
const version = fn.currentVersion;
const alias = new lambda.Alias(this, 'Alias', {
  aliasName: 'prod',
  version,
});

// Gradual deployment with automatic rollback
new codedeploy.LambdaDeploymentGroup(this, 'DeploymentGroup', {
  alias,
  deploymentConfig: codedeploy.LambdaDeploymentConfig.LINEAR_10PERCENT_EVERY_1MINUTE,
  alarms: [
    new cloudwatch.Alarm(this, 'Errors', {
      metric: fn.metricErrors(),
      threshold: 1,
      evaluationPeriods: 1,
    }),
  ],
});
```

## Code Quality

### Type Safety

**DO:**
- Use TypeScript for CDK (not JavaScript)
- Define explicit interfaces for props
- Enable strict TypeScript compiler options

```typescript
// Good: Explicit interface
interface MyConstructProps {
  vpc: ec2.IVpc;
  environment: 'dev' | 'prod';
  maxCapacity: number;
}

export class MyConstruct extends Construct {
  constructor(scope: Construct, id: string, props: MyConstructProps) {
    super(scope, id);
    // Implementation
  }
}
```

### Documentation

**DO:**
- Document complex constructs
- Explain architectural decisions in comments
- Use JSDoc for public APIs

```typescript
/**
 * Creates a serverless API with Lambda and DynamoDB backend.
 *
 * @param scope - The parent construct
 * @param id - Unique identifier
 * @param props - Configuration properties
 *
 * @example
 * ```typescript
 * new ServerlessApi(this, 'Api', {
 *   environment: 'prod',
 *   corsOrigins: ['https://example.com'],
 * });
 * ```
 */
export class ServerlessApi extends Construct {
  // Implementation
}
```

### Code Reuse

**DO:**
- Extract repeated patterns into constructs
- Share common constructs across projects
- Publish reusable constructs as npm packages

**DON'T:**
- Copy-paste code between stacks
- Create overly generic constructs

### Removal Policies

**DO:**
- Use `RemovalPolicy.RETAIN` for production data stores
- Use `RemovalPolicy.DESTROY` for dev/test resources
- Be explicit about removal policies

```typescript
// Production: Retain data
const prodTable = new dynamodb.Table(this, 'ProdTable', {
  removalPolicy: RemovalPolicy.RETAIN,
});

// Dev: Auto-cleanup
const devTable = new dynamodb.Table(this, 'DevTable', {
  removalPolicy: RemovalPolicy.DESTROY,
});
```

### Aspects

**DO:**
- Use Aspects for cross-cutting concerns
- Apply tags, compliance checks, or modifications consistently

```typescript
import { IAspect, IConstruct } from 'aws-cdk-lib';

class ApplyTagsAspect implements IAspect {
  public visit(node: IConstruct): void {
    if (node instanceof s3.Bucket) {
      Tags.of(node).add('AutoTagged', 'true');
    }
  }
}

Aspects.of(app).add(new ApplyTagsAspect());
```
