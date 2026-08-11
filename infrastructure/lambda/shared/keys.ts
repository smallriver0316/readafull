/**
 * Key builders for the single-table design.
 *
 * Centralising key construction keeps the PK/SK conventions in one place so the
 * service layer and any future consumers never hand-craft key strings. The
 * scheme matches the access patterns documented in design_aws.md:
 *
 *   1. User profile:        PK = USER#<userId>,  SK = PROFILE#main
 *   2. User texts:          PK = USER#<userId>,  SK begins_with TEXT#
 *   3. User audio sessions: PK = USER#<userId>,  SK begins_with AUDIO#
 *   4. Reusable texts by language pair + difficulty:
 *      GSI1PK = LANG#<learning>#NATIVE#<native>#DIFF#<level>, GSI1SK = CREATED#<ts>
 */

export const PROFILE_SK = 'PROFILE#main';
export const TEXT_SK_PREFIX = 'TEXT#';
export const AUDIO_SK_PREFIX = 'AUDIO#';

export const userPk = (userId: string): string => `USER#${userId}`;

export const profileSk = (): string => PROFILE_SK;

export const textSk = (textId: string): string => `${TEXT_SK_PREFIX}${textId}`;

export const audioSk = (sessionId: string): string =>
  `${AUDIO_SK_PREFIX}${sessionId}`;

/**
 * GSI1 partition key for surfacing reusable texts. Scoped by language pair so a
 * given learning/native combination never mixes with another when querying by
 * difficulty (e.g. English-for-Japanese vs. English-for-Korean stay separate).
 */
export const textGsiPk = (
  learningLanguage: string,
  nativeLanguage: string,
  difficulty: string
): string =>
  `LANG#${learningLanguage}#NATIVE#${nativeLanguage}#DIFF#${difficulty}`;

export const createdGsiSk = (timestamp: string): string =>
  `CREATED#${timestamp}`;
