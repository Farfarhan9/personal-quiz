import type { Subject, SubjectIndex, SubjectIndexEntry } from '../types';
import { formatIssues, validateIndex, validateSubject } from './validate';

const BASE = import.meta.env.BASE_URL;

/** Resolves a path relative to /public so it works under any GitHub Pages base path. */
export function assetUrl(path: string): string {
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return `${BASE}${path.replace(/^\.?\//, '')}`;
}

const cache = new Map<string, Promise<unknown>>();

async function fetchJson(path: string): Promise<unknown> {
  const url = assetUrl(path);
  const existing = cache.get(url);
  if (existing) return existing;
  const request = fetch(url, { cache: 'no-cache' })
    .then(async (res) => {
      if (!res.ok) throw new Error(`Could not load ${path} (HTTP ${res.status}).`);
      try {
        return (await res.json()) as unknown;
      } catch {
        throw new Error(`${path} is not valid JSON.`);
      }
    })
    .catch((err: unknown) => {
      cache.delete(url);
      throw err instanceof Error ? err : new Error(String(err));
    });
  cache.set(url, request);
  return request;
}

export async function loadIndex(): Promise<SubjectIndex> {
  const raw = await fetchJson('data/index.json');
  const result = validateIndex(raw);
  if (!result.ok) throw new Error(`data/index.json has problems:\n${formatIssues(result.issues)}`);
  return result.value;
}

export interface LoadedSubject {
  entry: SubjectIndexEntry;
  subject: Subject;
}

export async function loadSubjectFromEntry(entry: SubjectIndexEntry): Promise<Subject> {
  const path = `data/${entry.file.replace(/^\.?\//, '')}`;
  const raw = await fetchJson(path);
  const result = validateSubject(raw);
  if (!result.ok) throw new Error(`${path} has problems:\n${formatIssues(result.issues)}`);
  return result.value;
}

export class NotFoundError extends Error {}

export async function loadSubject(subjectId: string): Promise<LoadedSubject> {
  const index = await loadIndex();
  const entry = index.subjects.find((s) => s.id === subjectId);
  if (!entry) throw new NotFoundError(`No subject called "${subjectId}".`);
  const subject = await loadSubjectFromEntry(entry);
  return { entry, subject };
}

/** Clears cached responses (used by "Try again" buttons). */
export function clearDataCache(): void {
  cache.clear();
}
