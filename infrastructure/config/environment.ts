export interface EnvironmentConfig {
  account?: string;
  region: string;
  environment: 'development' | 'staging' | 'production';
  appName: string;
  stackPrefix: string;

  // Cognito Configuration
  cognito: {
    userPoolName: string;
    allowedCallbackURLs: string[];
    allowedLogoutURLs: string[];
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

  // Lambda Configuration
  lambda: {
    memorySize: number;
    timeout: number;
    runtime: string;
  };

  // Monitoring Configuration
  monitoring: {
    enableXRay: boolean;
    logRetentionDays: number;
    alarmEmail?: string;
  };
}

export const getEnvironmentConfig = (environment: string): EnvironmentConfig => {
  const env = environment || 'development';

  const configs: Record<string, EnvironmentConfig> = {
    development: {
      region: 'us-east-1',
      environment: 'development',
      appName: 'readafull',
      stackPrefix: 'Readafull-Dev',

      cognito: {
        userPoolName: 'readafull-users-dev',
        allowedCallbackURLs: ['http://localhost:3000/auth/callback'],
        allowedLogoutURLs: ['http://localhost:3000/'],
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
        runtime: 'nodejs18.x',
      },

      monitoring: {
        enableXRay: true,
        logRetentionDays: 7,
      },
    },

    staging: {
      region: 'us-east-1',
      environment: 'staging',
      appName: 'readafull',
      stackPrefix: 'Readafull-Staging',

      cognito: {
        userPoolName: 'readafull-users-staging',
        allowedCallbackURLs: ['https://staging.readafull.com/auth/callback'],
        allowedLogoutURLs: ['https://staging.readafull.com/'],
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
        runtime: 'nodejs18.x',
      },

      monitoring: {
        enableXRay: true,
        logRetentionDays: 14,
      },
    },

    production: {
      region: 'us-east-1',
      environment: 'production',
      appName: 'readafull',
      stackPrefix: 'Readafull-Prod',

      cognito: {
        userPoolName: 'readafull-users-prod',
        allowedCallbackURLs: ['https://readafull.com/auth/callback'],
        allowedLogoutURLs: ['https://readafull.com/'],
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
        runtime: 'nodejs18.x',
      },

      monitoring: {
        enableXRay: true,
        logRetentionDays: 30,
        alarmEmail: 'alerts@readafull.com',
      },
    },
  };

  return configs[env] || configs.development;
};
