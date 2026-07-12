/**
 * Domain types for the Readafull single-table data model.
 *
 * Every record lives in one DynamoDB table (see StorageStack) keyed by PK/SK
 * with a single GSI (GSI1) for difficulty-based lookups. The `*Item` interfaces
 * describe the marshalled shape stored in DynamoDB; the plain domain interfaces
 * describe what callers work with.
 */

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

export type AudioQuality = 'low' | 'medium' | 'high';

export type EntityType = 'USER' | 'TEXT' | 'AUDIO';

export interface UserPreferences {
  defaultDifficulty: DifficultyLevel;
  showTranslationByDefault: boolean;
  audioQuality: AudioQuality;
  autoPlayTTS: boolean;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  defaultDifficulty: 'beginner',
  showTranslationByDefault: true,
  audioQuality: 'medium',
  autoPlayTTS: false,
};

/** A user profile created on first social sign-in. */
export interface UserProfile {
  userId: string;
  email: string | null;
  name: string;
  profilePicture: string | null;
  provider: string;
  preferences: UserPreferences;
  createdAt: string;
  lastLoginAt: string;
}

/** An AI-generated reading passage with its Japanese translation. */
export interface TextContent {
  userId: string;
  textId: string;
  englishText: string;
  japaneseTranslation: string;
  difficulty: DifficultyLevel;
  topic?: string;
  wordCount: number;
  createdAt: string;
  lastAccessedAt: string;
}

/** A recording or TTS playback session tied to a text. */
export interface AudioSession {
  userId: string;
  sessionId: string;
  textId: string;
  s3Key: string;
  duration: number;
  playbackCount: number;
  createdAt: string;
}

/** Fields callers supply when creating a text; ids/timestamps are generated. */
export type CreateTextInput = Omit<
  TextContent,
  'textId' | 'createdAt' | 'lastAccessedAt'
> & {
  textId?: string;
};

/** Fields callers supply when creating an audio session. */
export type CreateAudioSessionInput = Omit<
  AudioSession,
  'sessionId' | 'playbackCount' | 'createdAt'
> & {
  sessionId?: string;
  playbackCount?: number;
};
