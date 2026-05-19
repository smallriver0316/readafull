#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AuthStack } from '../lib/auth-stack';
import { StorageStack } from '../lib/storage-stack';
import { ApiStack } from '../lib/api-stack';
import { MonitoringStack } from '../lib/monitoring-stack';
import { getEnvironmentConfig } from '../config/environment';

const app = new cdk.App();

// Get environment from context or default to development
const environment = app.node.tryGetContext('environment') || 'development';
const config = getEnvironmentConfig(environment);

// Stack props with tags
const stackProps: cdk.StackProps = {
  env: {
    account: config.account || process.env.CDK_DEFAULT_ACCOUNT,
    region: config.region,
  },
  tags: {
    Application: config.appName,
    Environment: config.environment,
    ManagedBy: 'CDK',
  },
};

// Create Storage Stack first — Auth and API stacks both depend on it.
const storageStack = new StorageStack(
  app,
  `${config.stackPrefix}-Storage`,
  config,
  stackProps
);

// Create Auth Stack (depends on Storage for the post-confirmation trigger)
const authStack = new AuthStack(
  app,
  `${config.stackPrefix}-Auth`,
  config,
  {
    mainTable: storageStack.mainTable,
  },
  stackProps
);
authStack.addDependency(storageStack);

// Create API Stack (depends on Auth and Storage)
const apiStack = new ApiStack(
  app,
  `${config.stackPrefix}-Api`,
  config,
  {
    userPool: authStack.userPool,
    mainTable: storageStack.mainTable,
    audioBucket: storageStack.audioBucket,
  },
  stackProps
);
apiStack.addDependency(authStack);
apiStack.addDependency(storageStack);

// Create Monitoring Stack (depends on API Stack for Lambda functions)
const monitoringStack = new MonitoringStack(
  app,
  `${config.stackPrefix}-Monitoring`,
  config,
  {
    lambdaFunctions: [
      apiStack.textGenerationFunction,
      apiStack.translationFunction,
      apiStack.ttsGenerationFunction,
      apiStack.audioProcessingFunction,
      apiStack.userProfileFunction,
    ],
  },
  stackProps
);
monitoringStack.addDependency(apiStack);

app.synth();
