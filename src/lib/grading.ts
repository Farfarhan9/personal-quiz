import type { ChoiceOption, ChoiceQuestion, Question, TypedQuestion, UserAnswer } from '../types';

export function assertNever(x: never): never {
  throw new Error(`Unhandled question type: ${JSON.stringify(x)}`);
}

export function isChoiceQuestion(q: Question): q is ChoiceQuestion {
  return q.type === 'single_choice' || q.type === 'multiple_choice' || q.type === 'true_false';
}

/** Trim, collapse inner whitespace, and lower-case unless the question is case-sensitive. */
export function normalizeTypedAnswer(value: string, caseSensitive = false): string {
  const cleaned = value.trim().replace(/\s+/g, ' ');
  return caseSensitive ? cleaned : cleaned.toLocaleLowerCase();
}

export function emptyAnswer(q: Question): UserAnswer {
  switch (q.type) {
    case 'single_choice':
    case 'multiple_choice':
    case 'true_false':
      return { kind: 'choice', selected: [] };
    case 'typed':
      return { kind: 'text', value: '' };
    default:
      return assertNever(q);
  }
}

export function isAnswered(q: Question, a: UserAnswer | undefined): boolean {
  if (!a) return false;
  switch (q.type) {
    case 'single_choice':
    case 'multiple_choice':
    case 'true_false':
      return a.kind === 'choice' && a.selected.length > 0;
    case 'typed':
      return a.kind === 'text' && a.value.trim().length > 0;
    default:
      return assertNever(q);
  }
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size !== sb.size) return false;
  for (const x of sa) if (!sb.has(x)) return false;
  return true;
}

function gradeTyped(q: TypedQuestion, value: string): boolean {
  const given = normalizeTypedAnswer(value, q.caseSensitive);
  if (!given) return false;
  return q.acceptedAnswers.some((acc) => normalizeTypedAnswer(acc, q.caseSensitive) === given);
}

/** Returns true when the answer is fully correct. */
export function gradeAnswer(q: Question, a: UserAnswer | undefined): boolean {
  if (!a) return false;
  switch (q.type) {
    case 'single_choice':
    case 'true_false':
      return a.kind === 'choice' && a.selected.length === 1 && q.correct.includes(a.selected[0]);
    case 'multiple_choice':
      return a.kind === 'choice' && sameSet(a.selected, q.correct);
    case 'typed':
      return a.kind === 'text' && gradeTyped(q, a.value);
    default:
      return assertNever(q);
  }
}

export function optionLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

export function optionLabel(option: ChoiceOption, index: number): string {
  if (option.text) return option.text;
  if (option.image?.alt) return `${optionLetter(index)} (image: ${option.image.alt})`;
  return `Option ${optionLetter(index)}`;
}

function describeOptions(q: ChoiceQuestion, ids: readonly string[]): string {
  const parts = q.options
    .map((o, i) => ({ o, i }))
    .filter(({ o }) => ids.includes(o.id))
    .map(({ o, i }) => optionLabel(o, i));
  return parts.join('; ');
}

export function correctAnswerText(q: Question): string {
  switch (q.type) {
    case 'single_choice':
    case 'multiple_choice':
    case 'true_false':
      return describeOptions(q, q.correct);
    case 'typed':
      return q.acceptedAnswers.length > 1
        ? `${q.acceptedAnswers[0]} (also accepted: ${q.acceptedAnswers.slice(1).join(', ')})`
        : (q.acceptedAnswers[0] ?? '');
    default:
      return assertNever(q);
  }
}

export function userAnswerText(q: Question, a: UserAnswer | undefined): string {
  if (!a || !isAnswered(q, a)) return '—';
  switch (q.type) {
    case 'single_choice':
    case 'multiple_choice':
    case 'true_false':
      return a.kind === 'choice' ? describeOptions(q, a.selected) : '—';
    case 'typed':
      return a.kind === 'text' ? a.value.trim() : '—';
    default:
      return assertNever(q);
  }
}
