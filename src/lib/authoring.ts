import {
  DIFFICULTIES,
  QUESTION_TYPES,
  type ChoiceOption,
  type Difficulty,
  type Question,
  type QuestionType,
  type QuizImage,
  type Subject,
  type Topic,
} from '../types';
import { assertNever, isChoiceQuestion } from './grading';
import { defaultTrueFalseOptions } from './validate';
import { slugify } from './utils';

export interface AuthorMeta {
  icon: string;
  color: string;
}

export interface AuthorDraft {
  subject: Subject;
  meta: AuthorMeta;
}

export const DEFAULT_META: AuthorMeta = { icon: '📘', color: '#0f6e64' };

/* ------------------------------ ids ------------------------------ */

export function allQuestionIds(subject: Subject): Set<string> {
  return new Set(subject.topics.flatMap((t) => t.questions.map((q) => q.id)));
}

export function uniqueQuestionId(subject: Subject, topicId: string): string {
  const ids = allQuestionIds(subject);
  const base = slugify(topicId) || 'q';
  let n = 1;
  while (ids.has(`${base}-${String(n).padStart(3, '0')}`)) n += 1;
  return `${base}-${String(n).padStart(3, '0')}`;
}

export function uniqueTopicId(subject: Subject, title: string): string {
  const ids = new Set(subject.topics.map((t) => t.id));
  const base = slugify(title) || 'topic';
  if (!ids.has(base)) return base;
  let n = 2;
  while (ids.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export function nextOptionId(options: ChoiceOption[]): string {
  const used = new Set(options.map((o) => o.id));
  for (let i = 0; i < 26; i += 1) {
    const id = String.fromCharCode(97 + i);
    if (!used.has(id)) return id;
  }
  let n = options.length + 1;
  while (used.has(`opt-${n}`)) n += 1;
  return `opt-${n}`;
}

/* --------------------------- factories --------------------------- */

export function blankQuestion(type: QuestionType, id: string): Question {
  const base = { id, prompt: '', explanation: '', difficulty: 'easy' as Difficulty, tags: [] as string[] };
  switch (type) {
    case 'single_choice':
      return { ...base, type, options: [{ id: 'a', text: '' }, { id: 'b', text: '' }], correct: [] };
    case 'multiple_choice':
      return { ...base, type, options: [{ id: 'a', text: '' }, { id: 'b', text: '' }, { id: 'c', text: '' }], correct: [] };
    case 'true_false':
      return { ...base, type, options: defaultTrueFalseOptions(), correct: ['true'] };
    case 'typed':
      return { ...base, type, acceptedAnswers: [''], caseSensitive: false };
    default:
      return assertNever(type);
  }
}

export function blankTopic(subject: Subject, title = 'New topic'): Topic {
  const id = uniqueTopicId(subject, title);
  return { id, title, description: '', questions: [] };
}

export function starterDraft(): AuthorDraft {
  const subject: Subject = {
    id: 'my-subject',
    title: 'My Subject',
    description: 'What this subject is about.',
    topics: [
      {
        id: 'first-topic',
        title: 'First Topic',
        description: '',
        questions: [],
      },
    ],
  };
  subject.topics[0].questions.push({
    id: 'first-topic-001',
    type: 'single_choice',
    prompt: 'Which planet is known as the Red Planet?',
    options: [
      { id: 'a', text: 'Venus' },
      { id: 'b', text: 'Mars' },
      { id: 'c', text: 'Jupiter' },
    ],
    correct: ['b'],
    explanation: 'Iron oxide (rust) on its surface makes Mars look red.',
    difficulty: 'easy',
    tags: ['space'],
  });
  return { subject, meta: { ...DEFAULT_META } };
}

/** Changes a question's type while keeping as much of what the author already typed as possible. */
export function convertQuestion(q: Question, type: QuestionType): Question {
  if (q.type === type) return q;
  const common = {
    id: q.id,
    prompt: q.prompt,
    image: q.image,
    explanation: q.explanation,
    difficulty: q.difficulty,
    tags: q.tags,
  };
  const choiceOptions = isChoiceQuestion(q) && q.type !== 'true_false' ? q.options : null;
  const choiceCorrect = isChoiceQuestion(q) && q.type !== 'true_false' ? q.correct : [];

  switch (type) {
    case 'single_choice': {
      const options = choiceOptions ?? [
        { id: 'a', text: q.type === 'typed' ? (q.acceptedAnswers[0] ?? '') : '' },
        { id: 'b', text: '' },
      ];
      return { ...common, type, options, correct: choiceCorrect.slice(0, 1) };
    }
    case 'multiple_choice': {
      const options = choiceOptions ?? [
        { id: 'a', text: q.type === 'typed' ? (q.acceptedAnswers[0] ?? '') : '' },
        { id: 'b', text: '' },
        { id: 'c', text: '' },
      ];
      return { ...common, type, options, correct: choiceCorrect };
    }
    case 'true_false':
      return { ...common, type, options: defaultTrueFalseOptions(), correct: ['true'] };
    case 'typed': {
      let accepted: string[] = [''];
      if (isChoiceQuestion(q)) {
        const texts = q.options.filter((o) => q.correct.includes(o.id)).map((o) => o.text ?? '').filter(Boolean);
        if (texts.length) accepted = texts;
      }
      return { ...common, type, acceptedAnswers: accepted, caseSensitive: false };
    }
    default:
      return assertNever(type);
  }
}

/* ---------------------- lenient draft loading ---------------------- */
// Drafts may be half-finished (empty strings, no correct answer yet), so this
// coerces shapes instead of rejecting them. Strict checks happen on export.

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
const s = (v: unknown): string => (typeof v === 'string' ? v : '');

function coerceImage(v: unknown): QuizImage | undefined {
  if (!isRecord(v)) return undefined;
  const caption = s(v.caption);
  return { src: s(v.src), alt: s(v.alt), ...(caption ? { caption } : {}) };
}

function coerceOptions(v: unknown): ChoiceOption[] {
  if (!Array.isArray(v)) return [];
  return v.filter(isRecord).map((o, i) => {
    const image = coerceImage(o.image);
    return { id: s(o.id) || String.fromCharCode(97 + i), text: s(o.text), ...(image ? { image } : {}) };
  });
}

function coerceQuestion(v: unknown, fallbackId: string): Question | null {
  if (!isRecord(v)) return null;
  const type = (QUESTION_TYPES as readonly string[]).includes(s(v.type)) ? (s(v.type) as QuestionType) : 'single_choice';
  const image = coerceImage(v.image);
  const common = {
    id: s(v.id) || fallbackId,
    prompt: s(v.prompt),
    ...(image ? { image } : {}),
    explanation: s(v.explanation),
    difficulty: (DIFFICULTIES as readonly string[]).includes(s(v.difficulty)) ? (s(v.difficulty) as Difficulty) : undefined,
    tags: Array.isArray(v.tags) ? v.tags.filter((t): t is string => typeof t === 'string') : [],
  };
  const correct = Array.isArray(v.correct) ? v.correct.filter((x): x is string => typeof x === 'string') : [];
  switch (type) {
    case 'single_choice':
    case 'multiple_choice':
      return { ...common, type, options: coerceOptions(v.options), correct };
    case 'true_false': {
      const options = coerceOptions(v.options);
      return { ...common, type, options: options.length === 2 ? options : defaultTrueFalseOptions(), correct };
    }
    case 'typed': {
      const accepted = Array.isArray(v.acceptedAnswers)
        ? v.acceptedAnswers.filter((x): x is string => typeof x === 'string')
        : [];
      const input = isRecord(v.input) ? v.input : undefined;
      return {
        ...common,
        type,
        acceptedAnswers: accepted.length ? accepted : [''],
        caseSensitive: v.caseSensitive === true,
        ...(input && typeof input.placeholder === 'string' ? { input: { placeholder: input.placeholder } } : {}),
      };
    }
    default:
      return assertNever(type);
  }
}

export function coerceSubject(v: unknown): Subject | null {
  if (!isRecord(v) || !Array.isArray(v.topics)) return null;
  const topics: Topic[] = v.topics.filter(isRecord).map((t, ti) => ({
    id: s(t.id) || `topic-${ti + 1}`,
    title: s(t.title),
    description: s(t.description),
    questions: Array.isArray(t.questions)
      ? t.questions
          .map((q, qi) => coerceQuestion(q, `${s(t.id) || `topic-${ti + 1}`}-${String(qi + 1).padStart(3, '0')}`))
          .filter((q): q is Question => q !== null)
      : [],
  }));
  return { id: s(v.id), title: s(v.title), description: s(v.description), topics };
}

export function coerceDraft(v: unknown): AuthorDraft | null {
  if (!isRecord(v)) return null;
  const subject = coerceSubject(v.subject);
  if (!subject) return null;
  const meta = isRecord(v.meta) ? v.meta : {};
  return { subject, meta: { icon: s(meta.icon) || DEFAULT_META.icon, color: s(meta.color) || DEFAULT_META.color } };
}

/* ----------------------------- export ----------------------------- */

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
