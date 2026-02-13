import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment';

interface ApiStackProps extends cdk.StackProps {
  userPool: cognito.UserPool;
  mainTable: dynamodb.Table;
  audioBucket: s3.Bucket;
}

export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly textGenerationFunction: lambda.Function;
  public readonly translationFunction: lambda.Function;
  public readonly ttsGenerationFunction: lambda.Function;
  public readonly audioProcessingFunction: lambda.Function;
  public readonly userProfileFunction: lambda.Function;

  constructor(
    scope: Construct,
    id: string,
    config: EnvironmentConfig,
    apiProps: ApiStackProps,
    props?: cdk.StackProps
  ) {
    super(scope, id, props);

    const { userPool, mainTable, audioBucket } = apiProps;

    // Create API Gateway
    this.api = new apigateway.RestApi(this, 'ReadafullApi', {
      restApiName: `${config.appName}-api-${config.environment}`,
      description: `Readafull API for ${config.environment} environment`,
      deployOptions: {
        stageName: config.environment,
        tracingEnabled: config.monitoring.enableXRay,
        throttlingRateLimit: config.api.throttleRateLimit,
        throttlingBurstLimit: config.api.throttleBurstLimit,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowCredentials: true,
      },
    });

    // Create Cognito Authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
      authorizerName: 'CognitoAuthorizer',
      identitySource: 'method.request.header.Authorization',
    });

    // Common environment variables for Lambda functions
    const commonEnvVars = {
      MAIN_TABLE_NAME: mainTable.tableName,
      AUDIO_BUCKET_NAME: audioBucket.bucketName,
      ENVIRONMENT: config.environment,
    };

    // Create Lambda functions (placeholder implementations)
    // These will be implemented in later tasks

    // Text Generation Lambda
    this.textGenerationFunction = new lambda.Function(this, 'TextGenerationFunction', {
      functionName: `${config.stackPrefix}-text-generation`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Text generation function called');
          return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Text generation not yet implemented' })
          };
        };
      `),
      memorySize: config.lambda.memorySize,
      timeout: cdk.Duration.seconds(config.lambda.timeout),
      environment: commonEnvVars,
      tracing: config.monitoring.enableXRay ? lambda.Tracing.ACTIVE : lambda.Tracing.DISABLED,
    });

    // Translation Lambda
    this.translationFunction = new lambda.Function(this, 'TranslationFunction', {
      functionName: `${config.stackPrefix}-translation`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Translation function called');
          return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Translation not yet implemented' })
          };
        };
      `),
      memorySize: config.lambda.memorySize,
      timeout: cdk.Duration.seconds(config.lambda.timeout),
      environment: commonEnvVars,
      tracing: config.monitoring.enableXRay ? lambda.Tracing.ACTIVE : lambda.Tracing.DISABLED,
    });

    // TTS Generation Lambda
    this.ttsGenerationFunction = new lambda.Function(this, 'TtsGenerationFunction', {
      functionName: `${config.stackPrefix}-tts-generation`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('TTS generation function called');
          return {
            statusCode: 200,
            body: JSON.stringify({ message: 'TTS generation not yet implemented' })
          };
        };
      `),
      memorySize: config.lambda.memorySize,
      timeout: cdk.Duration.seconds(config.lambda.timeout),
      environment: commonEnvVars,
      tracing: config.monitoring.enableXRay ? lambda.Tracing.ACTIVE : lambda.Tracing.DISABLED,
    });

    // Audio Processing Lambda
    this.audioProcessingFunction = new lambda.Function(this, 'AudioProcessingFunction', {
      functionName: `${config.stackPrefix}-audio-processing`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Audio processing function called');
          return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Audio processing not yet implemented' })
          };
        };
      `),
      memorySize: config.lambda.memorySize,
      timeout: cdk.Duration.seconds(config.lambda.timeout),
      environment: commonEnvVars,
      tracing: config.monitoring.enableXRay ? lambda.Tracing.ACTIVE : lambda.Tracing.DISABLED,
    });

    // User Profile Lambda
    this.userProfileFunction = new lambda.Function(this, 'UserProfileFunction', {
      functionName: `${config.stackPrefix}-user-profile`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('User profile function called');
          return {
            statusCode: 200,
            body: JSON.stringify({ message: 'User profile not yet implemented' })
          };
        };
      `),
      memorySize: config.lambda.memorySize,
      timeout: cdk.Duration.seconds(config.lambda.timeout),
      environment: commonEnvVars,
      tracing: config.monitoring.enableXRay ? lambda.Tracing.ACTIVE : lambda.Tracing.DISABLED,
    });

    // Grant permissions to Lambda functions
    mainTable.grantReadWriteData(this.textGenerationFunction);
    mainTable.grantReadWriteData(this.translationFunction);
    mainTable.grantReadWriteData(this.ttsGenerationFunction);
    mainTable.grantReadWriteData(this.audioProcessingFunction);
    mainTable.grantReadWriteData(this.userProfileFunction);

    audioBucket.grantReadWrite(this.ttsGenerationFunction);
    audioBucket.grantReadWrite(this.audioProcessingFunction);

    // Grant Bedrock permissions to text generation function
    this.textGenerationFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['bedrock:InvokeModel'],
        resources: ['arn:aws:bedrock:*:*:foundation-model/*'],
      })
    );

    // Grant Translate permissions to translation function
    this.translationFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['translate:TranslateText'],
        resources: ['*'],
      })
    );

    // Grant Polly permissions to TTS function
    this.ttsGenerationFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['polly:SynthesizeSpeech'],
        resources: ['*'],
      })
    );

    // Define API resources and methods
    const texts = this.api.root.addResource('texts');
    const textById = texts.addResource('{textId}');
    const audio = this.api.root.addResource('audio');
    const audioById = audio.addResource('{audioId}');
    const user = this.api.root.addResource('user');
    const profile = user.addResource('profile');

    // Text Generation endpoint
    texts.addMethod('POST', new apigateway.LambdaIntegration(this.textGenerationFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Translation endpoint
    textById.addMethod('GET', new apigateway.LambdaIntegration(this.translationFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // TTS Generation endpoint
    const tts = textById.addResource('tts');
    tts.addMethod('POST', new apigateway.LambdaIntegration(this.ttsGenerationFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Audio processing endpoint
    audio.addMethod('POST', new apigateway.LambdaIntegration(this.audioProcessingFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    audioById.addMethod('GET', new apigateway.LambdaIntegration(this.audioProcessingFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // User profile endpoints
    profile.addMethod('GET', new apigateway.LambdaIntegration(this.userProfileFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    profile.addMethod('PUT', new apigateway.LambdaIntegration(this.userProfileFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Output important values
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
      exportName: `${config.stackPrefix}-ApiUrl`,
    });

    new cdk.CfnOutput(this, 'ApiId', {
      value: this.api.restApiId,
      description: 'API Gateway ID',
      exportName: `${config.stackPrefix}-ApiId`,
    });
  }
}
