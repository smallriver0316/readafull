import { mockClient } from 'aws-sdk-client-mock';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  DynamoService,
  UserProfile,
  DEFAULT_USER_PREFERENCES,
} from '../lambda/shared';

const ddbMock = mockClient(DynamoDBDocumentClient);

const TABLE = 'readafull-main-table-test';

const buildService = () => new DynamoService({ tableName: TABLE });

const sampleProfile: UserProfile = {
  userId: 'user-1',
  email: 'user@example.com',
  name: 'Test User',
  profilePicture: null,
  provider: 'google',
  preferences: DEFAULT_USER_PREFERENCES,
  createdAt: '2026-01-01T00:00:00.000Z',
  lastLoginAt: '2026-01-01T00:00:00.000Z',
};

const lastInput = (command: any) => {
  const calls = ddbMock.commandCalls(command);
  return calls[calls.length - 1].args[0].input;
};

describe('DynamoService', () => {
  beforeEach(() => {
    ddbMock.reset();
  });

  describe('construction', () => {
    it('throws when no table name is provided and env is unset', () => {
      const original = process.env.MAIN_TABLE_NAME;
      delete process.env.MAIN_TABLE_NAME;
      expect(() => new DynamoService()).toThrow(/MAIN_TABLE_NAME/);
      if (original !== undefined) process.env.MAIN_TABLE_NAME = original;
    });

    it('reads the table name from MAIN_TABLE_NAME when not passed', () => {
      process.env.MAIN_TABLE_NAME = 'env-table';
      ddbMock.on(GetCommand).resolves({});
      expect(() => new DynamoService()).not.toThrow();
      delete process.env.MAIN_TABLE_NAME;
    });
  });

  describe('user profile', () => {
    it('creates a profile with USER keys and entityType', async () => {
      ddbMock.on(PutCommand).resolves({});

      const created = await buildService().createUserProfile(sampleProfile);

      expect(created).toBe(true);
      const input = lastInput(PutCommand);
      expect(input.TableName).toBe(TABLE);
      expect(input.ConditionExpression).toBe('attribute_not_exists(PK)');
      expect(input.Item).toMatchObject({
        PK: 'USER#user-1',
        SK: 'PROFILE#main',
        entityType: 'USER',
        userId: 'user-1',
        provider: 'google',
        preferences: DEFAULT_USER_PREFERENCES,
      });
    });

    it('returns false when the profile already exists (idempotent create)', async () => {
      ddbMock.on(PutCommand).rejects(
        Object.assign(new Error('exists'), {
          name: 'ConditionalCheckFailedException',
        })
      );

      await expect(
        buildService().createUserProfile(sampleProfile)
      ).resolves.toBe(false);
    });

    it('rethrows unexpected errors on create', async () => {
      ddbMock.on(PutCommand).rejects(new Error('throttled'));
      await expect(
        buildService().createUserProfile(sampleProfile)
      ).rejects.toThrow('throttled');
    });

    it('gets a profile and strips internal key attributes', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          PK: 'USER#user-1',
          SK: 'PROFILE#main',
          entityType: 'USER',
          ...sampleProfile,
        },
      });

      const profile = await buildService().getUserProfile('user-1');

      expect(profile).toEqual(sampleProfile);
      expect(profile).not.toHaveProperty('PK');
      expect(profile).not.toHaveProperty('entityType');
      expect(lastInput(GetCommand).Key).toEqual({
        PK: 'USER#user-1',
        SK: 'PROFILE#main',
      });
    });

    it('returns null when the profile is not found', async () => {
      ddbMock.on(GetCommand).resolves({});
      await expect(buildService().getUserProfile('missing')).resolves.toBeNull();
    });

    it('updates preferences guarded by attribute_exists', async () => {
      const newPrefs = { ...DEFAULT_USER_PREFERENCES, autoPlayTTS: true };
      ddbMock.on(UpdateCommand).resolves({
        Attributes: {
          PK: 'USER#user-1',
          SK: 'PROFILE#main',
          ...sampleProfile,
          preferences: newPrefs,
        },
      });

      const updated = await buildService().updateUserPreferences(
        'user-1',
        newPrefs
      );

      expect(updated.preferences).toEqual(newPrefs);
      const input = lastInput(UpdateCommand);
      expect(input.ConditionExpression).toBe('attribute_exists(PK)');
      expect(input.ExpressionAttributeValues[':prefs']).toEqual(newPrefs);
      expect(input.ReturnValues).toBe('ALL_NEW');
    });

    it('updates the last login timestamp', async () => {
      ddbMock.on(UpdateCommand).resolves({});
      await buildService().updateLastLogin('user-1', '2026-06-20T00:00:00.000Z');

      const input = lastInput(UpdateCommand);
      expect(input.UpdateExpression).toBe('SET lastLoginAt = :ts');
      expect(input.ExpressionAttributeValues[':ts']).toBe(
        '2026-06-20T00:00:00.000Z'
      );
    });

    it('deletes a profile by key', async () => {
      ddbMock.on(DeleteCommand).resolves({});
      await buildService().deleteUserProfile('user-1');
      expect(lastInput(DeleteCommand).Key).toEqual({
        PK: 'USER#user-1',
        SK: 'PROFILE#main',
      });
    });
  });

  describe('text content', () => {
    const textInput = {
      userId: 'user-1',
      learningLanguage: 'en',
      nativeLanguage: 'ja',
      content: 'Hello world.',
      translation: 'こんにちは世界。',
      difficulty: 'beginner' as const,
      topic: 'greetings',
      wordCount: 2,
    };

    it('saves a text generating id, timestamps and GSI keys', async () => {
      ddbMock.on(PutCommand).resolves({});

      const saved = await buildService().saveText(textInput);

      expect(saved.textId).toMatch(/[0-9a-f-]{36}/);
      expect(saved.createdAt).toBe(saved.lastAccessedAt);

      const input = lastInput(PutCommand);
      expect(input.Item).toMatchObject({
        PK: 'USER#user-1',
        SK: `TEXT#${saved.textId}`,
        GSI1PK: 'LANG#en#NATIVE#ja#DIFF#beginner',
        GSI1SK: `CREATED#${saved.createdAt}`,
        entityType: 'TEXT',
        content: 'Hello world.',
      });
    });

    it('honours a caller-supplied textId', async () => {
      ddbMock.on(PutCommand).resolves({});
      const saved = await buildService().saveText({
        ...textInput,
        textId: 'fixed-id',
      });
      expect(saved.textId).toBe('fixed-id');
      expect(lastInput(PutCommand).Item.SK).toBe('TEXT#fixed-id');
    });

    it('gets a text by user and id', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          PK: 'USER#user-1',
          SK: 'TEXT#t1',
          GSI1PK: 'LANG#en#NATIVE#ja#DIFF#beginner',
          GSI1SK: 'CREATED#2026-01-01T00:00:00.000Z',
          entityType: 'TEXT',
          userId: 'user-1',
          textId: 't1',
          content: 'Hi.',
        },
      });

      const text = await buildService().getText('user-1', 't1');
      expect(text).toMatchObject({ textId: 't1', content: 'Hi.' });
      expect(text).not.toHaveProperty('GSI1PK');
    });

    it('lists user texts newest-first using begins_with on SK', async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: [
          { PK: 'USER#user-1', SK: 'TEXT#t2', textId: 't2', entityType: 'TEXT' },
          { PK: 'USER#user-1', SK: 'TEXT#t1', textId: 't1', entityType: 'TEXT' },
        ],
      });

      const texts = await buildService().listUserTexts('user-1', { limit: 10 });

      expect(texts).toHaveLength(2);
      const input = lastInput(QueryCommand);
      expect(input.KeyConditionExpression).toBe(
        'PK = :pk AND begins_with(SK, :prefix)'
      );
      expect(input.ExpressionAttributeValues).toEqual({
        ':pk': 'USER#user-1',
        ':prefix': 'TEXT#',
      });
      expect(input.ScanIndexForward).toBe(false);
      expect(input.Limit).toBe(10);
    });

    it('lists texts by language pair and difficulty via GSI1', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      await buildService().listTextsByLanguageAndDifficulty(
        'en',
        'ja',
        'intermediate'
      );

      const input = lastInput(QueryCommand);
      expect(input.IndexName).toBe('GSI1');
      expect(input.KeyConditionExpression).toBe('GSI1PK = :pk');
      expect(input.ExpressionAttributeValues[':pk']).toBe(
        'LANG#en#NATIVE#ja#DIFF#intermediate'
      );
    });

    it('touches lastAccessedAt', async () => {
      ddbMock.on(UpdateCommand).resolves({});
      await buildService().touchText('user-1', 't1', '2026-06-20T12:00:00.000Z');

      const input = lastInput(UpdateCommand);
      expect(input.UpdateExpression).toBe('SET lastAccessedAt = :ts');
      expect(input.Key).toEqual({ PK: 'USER#user-1', SK: 'TEXT#t1' });
    });

    it('deletes a text by key', async () => {
      ddbMock.on(DeleteCommand).resolves({});
      await buildService().deleteText('user-1', 't1');
      expect(lastInput(DeleteCommand).Key).toEqual({
        PK: 'USER#user-1',
        SK: 'TEXT#t1',
      });
    });
  });

  describe('audio sessions', () => {
    const audioInput = {
      userId: 'user-1',
      textId: 't1',
      s3Key: 'recordings/user-1/clip.mp3',
      duration: 12,
    };

    it('saves an audio session defaulting playbackCount to 0', async () => {
      ddbMock.on(PutCommand).resolves({});

      const saved = await buildService().saveAudioSession(audioInput);

      expect(saved.sessionId).toMatch(/[0-9a-f-]{36}/);
      expect(saved.playbackCount).toBe(0);
      const input = lastInput(PutCommand);
      expect(input.Item).toMatchObject({
        PK: 'USER#user-1',
        SK: `AUDIO#${saved.sessionId}`,
        entityType: 'AUDIO',
        textId: 't1',
        playbackCount: 0,
      });
    });

    it('gets an audio session', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          PK: 'USER#user-1',
          SK: 'AUDIO#s1',
          entityType: 'AUDIO',
          userId: 'user-1',
          sessionId: 's1',
        },
      });
      const session = await buildService().getAudioSession('user-1', 's1');
      expect(session).toMatchObject({ sessionId: 's1' });
    });

    it('lists user audio sessions with begins_with AUDIO#', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });
      await buildService().listUserAudioSessions('user-1');

      const input = lastInput(QueryCommand);
      expect(input.ExpressionAttributeValues[':prefix']).toBe('AUDIO#');
      expect(input.ScanIndexForward).toBe(false);
    });

    it('increments playback count atomically and returns new value', async () => {
      ddbMock.on(UpdateCommand).resolves({ Attributes: { playbackCount: 3 } });

      const count = await buildService().incrementPlaybackCount('user-1', 's1');

      expect(count).toBe(3);
      const input = lastInput(UpdateCommand);
      expect(input.UpdateExpression).toBe(
        'SET playbackCount = if_not_exists(playbackCount, :zero) + :one'
      );
      expect(input.ExpressionAttributeValues).toEqual({ ':zero': 0, ':one': 1 });
      expect(input.ReturnValues).toBe('UPDATED_NEW');
    });

    it('deletes an audio session by key', async () => {
      ddbMock.on(DeleteCommand).resolves({});
      await buildService().deleteAudioSession('user-1', 's1');
      expect(lastInput(DeleteCommand).Key).toEqual({
        PK: 'USER#user-1',
        SK: 'AUDIO#s1',
      });
    });
  });
});
