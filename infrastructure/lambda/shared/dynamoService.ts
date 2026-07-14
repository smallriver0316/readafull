/**
 * DynamoDB data-access layer for the Readafull single-table design.
 *
 * Wraps the low-level Document Client with typed CRUD operations and the
 * user-specific access patterns documented in design_aws.md. Lambda handlers
 * should depend on this service rather than issuing raw DynamoDB commands so the
 * key scheme and marshalling stay in one place.
 */
import { randomUUID } from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  AudioSession,
  CreateAudioSessionInput,
  CreateTextInput,
  DEFAULT_USER_PREFERENCES,
  EntityType,
  TextContent,
  UserPreferences,
  UserProfile,
} from './types';
import {
  AUDIO_SK_PREFIX,
  TEXT_SK_PREFIX,
  audioSk,
  createdGsiSk,
  textGsiPk,
  profileSk,
  textSk,
  userPk,
} from './keys';

let cachedClient: DynamoDBDocumentClient | undefined;

const getDefaultClient = (): DynamoDBDocumentClient => {
  if (!cachedClient) {
    const region = process.env.AWS_REGION ?? 'ap-northeast-1';
    cachedClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return cachedClient;
};

/** Strip the internal key attributes, returning the plain domain object. */
const stripKeys = <T>(item: Record<string, unknown>): T => {
  const { PK, SK, GSI1PK, GSI1SK, entityType, ...rest } = item;
  return rest as T;
};

export interface DynamoServiceOptions {
  tableName?: string;
  client?: DynamoDBDocumentClient;
}

export class DynamoService {
  private readonly client: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor(options: DynamoServiceOptions = {}) {
    this.client = options.client ?? getDefaultClient();
    const tableName = options.tableName ?? process.env.MAIN_TABLE_NAME;
    if (!tableName) {
      throw new Error('MAIN_TABLE_NAME environment variable is not configured');
    }
    this.tableName = tableName;
  }

  // ---------------------------------------------------------------------------
  // User profile
  // ---------------------------------------------------------------------------

  /**
   * Create a user profile. Idempotent: a second create for the same user is a
   * no-op (returns false) thanks to the attribute_not_exists condition.
   */
  async createUserProfile(profile: UserProfile): Promise<boolean> {
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            PK: userPk(profile.userId),
            SK: profileSk(),
            entityType: 'USER' satisfies EntityType,
            ...profile,
          },
          ConditionExpression: 'attribute_not_exists(PK)',
        })
      );
      return true;
    } catch (error) {
      if ((error as { name?: string }).name === 'ConditionalCheckFailedException') {
        return false;
      }
      throw error;
    }
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: userPk(userId), SK: profileSk() },
      })
    );
    return result.Item ? stripKeys<UserProfile>(result.Item) : null;
  }

  /** Replace the user's preferences and return the updated profile. */
  async updateUserPreferences(
    userId: string,
    preferences: UserPreferences
  ): Promise<UserProfile> {
    const result = await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { PK: userPk(userId), SK: profileSk() },
        UpdateExpression: 'SET preferences = :prefs',
        ConditionExpression: 'attribute_exists(PK)',
        ExpressionAttributeValues: { ':prefs': preferences },
        ReturnValues: 'ALL_NEW',
      })
    );
    return stripKeys<UserProfile>(result.Attributes ?? {});
  }

  /** Touch the lastLoginAt timestamp on sign-in. */
  async updateLastLogin(
    userId: string,
    timestamp: string = new Date().toISOString()
  ): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { PK: userPk(userId), SK: profileSk() },
        UpdateExpression: 'SET lastLoginAt = :ts',
        ConditionExpression: 'attribute_exists(PK)',
        ExpressionAttributeValues: { ':ts': timestamp },
      })
    );
  }

  async deleteUserProfile(userId: string): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { PK: userPk(userId), SK: profileSk() },
      })
    );
  }

  // ---------------------------------------------------------------------------
  // Text content
  // ---------------------------------------------------------------------------

  /** Persist a generated text, generating the id and timestamps. */
  async saveText(input: CreateTextInput): Promise<TextContent> {
    const now = new Date().toISOString();
    const text: TextContent = {
      ...input,
      textId: input.textId ?? randomUUID(),
      createdAt: now,
      lastAccessedAt: now,
    };

    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: userPk(text.userId),
          SK: textSk(text.textId),
          GSI1PK: textGsiPk(
            text.learningLanguage,
            text.nativeLanguage,
            text.difficulty
          ),
          GSI1SK: createdGsiSk(text.createdAt),
          entityType: 'TEXT' satisfies EntityType,
          ...text,
        },
      })
    );

    return text;
  }

  async getText(userId: string, textId: string): Promise<TextContent | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: userPk(userId), SK: textSk(textId) },
      })
    );
    return result.Item ? stripKeys<TextContent>(result.Item) : null;
  }

  /**
   * List a user's saved texts, newest first. Texts share a partition, so this
   * is a single Query against PK with a SK begins_with filter.
   */
  async listUserTexts(
    userId: string,
    options: { limit?: number } = {}
  ): Promise<TextContent[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: {
          ':pk': userPk(userId),
          ':prefix': TEXT_SK_PREFIX,
        },
        ScanIndexForward: false,
        Limit: options.limit,
      })
    );
    return (result.Items ?? []).map((item) => stripKeys<TextContent>(item));
  }

  /**
   * List reusable texts for a language pair and difficulty across all users,
   * newest first, via GSI1. Used to surface previously generated content for
   * reuse; scoping by language pair keeps, e.g., English-for-Japanese texts
   * separate from English-for-Korean ones.
   */
  async listTextsByLanguageAndDifficulty(
    learningLanguage: string,
    nativeLanguage: string,
    difficulty: string,
    options: { limit?: number } = {}
  ): Promise<TextContent[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
          ':pk': textGsiPk(learningLanguage, nativeLanguage, difficulty),
        },
        ScanIndexForward: false,
        Limit: options.limit,
      })
    );
    return (result.Items ?? []).map((item) => stripKeys<TextContent>(item));
  }

  /** Record that a text was opened, for recency-based sorting in the UI. */
  async touchText(
    userId: string,
    textId: string,
    timestamp: string = new Date().toISOString()
  ): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { PK: userPk(userId), SK: textSk(textId) },
        UpdateExpression: 'SET lastAccessedAt = :ts',
        ConditionExpression: 'attribute_exists(PK)',
        ExpressionAttributeValues: { ':ts': timestamp },
      })
    );
  }

  async deleteText(userId: string, textId: string): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { PK: userPk(userId), SK: textSk(textId) },
      })
    );
  }

  // ---------------------------------------------------------------------------
  // Audio sessions
  // ---------------------------------------------------------------------------

  async saveAudioSession(
    input: CreateAudioSessionInput
  ): Promise<AudioSession> {
    const session: AudioSession = {
      ...input,
      sessionId: input.sessionId ?? randomUUID(),
      playbackCount: input.playbackCount ?? 0,
      createdAt: new Date().toISOString(),
    };

    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: userPk(session.userId),
          SK: audioSk(session.sessionId),
          entityType: 'AUDIO' satisfies EntityType,
          ...session,
        },
      })
    );

    return session;
  }

  async getAudioSession(
    userId: string,
    sessionId: string
  ): Promise<AudioSession | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: userPk(userId), SK: audioSk(sessionId) },
      })
    );
    return result.Item ? stripKeys<AudioSession>(result.Item) : null;
  }

  async listUserAudioSessions(
    userId: string,
    options: { limit?: number } = {}
  ): Promise<AudioSession[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: {
          ':pk': userPk(userId),
          ':prefix': AUDIO_SK_PREFIX,
        },
        ScanIndexForward: false,
        Limit: options.limit,
      })
    );
    return (result.Items ?? []).map((item) => stripKeys<AudioSession>(item));
  }

  /** Atomically increment playbackCount and return the new value. */
  async incrementPlaybackCount(
    userId: string,
    sessionId: string
  ): Promise<number> {
    const result = await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { PK: userPk(userId), SK: audioSk(sessionId) },
        UpdateExpression:
          'SET playbackCount = if_not_exists(playbackCount, :zero) + :one',
        ConditionExpression: 'attribute_exists(PK)',
        ExpressionAttributeValues: { ':zero': 0, ':one': 1 },
        ReturnValues: 'UPDATED_NEW',
      })
    );
    return (result.Attributes?.playbackCount as number) ?? 0;
  }

  async deleteAudioSession(userId: string, sessionId: string): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { PK: userPk(userId), SK: audioSk(sessionId) },
      })
    );
  }
}

/** Shared default instance for Lambda handlers (lazily constructed). */
let defaultService: DynamoService | undefined;

export const getDynamoService = (): DynamoService => {
  if (!defaultService) {
    defaultService = new DynamoService();
  }
  return defaultService;
};
