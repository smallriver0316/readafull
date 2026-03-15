import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment';

export class StorageStack extends cdk.Stack {
  public readonly mainTable: dynamodb.Table;
  public readonly audioBucket: s3.Bucket;

  constructor(scope: Construct, id: string, config: EnvironmentConfig, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create DynamoDB table with single-table design
    this.mainTable = new dynamodb.Table(this, 'MainTable', {
      tableName: config.dynamodb.tableName,
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: config.dynamodb.billingMode === 'PAY_PER_REQUEST'
        ? dynamodb.BillingMode.PAY_PER_REQUEST
        : dynamodb.BillingMode.PROVISIONED,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: config.environment === 'production',
      removalPolicy: config.environment === 'production'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for querying by difficulty and creation time
    this.mainTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: {
        name: 'GSI1PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI1SK',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Create S3 bucket for audio files
    this.audioBucket = new s3.Bucket(this, 'AudioBucket', {
      bucketName: config.s3.audioBucketName,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
      lifecycleRules: [
        {
          id: 'DeleteOldAudioFiles',
          enabled: true,
          expiration: cdk.Duration.days(config.s3.lifecycleDays),
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(30),
            },
          ],
        },
      ],
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.DELETE,
          ],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
      removalPolicy: config.environment === 'production'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: config.environment !== 'production',
    });

    // Output important values
    new cdk.CfnOutput(this, 'MainTableName', {
      value: this.mainTable.tableName,
      description: 'DynamoDB Main Table Name',
      exportName: `${config.stackPrefix}-MainTableName`,
    });

    new cdk.CfnOutput(this, 'MainTableArn', {
      value: this.mainTable.tableArn,
      description: 'DynamoDB Main Table ARN',
      exportName: `${config.stackPrefix}-MainTableArn`,
    });

    new cdk.CfnOutput(this, 'AudioBucketName', {
      value: this.audioBucket.bucketName,
      description: 'S3 Audio Bucket Name',
      exportName: `${config.stackPrefix}-AudioBucketName`,
    });

    new cdk.CfnOutput(this, 'AudioBucketArn', {
      value: this.audioBucket.bucketArn,
      description: 'S3 Audio Bucket ARN',
      exportName: `${config.stackPrefix}-AudioBucketArn`,
    });
  }
}
