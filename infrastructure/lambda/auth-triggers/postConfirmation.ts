import type { PostConfirmationTriggerEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  PutCommandInput,
} from '@aws-sdk/lib-dynamodb';

let cachedClient: DynamoDBDocumentClient | undefined;

const getClient = (): DynamoDBDocumentClient => {
  if (!cachedClient) {
    const region = process.env.AWS_REGION ?? 'ap-northeast-1';
    cachedClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
  }
  return cachedClient;
};

interface FederatedIdentity {
  providerName?: string;
  providerType?: string;
  userId?: string;
}

const parseProvider = (identitiesAttr?: string): string => {
  if (!identitiesAttr) {
    return 'cognito';
  }
  try {
    const identities = JSON.parse(identitiesAttr) as FederatedIdentity[];
    const primary = identities.find((id) => id.providerName) ?? identities[0];
    return primary?.providerName?.toLowerCase() ?? 'cognito';
  } catch {
    return 'cognito';
  }
};

const defaultPreferences = {
  defaultDifficulty: 'beginner',
  showTranslationByDefault: true,
  audioQuality: 'medium',
  autoPlayTTS: false,
};

export const handler = async (
  event: PostConfirmationTriggerEvent
): Promise<PostConfirmationTriggerEvent> => {
  if (event.triggerSource !== 'PostConfirmation_ConfirmSignUp') {
    return event;
  }

  const tableName = process.env.MAIN_TABLE_NAME;
  if (!tableName) {
    throw new Error('MAIN_TABLE_NAME environment variable is not configured');
  }

  const attrs = event.request.userAttributes ?? {};
  const userId = attrs.sub;
  if (!userId) {
    throw new Error('Cognito event is missing the sub attribute');
  }

  const provider = parseProvider(attrs.identities);
  const now = new Date().toISOString();

  const item: Record<string, unknown> = {
    PK: `USER#${userId}`,
    SK: 'PROFILE#main',
    entityType: 'USER',
    userId,
    email: attrs.email ?? null,
    name: attrs.name ?? attrs.given_name ?? 'User',
    profilePicture: attrs.picture ?? null,
    provider,
    preferences: defaultPreferences,
    createdAt: now,
    lastLoginAt: now,
  };

  const params: PutCommandInput = {
    TableName: tableName,
    Item: item,
    ConditionExpression: 'attribute_not_exists(PK)',
  };

  try {
    await getClient().send(new PutCommand(params));
  } catch (error) {
    const err = error as { name?: string };
    if (err.name === 'ConditionalCheckFailedException') {
      // Profile already exists — federated re-signup is idempotent.
      return event;
    }
    console.error('post-confirmation trigger failed', error);
    throw error;
  }

  return event;
};
