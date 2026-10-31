/* ------------------------------------------------------------------ */
/*  Content model                                                      */
/* ------------------------------------------------------------------ */

export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

/** An image shown in a question or an option. `src` is relative to /public (e.g. "images/cell.png"). */
export interface QuizImage {
  src: string;
  alt: string;
  caption?: string;
}

export interface ChoiceOption {
  id: string;
  text?: string;
  image?: QuizImage | null;
}

interface QuestionBase {
  id: string;
  prompt: string;
  /** Optional code snippet shown under the prompt in a monospace block (scrolls sideways if long). */
  code?: string;
  image?: QuizImage | null;
  explanation?: string;
  difficulty?: Difficulty;
  tags?: string[];
}

export interface SingleChoiceQuestion extends QuestionBase {
  type: 'single_choice';
  options: ChoiceOption[];
  /** Exactly one option id. */
  correct: string[];
}

export interface MultipleChoiceQuestion extends QuestionBase {
  type: 'multiple_choice';
  options: ChoiceOption[];
  /** One or more option ids. Graded by exact set match. */
  correct: string[];
}

export interface TrueFalseQuestion extends QuestionBase {
  type: 'true_false';
  /** Always two options with ids "true" and "false". Filled in automatically if omitted. */
  options: ChoiceOption[];
  correct: string[];
}

export type TypedAutoCapitalize = 'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters';
export type TypedInputMode = 'text' | 'numeric' | 'decimal' | 'email' | 'url' | 'search' | 'tel';

/** Optional per-question overrides for the on-screen keyboard. */
export interface TypedInputHints {
  inputMode?: TypedInputMode;
  autoCorrect?: boolean;
  autoCapitalize?: TypedAutoCapitalize;
  spellCheck?: boolean;
  placeholder?: string;
}

export interface TypedQuestion extends QuestionBase {
  type: 'typed';
  acceptedAnswers: string[];
  caseSensitive?: boolean;
  input?: TypedInputHints;
}

/**
 * Discriminated union on `type`. To add a new question type:
 *  1. add an interface here and include it in the union,
 *  2. handle it in lib/grading.ts, lib/validate.ts,
 *  3. render it in components/QuestionInput.tsx and the author editor.
 * TypeScript's exhaustiveness checks (`assertNever`) will point at every place you missed.
 */
export type Question = SingleChoiceQuestion | MultipleChoiceQuestion | TrueFalseQuestion | TypedQuestion;
export type QuestionType = Question['type'];
export type ChoiceQuestion = SingleChoiceQuestion | MultipleChoiceQuestion | TrueFalseQuestion;

export const QUESTION_TYPES: readonly QuestionType[] = ['single_choice', 'multiple_choice', 'true_false', 'typed'];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: 'Single choice',
  multiple_choice: 'Multiple choice',
  true_false: 'True / false',
  typed: 'Typed answer',
};

export interface Topic {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
}

export interface Subject {
  id: string;
  title: string;
  description?: string;
  topics: Topic[];
}

export interface SubjectIndexEntry {
  id: string;
  title: string;
  description?: string;
  /** Path relative to /public/data, e.g. "subjects/biology.json". */
  file: string;
  icon?: string;
  color?: string;
}

export interface SubjectIndex {
  subjects: SubjectIndexEntry[];
}

/* ------------------------------------------------------------------ */
/*  Runtime state                                                      */
/* ------------------------------------------------------------------ */

export type UserAnswer = { kind: 'choice'; selected: string[] } | { kind: 'text'; value: string };

export type QuestionStatus = 'correct' | 'incorrect' | 'skipped';

export interface TopicProgress {
  attempts: number;
  bestScore: number;
  bestTotal: number;
  bestPercent: number;
  lastScore: number;
  lastTotal: number;
  lastPercent: number;
  /** ISO timestamp. */
  lastCompletedAt: string;
  lastDurationSec?: number;
}

export type ProgressStore = Record<string, TopicProgress>;

export type ThemeName = 'light' | 'dark';

export interface Settings {
  theme: ThemeName;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
}
