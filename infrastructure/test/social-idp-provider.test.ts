import { mockClient } from 'aws-sdk-client-mock';
import type { CdkCustomResourceEvent } from 'aws-lambda';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import {
  CognitoIdentityProviderClient,
  CreateIdentityProviderCommand,
  DeleteIdentityProviderCommand,
  DescribeIdentityProviderCommand,
  UpdateIdentityProviderCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { handler } from '../lambda/custom-resources/socialIdpProvider';

const ssmMock = mockClient(SSMClient);
const cognitoMock = mockClient(CognitoIdentityProviderClient);

const baseProperties = {
  ServiceToken: 'arn:aws:lambda:ap-northeast-1:123456789012:function:framework',
  UserPoolId: 'ap-northeast-1_test',
  ProviderName: 'Google',
  ProviderType: 'Google',
  SecretParameterNames: {
    client_id: '/readafull/development/auth/google/client-id',
    client_secret: '/readafull/development/auth/google/client-secret',
  },
  StaticProviderDetails: { authorize_scopes: 'openid email profile' },
  AttributeMapping: { email: 'email' },
};

const buildEvent = (
  requestType: 'Create' | 'Update' | 'Delete',
  overrides: Record<string, unknown> = {}
): CdkCustomResourceEvent =>
  ({
    RequestType: requestType,
    ServiceToken: baseProperties.ServiceToken,
    ResponseURL: 'https://example.com',
    StackId: 'stack',
    RequestId: 'req',
    LogicalResourceId: 'GoogleProvider',
    ResourceType: 'Custom::CognitoSocialIdentityProvider',
    ResourceProperties: baseProperties,
    PhysicalResourceId: 'ap-northeast-1_test:Google',
    ...overrides,
  } as unknown as CdkCustomResourceEvent);

describe('social IdP custom resource handler', () => {
  beforeEach(() => {
    ssmMock.reset();
    cognitoMock.reset();
    process.env.AWS_REGION = 'ap-northeast-1';
    ssmMock.on(GetParameterCommand, {
      Name: '/readafull/development/auth/google/client-id',
    }).resolves({ Parameter: { Value: 'client-id-value' } });
    ssmMock.on(GetParameterCommand, {
      Name: '/readafull/development/auth/google/client-secret',
    }).resolves({ Parameter: { Value: 'super-secret' } });
  });

  it('creates the provider with decrypted SSM secrets merged into ProviderDetails', async () => {
    cognitoMock.on(DescribeIdentityProviderCommand).rejects(
      Object.assign(new Error('missing'), { name: 'ResourceNotFoundException' })
    );
    cognitoMock.on(CreateIdentityProviderCommand).resolves({});

    const result = await handler(buildEvent('Create'));

    expect(result.PhysicalResourceId).toBe('ap-northeast-1_test:Google');
    // Secrets are fetched with decryption.
    expect(
      ssmMock.commandCalls(GetParameterCommand)[0].args[0].input.WithDecryption
    ).toBe(true);

    const createCalls = cognitoMock.commandCalls(CreateIdentityProviderCommand);
    expect(createCalls).toHaveLength(1);
    expect(createCalls[0].args[0].input).toMatchObject({
      UserPoolId: 'ap-northeast-1_test',
      ProviderName: 'Google',
      ProviderType: 'Google',
      ProviderDetails: {
        authorize_scopes: 'openid email profile',
        client_id: 'client-id-value',
        client_secret: 'super-secret',
      },
      AttributeMapping: { email: 'email' },
    });
  });

  it('updates the provider when it already exists', async () => {
    cognitoMock.on(DescribeIdentityProviderCommand).resolves({});
    cognitoMock.on(UpdateIdentityProviderCommand).resolves({});

    await handler(buildEvent('Update'));

    expect(cognitoMock.commandCalls(UpdateIdentityProviderCommand)).toHaveLength(1);
    expect(cognitoMock.commandCalls(CreateIdentityProviderCommand)).toHaveLength(0);
  });

  it('deletes the provider on Delete', async () => {
    cognitoMock.on(DeleteIdentityProviderCommand).resolves({});

    const result = await handler(buildEvent('Delete'));

    expect(result.PhysicalResourceId).toBe('ap-northeast-1_test:Google');
    const deleteCalls = cognitoMock.commandCalls(DeleteIdentityProviderCommand);
    expect(deleteCalls).toHaveLength(1);
    expect(deleteCalls[0].args[0].input).toMatchObject({
      UserPoolId: 'ap-northeast-1_test',
      ProviderName: 'Google',
    });
  });

  it('treats a missing provider/pool as an idempotent delete', async () => {
    cognitoMock.on(DeleteIdentityProviderCommand).rejects(
      Object.assign(new Error('gone'), { name: 'ResourceNotFoundException' })
    );

    await expect(handler(buildEvent('Delete'))).resolves.toBeDefined();
  });

  it('throws when an SSM parameter is empty so the deploy fails loudly', async () => {
    ssmMock.on(GetParameterCommand, {
      Name: '/readafull/development/auth/google/client-secret',
    }).resolves({ Parameter: { Value: '' } });
    cognitoMock.on(DescribeIdentityProviderCommand).rejects(
      Object.assign(new Error('missing'), { name: 'ResourceNotFoundException' })
    );

    await expect(handler(buildEvent('Create'))).rejects.toThrow(/client-secret/);
  });

  it('rethrows unexpected Cognito errors', async () => {
    cognitoMock.on(DescribeIdentityProviderCommand).rejects(new Error('throttled'));

    await expect(handler(buildEvent('Create'))).rejects.toThrow('throttled');
  });
});
