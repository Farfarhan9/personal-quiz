import type { ProgressStore, Settings, TopicProgress } from '../types';

export const KEYS = {
  progress: 'quiz-app:progress:v1',
  settings: 'quiz-app:settings:v1',
  authorDraft: 'quiz-app:author-draft:v1',
} as const;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Reads JSON from localStorage. Any failure (missing, malformed, blocked storage) returns the fallback. */
function readJson<T>(key: string, guard: (v: unknown) => T | null, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    const value = guard(parsed);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Storage full, private mode, or disabled: the app keeps working without persistence.
    return false;
  }
}

function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/* ---------------------------- Progress ---------------------------- */

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function toTopicProgress(v: unknown): TopicProgress | null {
  if (!isRecord(v)) return null;
  const attempts = num(v.attempts);
  const bestScore = num(v.bestScore);
  const bestTotal = num(v.bestTotal);
  const lastScore = num(v.lastScore);
  const lastTotal = num(v.lastTotal);
  if (attempts === null || bestScore === null || bestTotal === null || lastScore === null || lastTotal === null) {
    return null;
  }
  const pct = (s: number, t: number) => (t > 0 ? Math.round((s / t) * 100) : 0);
  const duration = num(v.lastDurationSec);
  return {
    attempts,
    bestScore,
    bestTotal,
    bestPercent: num(v.bestPercent) ?? pct(bestScore, bestTotal),
    lastScore,
    lastTotal,
    lastPercent: num(v.lastPercent) ?? pct(lastScore, lastTotal),
    lastCompletedAt: typeof v.lastCompletedAt === 'string' ? v.lastCompletedAt : new Date(0).toISOString(),
    ...(duration !== null ? { lastDurationSec: duration } : {}),
  };
}

function toProgressStore(v: unknown): ProgressStore | null {
  if (!isRecord(v)) return null;
  const out: ProgressStore = {};
  for (const [key, value] of Object.entries(v)) {
    const p = toTopicProgress(value);
    if (p) out[key] = p; // silently drop malformed entries
  }
  return out;
}

export function progressKey(subjectId: string, topicId: string): string {
  return `${subjectId}/${topicId}`;
}

export function getAllProgress(): ProgressStore {
  return readJson(KEYS.progress, toProgressStore, {});
}

export function getTopicProgress(subjectId: string, topicId: string): TopicProgress | undefined {
  return getAllProgress()[progressKey(subjectId, topicId)];
}

export function recordResult(
  subjectId: string,
  topicId: string,
  score: number,
  total: number,
  durationSec: number,
): TopicProgress {
  const all = getAllProgress();
  const key = progressKey(subjectId, topicId);
  const prev = all[key];
  const percent = total > 0 ? Math.round((score / total) * 100) : 0;
  const keepPrevBest =
    prev !== undefined && (prev.bestPercent > percent || (prev.bestPercent === percent && prev.bestScore >= score));
  const next: TopicProgress = {
    attempts: (prev?.attempts ?? 0) + 1,
    bestScore: keepPrevBest ? prev.bestScore : score,
    bestTotal: keepPrevBest ? prev.bestTotal : total,
    bestPercent: keepPrevBest ? prev.bestPercent : percent,
    lastScore: score,
    lastTotal: total,
    lastPercent: percent,
    lastCompletedAt: new Date().toISOString(),
    lastDurationSec: durationSec,
  };
  all[key] = next;
  writeJson(KEYS.progress, all);
  return next;
}

export function clearProgress(): void {
  removeKey(KEYS.progress);
}

/* ---------------------------- Settings ---------------------------- */

export const DEFAULT_SETTINGS: Settings = { theme: 'light', shuffleQuestions: false, shuffleOptions: false };

function toSettings(v: unknown): Settings | null {
  if (!isRecord(v)) return null;
  return {
    theme: v.theme === 'dark' ? 'dark' : 'light',
    shuffleQuestions: v.shuffleQuestions === true,
    shuffleOptions: v.shuffleOptions === true,
  };
}

export function getSettings(): Settings {
  return readJson(KEYS.settings, toSettings, DEFAULT_SETTINGS);
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const next = { ...getSettings(), ...patch };
  writeJson(KEYS.settings, next);
  return next;
}

/* -------------------------- Author draft -------------------------- */

export interface AuthorDraftRecord {
  version: 1;
  savedAt: string;
  data: unknown;
}

function toDraft(v: unknown): AuthorDraftRecord | null {
  if (!isRecord(v) || v.version !== 1 || !('data' in v)) return null;
  return { version: 1, savedAt: typeof v.savedAt === 'string' ? v.savedAt : '', data: v.data };
}

export function getAuthorDraft(): AuthorDraftRecord | null {
  return readJson<AuthorDraftRecord | null>(KEYS.authorDraft, toDraft, null);
}

export function saveAuthorDraft(data: unknown): string | null {
  const savedAt = new Date().toISOString();
  return writeJson(KEYS.authorDraft, { version: 1, savedAt, data }) ? savedAt : null;
}

export function clearAuthorDraft(): void {
  removeKey(KEYS.authorDraft);
}
