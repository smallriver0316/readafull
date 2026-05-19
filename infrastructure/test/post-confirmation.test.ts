import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { PostConfirmationTriggerEvent } from 'aws-lambda';
import { handler } from '../lambda/auth-triggers/postConfirmation';

const buildEvent = (
  overrides: Partial<PostConfirmationTriggerEvent['request']> = {},
  triggerSource: PostConfirmationTriggerEvent['triggerSource'] = 'PostConfirmation_ConfirmSignUp'
): PostConfirmationTriggerEvent =>
  ({
    version: '1',
    region: 'ap-northeast-1',
    userPoolId: 'ap-northeast-1_test',
    userName: 'social-user',
    callerContext: { awsSdkVersion: 'test', clientId: 'test-client' },
    triggerSource,
    request: {
      userAttributes: {
        sub: 'user-uuid-123',
        email: 'user@example.com',
        name: 'Test User',
        picture: 'https://cdn.example.com/avatar.png',
        identities: JSON.stringify([
          { providerName: 'Google', providerType: 'Google', userId: 'g-123', primary: true },
        ]),
      },
      ...overrides,
    },
    response: {},
  } as PostConfirmationTriggerEvent);

const ddbMock = mockClient(DynamoDBDocumentClient);

const ORIGINAL_ENV = { ...process.env };

describe('post-confirmation trigger', () => {
  beforeEach(() => {
    ddbMock.reset();
    process.env.MAIN_TABLE_NAME = 'readafull-main-table-dev';
    process.env.AWS_REGION = 'ap-northeast-1';
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('writes a USER profile item with provider and default preferences', async () => {
    ddbMock.on(PutCommand).resolves({});

    const event = buildEvent();
    const result = await handler(event);

    expect(result).toBe(event);
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(1);
    const call = ddbMock.commandCalls(PutCommand)[0];
    expect(call.args[0].input).toMatchObject({
      TableName: 'readafull-main-table-dev',
      ConditionExpression: 'attribute_not_exists(PK)',
      Item: {
        PK: 'USER#user-uuid-123',
        SK: 'PROFILE#main',
        entityType: 'USER',
        userId: 'user-uuid-123',
        email: 'user@example.com',
        name: 'Test User',
        profilePicture: 'https://cdn.example.com/avatar.png',
        provider: 'google',
        preferences: {
          defaultDifficulty: 'beginner',
          showTranslationByDefault: true,
          audioQuality: 'medium',
          autoPlayTTS: false,
        },
      },
    });
  });

  it('falls back to "cognito" provider when no identities attribute is present', async () => {
    ddbMock.on(PutCommand).resolves({});
    const event = buildEvent({
      userAttributes: {
        sub: 'native-user',
        email: 'native@example.com',
      },
    });
    await handler(event);

    const call = ddbMock.commandCalls(PutCommand)[0];
    expect((call.args[0].input.Item as Record<string, unknown>).provider).toBe('cognito');
  });

  it('returns event without writing when triggered for events other than ConfirmSignUp', async () => {
    const event = buildEvent({}, 'PostConfirmation_ConfirmForgotPassword');
    const result = await handler(event);

    expect(result).toBe(event);
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
  });

  it('treats ConditionalCheckFailedException as idempotent success', async () => {
    const conditionalError = Object.assign(new Error('exists'), {
      name: 'ConditionalCheckFailedException',
    });
    ddbMock.on(PutCommand).rejects(conditionalError);
    await expect(handler(buildEvent())).resolves.toBeDefined();
  });

  it('rethrows other DynamoDB errors so Cognito surfaces the failure', async () => {
    ddbMock.on(PutCommand).rejects(new Error('throttled'));
    await expect(handler(buildEvent())).rejects.toThrow('throttled');
  });

  it('throws when the table name is not configured', async () => {
    delete process.env.MAIN_TABLE_NAME;
    await expect(handler(buildEvent())).rejects.toThrow(/MAIN_TABLE_NAME/);
  });

  it('throws when the Cognito event is missing the sub attribute', async () => {
    const event = buildEvent({ userAttributes: {} });
    await expect(handler(event)).rejects.toThrow(/sub attribute/);
  });
});
