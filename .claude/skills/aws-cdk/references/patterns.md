# Common CDK Patterns

This reference provides common CDK implementation patterns. Load this when implementing specific AWS resources or architectures.

## Table of Contents

1. [Lambda Function Patterns](#lambda-function-patterns)
2. [API Gateway Patterns](#api-gateway-patterns)
3. [Database Patterns](#database-patterns)
4. [Storage Patterns](#storage-patterns)
5. [Event-Driven Patterns](#event-driven-patterns)
6. [Authentication Patterns](#authentication-patterns)

## Lambda Function Patterns

### Basic Lambda Function

```typescript
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';

const myFunction = new lambda.Function(this, 'MyFunction', {
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
  environment: {
    TABLE_NAME: table.tableName,
  },
  timeout: Duration.seconds(30),
  memorySize: 512,
});
```

### Lambda with Docker Container

```typescript
const dockerFunction = new lambda.DockerImageFunction(this, 'DockerFunction', {
  code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '../docker')),
  environment: {
    ENV: 'production',
  },
});
```

### Lambda Layer

```typescript
const layer = new lambda.LayerVersion(this, 'MyLayer', {
  code: lambda.Code.fromAsset(path.join(__dirname, '../layer')),
  compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
  description: 'Common dependencies',
});

const fn = new lambda.Function(this, 'Function', {
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
  layers: [layer],
});
```

## API Gateway Patterns

### REST API with Lambda Integration

```typescript
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';

const api = new apigateway.RestApi(this, 'MyApi', {
  restApiName: 'My Service',
  description: 'My API Service',
  deployOptions: {
    stageName: 'prod',
    throttlingRateLimit: 100,
    throttlingBurstLimit: 200,
  },
});

const integration = new apigateway.LambdaIntegration(handler);
const items = api.root.addResource('items');
items.addMethod('GET', integration);
items.addMethod('POST', integration);
```

### HTTP API with Lambda

```typescript
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';

const httpApi = new apigatewayv2.HttpApi(this, 'HttpApi', {
  apiName: 'my-http-api',
  corsPreflight: {
    allowOrigins: ['*'],
    allowMethods: [apigatewayv2.CorsHttpMethod.ANY],
    allowHeaders: ['*'],
  },
});

httpApi.addRoutes({
  path: '/items',
  methods: [apigatewayv2.HttpMethod.GET],
  integration: new integrations.HttpLambdaIntegration('GetIntegration', getHandler),
});
```

### API with Cognito Authorization

```typescript
const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'Authorizer', {
  cognitoUserPools: [userPool],
});

items.addMethod('GET', integration, {
  authorizer,
  authorizationType: apigateway.AuthorizationType.COGNITO,
});
```

## Database Patterns

### DynamoDB Table

```typescript
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

const table = new dynamodb.Table(this, 'MyTable', {
  partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy: RemovalPolicy.DESTROY, // For dev only
  pointInTimeRecovery: true,
  encryption: dynamodb.TableEncryption.AWS_MANAGED,
  stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
});

// Add GSI
table.addGlobalSecondaryIndex({
  indexName: 'user-index',
  partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL,
});

// Grant permissions
table.grantReadWriteData(myFunction);
```

### RDS Aurora Serverless

```typescript
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

const cluster = new rds.ServerlessCluster(this, 'Database', {
  engine: rds.DatabaseClusterEngine.AURORA_POSTGRESQL,
  vpc,
  scaling: {
    autoPause: Duration.minutes(10),
    minCapacity: rds.AuroraCapacityUnit.ACU_2,
    maxCapacity: rds.AuroraCapacityUnit.ACU_16,
  },
  enableDataApi: true,
});
```

## Storage Patterns

### S3 Bucket

```typescript
import * as s3 from 'aws-cdk-lib/aws-s3';

const bucket = new s3.Bucket(this, 'MyBucket', {
  versioned: true,
  encryption: s3.BucketEncryption.S3_MANAGED,
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  removalPolicy: RemovalPolicy.RETAIN,
  lifecycleRules: [
    {
      expiration: Duration.days(90),
      transitions: [
        {
          storageClass: s3.StorageClass.INFREQUENT_ACCESS,
          transitionAfter: Duration.days(30),
        },
      ],
    },
  ],
});

// Grant permissions
bucket.grantReadWrite(myFunction);
```

### S3 with CloudFront

```typescript
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';

const distribution = new cloudfront.Distribution(this, 'Distribution', {
  defaultBehavior: {
    origin: new origins.S3Origin(bucket),
    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
  },
});
```

## Event-Driven Patterns

### EventBridge Rule

```typescript
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';

const rule = new events.Rule(this, 'Rule', {
  schedule: events.Schedule.cron({ minute: '0', hour: '12' }),
});

rule.addTarget(new targets.LambdaFunction(myFunction));
```

### SQS Queue with Lambda Trigger

```typescript
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';

const queue = new sqs.Queue(this, 'Queue', {
  visibilityTimeout: Duration.seconds(300),
  retentionPeriod: Duration.days(14),
  deadLetterQueue: {
    queue: dlq,
    maxReceiveCount: 3,
  },
});

myFunction.addEventSource(new lambdaEventSources.SqsEventSource(queue, {
  batchSize: 10,
}));
```

### SNS Topic

```typescript
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';

const topic = new sns.Topic(this, 'Topic', {
  displayName: 'My Topic',
});

topic.addSubscription(new subscriptions.LambdaSubscription(myFunction));
topic.addSubscription(new subscriptions.SqsSubscription(queue));
```

## Authentication Patterns

### Cognito User Pool

```typescript
import * as cognito from 'aws-cdk-lib/aws-cognito';

const userPool = new cognito.UserPool(this, 'UserPool', {
  selfSignUpEnabled: true,
  signInAliases: {
    email: true,
  },
  autoVerify: {
    email: true,
  },
  passwordPolicy: {
    minLength: 8,
    requireLowercase: true,
    requireUppercase: true,
    requireDigits: true,
    requireSymbols: true,
  },
  accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
});

const client = userPool.addClient('AppClient', {
  authFlows: {
    userPassword: true,
    userSrp: true,
  },
  oAuth: {
    flows: {
      authorizationCodeGrant: true,
    },
    scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID],
    callbackUrls: ['https://myapp.com/callback'],
  },
});

const domain = userPool.addDomain('Domain', {
  cognitoDomain: {
    domainPrefix: 'my-app',
  },
});
```

### Identity Pool

```typescript
const identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
  allowUnauthenticatedIdentities: false,
  cognitoIdentityProviders: [
    {
      clientId: client.userPoolClientId,
      providerName: userPool.userPoolProviderName,
    },
  ],
});
```

## Cross-Stack References

### Export Values

```typescript
// In Stack A
export class StackA extends Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, 'VPC');

    // Export for CloudFormation cross-stack reference
    new CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      exportName: 'MyVpcId',
    });
  }
}

// In Stack B
export class StackB extends Stack {
  constructor(scope: Construct, id: string, stackA: StackA, props?: StackProps) {
    super(scope, id, props);

    // Direct reference (preferred)
    const lambda = new lambda.Function(this, 'Function', {
      vpc: stackA.vpc,
      // ...
    });
  }
}
```

## Environment-Specific Configuration

```typescript
interface MyStackProps extends StackProps {
  environment: 'dev' | 'staging' | 'prod';
}

export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props: MyStackProps) {
    super(scope, id, props);

    const config = {
      dev: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
        minCapacity: 1,
      },
      staging: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
        minCapacity: 2,
      },
      prod: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.LARGE),
        minCapacity: 3,
      },
    }[props.environment];

    // Use config...
  }
}
```
