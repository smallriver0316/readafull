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

/**
 * A BCP-47 language code (e.g. "en", "ja", "ko"). Kept as a string alias rather
 * than a closed union so new languages can be enabled without a code change.
 */
export type LanguageCode = string;

export interface UserPreferences {
  /** Target language the user is studying (source of generated text/TTS). */
  learningLanguage: LanguageCode;
  /** Language translations are rendered into (the user's native language). */
  nativeLanguage: LanguageCode;
  defaultDifficulty: DifficultyLevel;
  showTranslationByDefault: boolean;
  audioQuality: AudioQuality;
  autoPlayTTS: boolean;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  learningLanguage: 'en',
  nativeLanguage: 'ja',
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

/** An AI-generated reading passage with its translation into the native language. */
export interface TextContent {
  userId: string;
  textId: string;
  /** BCP-47 code the passage is written in (the language being studied). */
  learningLanguage: LanguageCode;
  /** BCP-47 code the `translation` is written in (the user's native language). */
  nativeLanguage: LanguageCode;
  /** The passage in `learningLanguage`. */
  content: string;
  /** `content` translated into `nativeLanguage`. */
  translation: string;
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
