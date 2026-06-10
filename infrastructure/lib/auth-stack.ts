import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ssm from 'aws-cdk-lib/aws-ssm';
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

const socialAttributeMapping: cognito.AttributeMapping = {
  email: cognito.ProviderAttribute.other('email'),
  givenName: cognito.ProviderAttribute.other('given_name'),
  familyName: cognito.ProviderAttribute.other('family_name'),
  fullname: cognito.ProviderAttribute.other('name'),
  profilePicture: cognito.ProviderAttribute.other('picture'),
};

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolDomain: cognito.UserPoolDomain;
  public readonly postConfirmationFunction: NodejsFunction;
  public readonly enabledSocialProviders: cognito.UserPoolClientIdentityProvider[];

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
    // Providers stay opt-in via environment flag so missing SSM parameters
    // don't break development deploys.
    this.enabledSocialProviders = [cognito.UserPoolClientIdentityProvider.COGNITO];

    const providerDependencies: cognito.UserPoolIdentityProvider[] = [];

    const googleProvider = this.maybeAddGoogleProvider(config.cognito.socialProviders.google);
    if (googleProvider) {
      providerDependencies.push(googleProvider);
      this.enabledSocialProviders.push(cognito.UserPoolClientIdentityProvider.GOOGLE);
    }

    const facebookProvider = this.maybeAddFacebookProvider(config.cognito.socialProviders.facebook);
    if (facebookProvider) {
      providerDependencies.push(facebookProvider);
      this.enabledSocialProviders.push(cognito.UserPoolClientIdentityProvider.FACEBOOK);
    }

    const amazonProvider = this.maybeAddAmazonProvider(config.cognito.socialProviders.amazon);
    if (amazonProvider) {
      providerDependencies.push(amazonProvider);
      this.enabledSocialProviders.push(cognito.UserPoolClientIdentityProvider.AMAZON);
    }

    // Apple is temporarily disabled — Apple Developer Program requires a paid
    // membership. Uncomment together with `maybeAddAppleProvider` below and the
    // `apple` field in CognitoSocialProvidersConfig when enrollment is in place.
    // const appleProvider = this.maybeAddAppleProvider(config.cognito.socialProviders.apple);
    // if (appleProvider) {
    //   providerDependencies.push(appleProvider);
    //   this.enabledSocialProviders.push(cognito.UserPoolClientIdentityProvider.APPLE);
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
    // CloudFormation may try to attach the client to providers that do not yet
    // exist on the user pool.
    for (const provider of providerDependencies) {
      this.userPoolClient.node.addDependency(provider);
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

  // All social provider secrets are read from SSM Parameter Store as `String`
  // (NOT `SecureString`) at deploy time. CloudFormation does not support the
  // `{{resolve:ssm-secure:...}}` dynamic reference for
  // `AWS::Cognito::UserPoolIdentityProvider/ProviderDetails/client_secret`, so
  // SecureString cannot be used here without a Custom Resource workaround.
  //
  // The trade-off is that the secret is stored unencrypted at rest in SSM
  // (IAM still gates access, and the value never appears in CFN templates
  // because we go through CFN-resolved SSM Parameter references). This is
  // acceptable for development; production should switch to a Custom Resource
  // that reads SecureString via the SDK and configures the IdP directly.
  // See infrastructure/README.md "Social Login Configuration".
  private stringParameterValue(parameterName: string): string {
    return ssm.StringParameter.valueForStringParameter(this, parameterName);
  }

  private secretParameterValue(parameterName: string): cdk.SecretValue {
    // `unsafePlainText` simply wraps the CDK token (which resolves to a CFN
    // `Ref` of an SSM Parameter at deploy time) into a SecretValue, so the
    // synthesized template still contains only a reference, not the secret.
    return cdk.SecretValue.unsafePlainText(this.stringParameterValue(parameterName));
  }

  private maybeAddGoogleProvider(
    providerConfig: SocialProviderConfig
  ): cognito.UserPoolIdentityProviderGoogle | undefined {
    if (!providerConfig.enabled) {
      return undefined;
    }

    return new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleProvider', {
      userPool: this.userPool,
      clientId: this.stringParameterValue(providerConfig.ssmParameters.clientId),
      clientSecretValue: this.secretParameterValue(providerConfig.ssmParameters.clientSecret),
      scopes: ['openid', 'email', 'profile'],
      attributeMapping: socialAttributeMapping,
    });
  }

  private maybeAddFacebookProvider(
    providerConfig: SocialProviderConfig
  ): cognito.UserPoolIdentityProviderFacebook | undefined {
    if (!providerConfig.enabled) {
      return undefined;
    }

    return new cognito.UserPoolIdentityProviderFacebook(this, 'FacebookProvider', {
      userPool: this.userPool,
      clientId: this.stringParameterValue(providerConfig.ssmParameters.appId),
      clientSecret: this.stringParameterValue(providerConfig.ssmParameters.appSecret),
      scopes: ['public_profile', 'email'],
      attributeMapping: socialAttributeMapping,
    });
  }

  private maybeAddAmazonProvider(
    providerConfig: SocialProviderConfig
  ): cognito.UserPoolIdentityProviderAmazon | undefined {
    if (!providerConfig.enabled) {
      return undefined;
    }

    return new cognito.UserPoolIdentityProviderAmazon(this, 'AmazonProvider', {
      userPool: this.userPool,
      clientId: this.stringParameterValue(providerConfig.ssmParameters.clientId),
      clientSecret: this.stringParameterValue(providerConfig.ssmParameters.clientSecret),
      scopes: ['profile'],
      attributeMapping: {
        email: cognito.ProviderAttribute.other('email'),
        fullname: cognito.ProviderAttribute.other('name'),
      },
    });
  }

  // Apple is temporarily disabled — Apple Developer Program requires a paid
  // membership. Restore this method together with the call site above and the
  // `apple` field in CognitoSocialProvidersConfig when enrollment is in place.
  // private maybeAddAppleProvider(
  //   providerConfig: SocialProviderConfig
  // ): cognito.UserPoolIdentityProviderApple | undefined {
  //   if (!providerConfig.enabled) {
  //     return undefined;
  //   }
  //
  //   return new cognito.UserPoolIdentityProviderApple(this, 'AppleProvider', {
  //     userPool: this.userPool,
  //     clientId: this.stringParameterValue(providerConfig.ssmParameters.servicesId),
  //     teamId: this.stringParameterValue(providerConfig.ssmParameters.teamId),
  //     keyId: this.stringParameterValue(providerConfig.ssmParameters.keyId),
  //     privateKeyValue: this.secretParameterValue(providerConfig.ssmParameters.privateKey),
  //     scopes: ['email', 'name'],
  //     attributeMapping: {
  //       email: cognito.ProviderAttribute.other('email'),
  //       fullname: cognito.ProviderAttribute.other('name'),
  //     },
  //   });
  // }
}
