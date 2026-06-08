import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { AuthStack } from '../lib/auth-stack';
import { StorageStack } from '../lib/storage-stack';
import {
  CognitoSocialProvidersConfig,
  EnvironmentConfig,
  getEnvironmentConfig,
} from '../config/environment';

type EnabledProviders = Partial<Record<keyof CognitoSocialProvidersConfig, boolean>>;

const buildAuthStack = (
  enabled: EnabledProviders = {}
): { template: Template; stack: AuthStack } => {
  const base = getEnvironmentConfig('development');
  const config: EnvironmentConfig = {
    ...base,
    cognito: {
      ...base.cognito,
      socialProviders: {
        google: { ...base.cognito.socialProviders.google, enabled: !!enabled.google },
        facebook: { ...base.cognito.socialProviders.facebook, enabled: !!enabled.facebook },
        amazon: { ...base.cognito.socialProviders.amazon, enabled: !!enabled.amazon },
        // Apple is temporarily disabled — restore alongside the `apple` entry
        // in CognitoSocialProvidersConfig when Apple Developer Program
        // enrollment is in place.
        // apple: { ...base.cognito.socialProviders.apple, enabled: !!enabled.apple },
      },
    },
  };

  const app = new cdk.App();
  const storage = new StorageStack(app, 'TestStorage', config);
  const stack = new AuthStack(app, 'TestAuth', config, { mainTable: storage.mainTable });
  return { template: Template.fromStack(stack), stack };
};

describe('AuthStack', () => {
  describe('User Pool', () => {
    it('creates a Cognito User Pool with the configured name and email sign-in', () => {
      const { template } = buildAuthStack();

      template.hasResourceProperties('AWS::Cognito::UserPool', {
        UserPoolName: 'readafull-users-dev',
        UsernameAttributes: ['email'],
        AutoVerifiedAttributes: ['email'],
      });
    });

    it('declares custom attributes for provider, difficulty preference, and language', () => {
      const { template } = buildAuthStack();

      template.hasResourceProperties('AWS::Cognito::UserPool', {
        Schema: Match.arrayWith([
          Match.objectLike({ Name: 'provider', AttributeDataType: 'String' }),
          Match.objectLike({ Name: 'difficulty_pref', AttributeDataType: 'String' }),
          Match.objectLike({ Name: 'preferred_language', AttributeDataType: 'String' }),
        ]),
      });
    });

    it('creates a hosted UI domain using the configured prefix', () => {
      const { template } = buildAuthStack();

      template.hasResourceProperties('AWS::Cognito::UserPoolDomain', {
        Domain: 'readafull-dev',
      });
    });
  });

  describe('User Pool Client', () => {
    it('enables only COGNITO when no social providers are configured', () => {
      const { template, stack } = buildAuthStack();

      expect(stack.enabledSocialProviders.map((p) => p.name)).toEqual(['COGNITO']);
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        SupportedIdentityProviders: ['COGNITO'],
      });
    });

    it('disables USER_PASSWORD_AUTH and prevents user existence errors', () => {
      const { template } = buildAuthStack();

      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        ExplicitAuthFlows: Match.arrayWith([
          'ALLOW_USER_SRP_AUTH',
          'ALLOW_REFRESH_TOKEN_AUTH',
        ]),
        PreventUserExistenceErrors: 'ENABLED',
      });
    });
  });

  describe('Post-confirmation trigger', () => {
    it('attaches the post-confirmation Lambda to the User Pool', () => {
      const { template } = buildAuthStack();

      template.hasResourceProperties('AWS::Cognito::UserPool', {
        LambdaConfig: Match.objectLike({
          PostConfirmation: Match.anyValue(),
        }),
      });
    });

    it('grants the trigger Lambda permission to write to the main DynamoDB table', () => {
      const { template } = buildAuthStack();

      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith(['dynamodb:PutItem']),
              Effect: 'Allow',
            }),
          ]),
        }),
      });
    });

    it('configures the Lambda with the table name in its environment', () => {
      const { template } = buildAuthStack();

      template.hasResourceProperties('AWS::Lambda::Function', {
        Handler: 'index.handler',
        Environment: Match.objectLike({
          Variables: Match.objectLike({
            MAIN_TABLE_NAME: Match.anyValue(),
            ENVIRONMENT: 'development',
          }),
        }),
      });
    });
  });

  describe('Social identity providers', () => {
    it('creates a Google provider when enabled with SSM-backed credentials', () => {
      const { template, stack } = buildAuthStack({ google: true });

      expect(stack.enabledSocialProviders.map((p) => p.name)).toEqual(
        expect.arrayContaining(['COGNITO', 'Google'])
      );

      template.hasResourceProperties('AWS::Cognito::UserPoolIdentityProvider', {
        ProviderType: 'Google',
        ProviderDetails: Match.objectLike({
          authorize_scopes: 'openid email profile',
        }),
      });
    });

    it('creates a Facebook provider when enabled', () => {
      const { template, stack } = buildAuthStack({ facebook: true });

      expect(stack.enabledSocialProviders.map((p) => p.name)).toEqual(
        expect.arrayContaining(['Facebook'])
      );

      template.hasResourceProperties('AWS::Cognito::UserPoolIdentityProvider', {
        ProviderType: 'Facebook',
      });
    });

    it('creates a Login with Amazon provider when enabled', () => {
      const { template, stack } = buildAuthStack({ amazon: true });

      expect(stack.enabledSocialProviders.map((p) => p.name)).toEqual(
        expect.arrayContaining(['LoginWithAmazon'])
      );

      template.hasResourceProperties('AWS::Cognito::UserPoolIdentityProvider', {
        ProviderType: 'LoginWithAmazon',
        ProviderDetails: Match.objectLike({
          authorize_scopes: 'profile',
        }),
      });
    });

    it('enables every supported provider on the client when all are configured', () => {
      const { stack } = buildAuthStack({ google: true, facebook: true, amazon: true });

      expect(stack.enabledSocialProviders.map((p) => p.name).sort()).toEqual(
        ['COGNITO', 'Facebook', 'Google', 'LoginWithAmazon'].sort()
      );
    });

    // Apple is temporarily disabled — Apple Developer Program requires a paid
    // membership. Restore this case together with the `apple` entries in
    // EnvironmentConfig and AuthStack when enrollment is in place.
    // it('creates an Apple provider when enabled', () => {
    //   const { template, stack } = buildAuthStack({ apple: true });
    //
    //   expect(stack.enabledSocialProviders.map((p) => p.name)).toEqual(
    //     expect.arrayContaining(['SignInWithApple'])
    //   );
    //
    //   template.hasResourceProperties('AWS::Cognito::UserPoolIdentityProvider', {
    //     ProviderType: 'SignInWithApple',
    //   });
    // });
  });
});
