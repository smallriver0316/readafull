import * as lambda from 'aws-cdk-lib/aws-lambda';

/**
 * Single source of truth for the Lambda runtime. Bump this constant in
 * lockstep with the Runtime Versions table in .kiro/steering/tech.md.
 * All stacks must reference these constants rather than hardcoding the
 * runtime / architecture / bundling target.
 */
export const LAMBDA_NODE_RUNTIME = lambda.Runtime.NODEJS_24_X;
export const LAMBDA_BUNDLING_NODE_TARGET = 'node24';
export const LAMBDA_ARCHITECTURE = lambda.Architecture.ARM_64;

export interface SocialProviderConfig {
  enabled: boolean;
  ssmParameters: Record<string, string>;
}

export interface CognitoSocialProvidersConfig {
  google: SocialProviderConfig;
  facebook: SocialProviderConfig;
  amazon: SocialProviderConfig;
  // Apple is temporarily disabled — Apple Developer Program requires a paid
  // membership. Uncomment when the program enrollment is in place.
  // apple: SocialProviderConfig;
}

export interface EnvironmentConfig {
  account?: string;
  region: string;
  environment: 'development' | 'staging' | 'production';
  appName: string;
  stackPrefix: string;

  // Cognito Configuration
  cognito: {
    userPoolName: string;
    domainPrefix: string;
    allowedCallbackURLs: string[];
    allowedLogoutURLs: string[];
    socialProviders: CognitoSocialProvidersConfig;
  };

  // DynamoDB Configuration
  dynamodb: {
    tableName: string;
    billingMode: 'PAY_PER_REQUEST' | 'PROVISIONED';
  };

  // S3 Configuration
  s3: {
    audioBucketName: string;
    lifecycleDays: number;
  };

  // API Gateway Configuration
  api: {
    throttleRateLimit: number;
    throttleBurstLimit: number;
  };

  // Lambda Configuration. Runtime / architecture / bundling target are
  // intentionally NOT per-environment — they live in the LAMBDA_NODE_RUNTIME
  // family of constants exported from this module.
  lambda: {
    memorySize: number;
    timeout: number;
  };

  // Monitoring Configuration
  monitoring: {
    enableXRay: boolean;
    logRetentionDays: number;
    slack?: {
      workspaceId: string;
      channelId: string;
    };
  };
}

export const getEnvironmentConfig = (environment: string): EnvironmentConfig => {
  const env = environment || 'development';

  const slackWorkspaceId = process.env.SLACK_WORKSPACE_ID;
  const slackChannelIdByEnv: Record<string, string | undefined> = {
    development: process.env.SLACK_CHANNEL_ID_DEV,
    staging: process.env.SLACK_CHANNEL_ID_STAGING,
    production: process.env.SLACK_CHANNEL_ID_PROD,
  };

  const buildSlackConfig = (envName: string) => {
    const channelId = slackChannelIdByEnv[envName];
    if (slackWorkspaceId && channelId) {
      return { workspaceId: slackWorkspaceId, channelId };
    }
    return undefined;
  };

  const isFlagEnabled = (value: string | undefined): boolean =>
    value === 'true' || value === '1';

  const buildSocialProviders = (envName: string): CognitoSocialProvidersConfig => {
    const base = `/readafull/${envName}/auth`;
    return {
      google: {
        enabled: isFlagEnabled(process.env.READAFULL_AUTH_GOOGLE_ENABLED),
        ssmParameters: {
          clientId: `${base}/google/client-id`,
          clientSecret: `${base}/google/client-secret`,
        },
      },
      facebook: {
        enabled: isFlagEnabled(process.env.READAFULL_AUTH_FACEBOOK_ENABLED),
        ssmParameters: {
          appId: `${base}/facebook/app-id`,
          appSecret: `${base}/facebook/app-secret`,
        },
      },
      amazon: {
        enabled: isFlagEnabled(process.env.READAFULL_AUTH_AMAZON_ENABLED),
        ssmParameters: {
          clientId: `${base}/amazon/client-id`,
          clientSecret: `${base}/amazon/client-secret`,
        },
      },
      // Apple is temporarily disabled — Apple Developer Program requires a
      // paid membership. Uncomment together with the `apple` entry in
      // CognitoSocialProvidersConfig when enrollment is complete.
      // apple: {
      //   enabled: isFlagEnabled(process.env.READAFULL_AUTH_APPLE_ENABLED),
      //   ssmParameters: {
      //     servicesId: `${base}/apple/services-id`,
      //     teamId: `${base}/apple/team-id`,
      //     keyId: `${base}/apple/key-id`,
      //     privateKey: `${base}/apple/private-key`,
      //   },
      // },
    };
  };

  const configs: Record<string, EnvironmentConfig> = {
    development: {
      region: 'ap-northeast-1',
      environment: 'development',
      appName: 'readafull',
      stackPrefix: 'Readafull-Dev',

      cognito: {
        userPoolName: 'readafull-users-dev',
        domainPrefix: 'readafull-dev',
        allowedCallbackURLs: [
          'http://localhost:3000/auth/callback',
          'readafull://auth/callback',
        ],
        allowedLogoutURLs: [
          'http://localhost:3000/',
          'readafull://auth/signout',
        ],
        socialProviders: buildSocialProviders('development'),
      },

      dynamodb: {
        tableName: 'readafull-main-table-dev',
        billingMode: 'PAY_PER_REQUEST',
      },

      s3: {
        audioBucketName: 'readafull-audio-storage-dev',
        lifecycleDays: 30,
      },

      api: {
        throttleRateLimit: 100,
        throttleBurstLimit: 200,
      },

      lambda: {
        memorySize: 512,
        timeout: 30,
      },

      monitoring: {
        enableXRay: true,
        logRetentionDays: 7,
        slack: buildSlackConfig('development'),
      },
    },

    staging: {
      region: 'ap-northeast-1',
      environment: 'staging',
      appName: 'readafull',
      stackPrefix: 'Readafull-Staging',

      cognito: {
        userPoolName: 'readafull-users-staging',
        domainPrefix: 'readafull-staging',
        allowedCallbackURLs: [
          'https://staging.readafull.com/auth/callback',
          'readafull://auth/callback',
        ],
        allowedLogoutURLs: [
          'https://staging.readafull.com/',
          'readafull://auth/signout',
        ],
        socialProviders: buildSocialProviders('staging'),
      },

      dynamodb: {
        tableName: 'readafull-main-table-staging',
        billingMode: 'PAY_PER_REQUEST',
      },

      s3: {
        audioBucketName: 'readafull-audio-storage-staging',
        lifecycleDays: 60,
      },

      api: {
        throttleRateLimit: 500,
        throttleBurstLimit: 1000,
      },

      lambda: {
        memorySize: 1024,
        timeout: 60,
      },

      monitoring: {
        enableXRay: true,
        logRetentionDays: 14,
        slack: buildSlackConfig('staging'),
      },
    },

    production: {
      region: 'ap-northeast-1',
      environment: 'production',
      appName: 'readafull',
      stackPrefix: 'Readafull-Prod',

      cognito: {
        userPoolName: 'readafull-users-prod',
        domainPrefix: 'readafull-auth',
        allowedCallbackURLs: [
          'https://readafull.com/auth/callback',
          'readafull://auth/callback',
        ],
        allowedLogoutURLs: [
          'https://readafull.com/',
          'readafull://auth/signout',
        ],
        socialProviders: buildSocialProviders('production'),
      },

      dynamodb: {
        tableName: 'readafull-main-table-prod',
        billingMode: 'PAY_PER_REQUEST',
      },

      s3: {
        audioBucketName: 'readafull-audio-storage-prod',
        lifecycleDays: 90,
      },

      api: {
        throttleRateLimit: 1000,
        throttleBurstLimit: 2000,
      },

      lambda: {
        memorySize: 1024,
        timeout: 60,
      },

      monitoring: {
        enableXRay: true,
        logRetentionDays: 30,
        slack: buildSlackConfig('production'),
      },
    },
  };

  return configs[env] || configs.development;
};
