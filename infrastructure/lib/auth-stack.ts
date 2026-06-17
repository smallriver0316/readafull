import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cr from 'aws-cdk-lib/custom-resources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import {
  EnvironmentConfig,
  LAMBDA_ARCHITECTURE,
  LAMBDA_BUNDLING_NODE_TARGET,
  LAMBDA_NODE_RUNTIME,
  SocialProviderConfig,
} from '../config/environment';

interface AuthStackProps extends cdk.StackProps {
  mainTable: dynamodb.Table;
}

// Cognito AttributeMapping in raw API form (user-pool attribute -> provider
// attribute). The social-IdP Custom Resource configures providers via the
// Cognito SDK, so it needs the plain string map rather than the CDK L2
// `ProviderAttribute` wrappers.
const socialAttributeMapping: Record<string, string> = {
  email: 'email',
  given_name: 'given_name',
  family_name: 'family_name',
  name: 'name',
  picture: 'picture',
};

const amazonAttributeMapping: Record<string, string> = {
  email: 'email',
  name: 'name',
};

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolDomain: cognito.UserPoolDomain;
  public readonly postConfirmationFunction: NodejsFunction;
  public readonly enabledSocialProviders: cognito.UserPoolClientIdentityProvider[];

  // Custom resources that register each social IdP via the Cognito SDK. The
  // User Pool Client must deploy after these so it never advertises a provider
  // that does not yet exist on the pool.
  private readonly socialIdpResources: cdk.CustomResource[] = [];
  private socialIdpProviderFramework?: cr.Provider;

  constructor(
    scope: Construct,
    id: string,
    config: EnvironmentConfig,
    authProps: AuthStackProps,
    props?: cdk.StackProps
  ) {
    super(scope, id, props);

    const { mainTable } = authProps;

    // Post-confirmation trigger Lambda — creates the user profile in DynamoDB
    // when a user (including federated identity sign-up) first confirms.
    this.postConfirmationFunction = new NodejsFunction(this, 'PostConfirmationFunction', {
      functionName: `${config.stackPrefix}-post-confirmation`,
      runtime: LAMBDA_NODE_RUNTIME,
      architecture: LAMBDA_ARCHITECTURE,
      entry: path.join(__dirname, '..', 'lambda', 'auth-triggers', 'postConfirmation.ts'),
      handler: 'handler',
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: {
        MAIN_TABLE_NAME: mainTable.tableName,
        ENVIRONMENT: config.environment,
      },
      bundling: {
        target: LAMBDA_BUNDLING_NODE_TARGET,
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
      tracing: config.monitoring.enableXRay ? lambda.Tracing.ACTIVE : lambda.Tracing.DISABLED,
    });

    mainTable.grantWriteData(this.postConfirmationFunction);

    // Create Cognito User Pool with social login support
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: config.cognito.userPoolName,
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: false,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        givenName: {
          required: false,
          mutable: true,
        },
        familyName: {
          required: false,
          mutable: true,
        },
        profilePicture: {
          required: false,
          mutable: true,
        },
      },
      customAttributes: {
        provider: new cognito.StringAttribute({ mutable: true }),
        difficulty_pref: new cognito.StringAttribute({ mutable: true }),
        preferred_language: new cognito.StringAttribute({ mutable: true }),
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      lambdaTriggers: {
        postConfirmation: this.postConfirmationFunction,
      },
      removalPolicy: config.environment === 'production'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    // Configure social identity providers from SSM Parameter Store values.
    // Each provider is registered by a Lambda-backed Custom Resource that reads
    // the credentials (incl. SecureString secrets) via the SDK at deploy time,
    // so secrets never need to be stored as plain `String`. Providers stay
    // opt-in via environment flag so missing SSM parameters don't break
    // development deploys.
    this.enabledSocialProviders = [cognito.UserPoolClientIdentityProvider.COGNITO];

    const googleProvider = this.maybeAddSocialProvider(config, {
      id: 'GoogleProvider',
      provider: cognito.UserPoolClientIdentityProvider.GOOGLE,
      providerConfig: config.cognito.socialProviders.google,
      secretParameterNames: {
        client_id: config.cognito.socialProviders.google.ssmParameters.clientId,
        client_secret: config.cognito.socialProviders.google.ssmParameters.clientSecret,
      },
      staticProviderDetails: { authorize_scopes: 'openid email profile' },
      attributeMapping: socialAttributeMapping,
    });
    if (googleProvider) {
      this.enabledSocialProviders.push(googleProvider);
    }

    const facebookProvider = this.maybeAddSocialProvider(config, {
      id: 'FacebookProvider',
      provider: cognito.UserPoolClientIdentityProvider.FACEBOOK,
      providerConfig: config.cognito.socialProviders.facebook,
      secretParameterNames: {
        client_id: config.cognito.socialProviders.facebook.ssmParameters.appId,
        client_secret: config.cognito.socialProviders.facebook.ssmParameters.appSecret,
      },
      staticProviderDetails: { authorize_scopes: 'public_profile email' },
      attributeMapping: socialAttributeMapping,
    });
    if (facebookProvider) {
      this.enabledSocialProviders.push(facebookProvider);
    }

    const amazonProvider = this.maybeAddSocialProvider(config, {
      id: 'AmazonProvider',
      provider: cognito.UserPoolClientIdentityProvider.AMAZON,
      providerConfig: config.cognito.socialProviders.amazon,
      secretParameterNames: {
        client_id: config.cognito.socialProviders.amazon.ssmParameters.clientId,
        client_secret: config.cognito.socialProviders.amazon.ssmParameters.clientSecret,
      },
      staticProviderDetails: { authorize_scopes: 'profile' },
      attributeMapping: amazonAttributeMapping,
    });
    if (amazonProvider) {
      this.enabledSocialProviders.push(amazonProvider);
    }

    // Apple is temporarily disabled — Apple Developer Program requires a paid
    // membership. When enrollment is in place, restore the `apple` field in
    // CognitoSocialProvidersConfig and add a maybeAddSocialProvider call here
    // mapping the Apple ProviderDetails keys (client_id/team_id/key_id/
    // private_key) to their SSM parameter names.
    // const appleProvider = this.maybeAddSocialProvider(config, { ...apple... });
    // if (appleProvider) {
    //   this.enabledSocialProviders.push(appleProvider);
    // }

    // Hosted UI domain — required when using federated sign-in.
    this.userPoolDomain = this.userPool.addDomain('UserPoolDomain', {
      cognitoDomain: {
        domainPrefix: config.cognito.domainPrefix,
      },
    });

    // Create User Pool Client for mobile app with social providers
    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: `${config.appName}-mobile-client`,
      generateSecret: false,
      authFlows: {
        userPassword: false,
        userSrp: true,
        custom: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: false,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: config.cognito.allowedCallbackURLs,
        logoutUrls: config.cognito.allowedLogoutURLs,
      },
      supportedIdentityProviders: this.enabledSocialProviders,
      preventUserExistenceErrors: true,
    });

    // The client must be deployed after all configured IdPs exist, otherwise
    // it may advertise a provider the Custom Resource has not registered yet.
    for (const resource of this.socialIdpResources) {
      this.userPoolClient.node.addDependency(resource);
    }

    // Output important values
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `${config.stackPrefix}-UserPoolId`,
    });

    new cdk.CfnOutput(this, 'UserPoolArn', {
      value: this.userPool.userPoolArn,
      description: 'Cognito User Pool ARN',
      exportName: `${config.stackPrefix}-UserPoolArn`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: `${config.stackPrefix}-UserPoolClientId`,
    });

    new cdk.CfnOutput(this, 'UserPoolDomain', {
      value: this.userPoolDomain.domainName,
      description: 'Cognito Hosted UI domain prefix',
      exportName: `${config.stackPrefix}-UserPoolDomain`,
    });

    new cdk.CfnOutput(this, 'EnabledSocialProviders', {
      value: this.enabledSocialProviders.map((p) => p.name).join(','),
      description: 'Identity providers enabled on the user pool client',
    });
  }

  // Lazily create the shared Custom Resource provider framework (a single
  // onEvent Lambda) the first time a social IdP is enabled. The Lambda reads
  // each provider's credentials from SSM Parameter Store with decryption, so
  // client secrets can be stored as `SecureString` (encrypted at rest) instead
  // of plain `String`. The decrypted values never appear in the CloudFormation
  // template or stack events — only the SSM parameter *names* are passed in.
  private getSocialIdpProviderFramework(config: EnvironmentConfig): cr.Provider {
    if (this.socialIdpProviderFramework) {
      return this.socialIdpProviderFramework;
    }

    const onEventHandler = new NodejsFunction(this, 'SocialIdpOnEventFunction', {
      functionName: `${config.stackPrefix}-social-idp-cr`,
      runtime: LAMBDA_NODE_RUNTIME,
      architecture: LAMBDA_ARCHITECTURE,
      entry: path.join(__dirname, '..', 'lambda', 'custom-resources', 'socialIdpProvider.ts'),
      handler: 'handler',
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      bundling: {
        target: LAMBDA_BUNDLING_NODE_TARGET,
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
      tracing: config.monitoring.enableXRay ? lambda.Tracing.ACTIVE : lambda.Tracing.DISABLED,
    });

    // Read social provider credentials, including SecureString secrets, scoped
    // to this environment's auth parameter path.
    onEventHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParameter', 'ssm:GetParameters'],
        resources: [
          `arn:${this.partition}:ssm:${this.region}:${this.account}:parameter/readafull/${config.environment}/auth/*`,
        ],
      })
    );

    // Decrypt SecureString values. Restricting to the SSM service prevents the
    // role from decrypting arbitrary ciphertext outside Parameter Store and
    // works for both the AWS-managed `aws/ssm` key and a customer-managed key.
    onEventHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['kms:Decrypt'],
        resources: ['*'],
        conditions: {
          StringEquals: { 'kms:ViaService': `ssm.${this.region}.amazonaws.com` },
        },
      })
    );

    // Manage identity providers on this user pool only.
    onEventHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'cognito-idp:CreateIdentityProvider',
          'cognito-idp:UpdateIdentityProvider',
          'cognito-idp:DeleteIdentityProvider',
          'cognito-idp:DescribeIdentityProvider',
        ],
        resources: [this.userPool.userPoolArn],
      })
    );

    this.socialIdpProviderFramework = new cr.Provider(this, 'SocialIdpProviderFramework', {
      onEventHandler,
    });
    return this.socialIdpProviderFramework;
  }

  // Register one social identity provider through the Custom Resource, unless
  // it is disabled by its environment flag. Returns the matching client
  // identity-provider enum so the caller can advertise it on the User Pool
  // Client, or `undefined` when the provider is not enabled.
  private maybeAddSocialProvider(
    config: EnvironmentConfig,
    options: {
      id: string;
      provider: cognito.UserPoolClientIdentityProvider;
      providerConfig: SocialProviderConfig;
      secretParameterNames: Record<string, string>;
      staticProviderDetails: Record<string, string>;
      attributeMapping: Record<string, string>;
    }
  ): cognito.UserPoolClientIdentityProvider | undefined {
    if (!options.providerConfig.enabled) {
      return undefined;
    }

    const framework = this.getSocialIdpProviderFramework(config);

    const resource = new cdk.CustomResource(this, options.id, {
      serviceToken: framework.serviceToken,
      resourceType: 'Custom::CognitoSocialIdentityProvider',
      properties: {
        UserPoolId: this.userPool.userPoolId,
        ProviderName: options.provider.name,
        ProviderType: options.provider.name,
        SecretParameterNames: options.secretParameterNames,
        StaticProviderDetails: options.staticProviderDetails,
        AttributeMapping: options.attributeMapping,
      },
    });
    resource.node.addDependency(this.userPool);

    this.socialIdpResources.push(resource);
    return options.provider;
  }
}
