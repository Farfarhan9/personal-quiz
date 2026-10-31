import {
  DIFFICULTIES,
  QUESTION_TYPES,
  type ChoiceOption,
  type Difficulty,
  type Question,
  type QuestionType,
  type QuizImage,
  type Subject,
  type SubjectIndex,
  type SubjectIndexEntry,
  type Topic,
  type TypedInputHints,
} from '../types';

export interface ValidationIssue {
  /** Human-readable location, e.g. `Topic 2 "Cells" › Question 3 (bio-003) › options`. */
  where: string;
  message: string;
  topicIndex?: number;
  questionIndex?: number;
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; issues: ValidationIssue[] };

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function nonEmpty(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export function defaultTrueFalseOptions(): ChoiceOption[] {
  return [
    { id: 'true', text: 'True' },
    { id: 'false', text: 'False' },
  ];
}

class Collector {
  issues: ValidationIssue[] = [];
  add(where: string, message: string, topicIndex?: number, questionIndex?: number): void {
    this.issues.push({ where, message, topicIndex, questionIndex });
  }
}

function parseImage(raw: unknown, where: string, c: Collector, ti?: number, qi?: number): QuizImage | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (!isRecord(raw)) {
    c.add(where, 'Image must be an object like { "src": "images/file.png", "alt": "description" }.', ti, qi);
    return undefined;
  }
  const src = str(raw.src)?.trim() ?? '';
  const alt = str(raw.alt)?.trim() ?? '';
  if (!src) c.add(where, 'Image is missing "src" (a path such as images/diagram.png).', ti, qi);
  if (!alt) c.add(where, 'Image is missing "alt" text. Describe what the image shows.', ti, qi);
  const caption = str(raw.caption)?.trim();
  return { src, alt, ...(caption ? { caption } : {}) };
}

function parseTags(raw: unknown, where: string, c: Collector, ti: number, qi: number): string[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw) || raw.some((t) => typeof t !== 'string')) {
    c.add(where, '"tags" must be a list of strings.', ti, qi);
    return undefined;
  }
  const tags = (raw as string[]).map((t) => t.trim()).filter(Boolean);
  return tags.length ? tags : undefined;
}

function parseOptions(
  raw: unknown,
  where: string,
  c: Collector,
  ti: number,
  qi: number,
): ChoiceOption[] {
  if (!Array.isArray(raw)) {
    c.add(where, '"options" must be a list.', ti, qi);
    return [];
  }
  const seen = new Set<string>();
  return raw.map((o, i): ChoiceOption => {
    const ow = `${where} › option ${i + 1}`;
    if (!isRecord(o)) {
      c.add(ow, 'Option must be an object with "id" and "text" and/or "image".', ti, qi);
      return { id: `invalid-${i}` };
    }
    const id = str(o.id)?.trim() ?? '';
    if (!id) c.add(ow, 'Option is missing an "id".', ti, qi);
    else if (seen.has(id)) c.add(ow, `Duplicate option id "${id}".`, ti, qi);
    seen.add(id);
    const text = str(o.text)?.trim();
    const image = parseImage(o.image, `${ow} › image`, c, ti, qi);
    if (!text && !image) c.add(ow, 'Option needs text, an image, or both.', ti, qi);
    return { id, ...(text ? { text } : {}), ...(image ? { image } : {}) };
  });
}

function parseInputHints(raw: unknown): TypedInputHints | undefined {
  if (!isRecord(raw)) return undefined;
  const hints: TypedInputHints = {};
  const modes = ['text', 'numeric', 'decimal', 'email', 'url', 'search', 'tel'] as const;
  const caps = ['off', 'none', 'on', 'sentences', 'words', 'characters'] as const;
  const inputMode = modes.find((m) => m === raw.inputMode);
  if (inputMode) hints.inputMode = inputMode;
  const autoCapitalize = caps.find((m) => m === raw.autoCapitalize);
  if (autoCapitalize) hints.autoCapitalize = autoCapitalize;
  if (typeof raw.autoCorrect === 'boolean') hints.autoCorrect = raw.autoCorrect;
  if (typeof raw.spellCheck === 'boolean') hints.spellCheck = raw.spellCheck;
  if (nonEmpty(raw.placeholder)) hints.placeholder = raw.placeholder.trim();
  return Object.keys(hints).length ? hints : undefined;
}

function isQuestionType(v: unknown): v is QuestionType {
  return typeof v === 'string' && (QUESTION_TYPES as readonly string[]).includes(v);
}

function isDifficulty(v: unknown): v is Difficulty {
  return typeof v === 'string' && (DIFFICULTIES as readonly string[]).includes(v);
}

function parseQuestion(
  raw: unknown,
  where: string,
  c: Collector,
  ti: number,
  qi: number,
): Question | undefined {
  if (!isRecord(raw)) {
    c.add(where, 'Question must be an object.', ti, qi);
    return undefined;
  }
  const id = str(raw.id)?.trim() ?? '';
  const prompt = str(raw.prompt)?.trim() ?? '';
  if (!id) c.add(where, 'Question is missing an "id".', ti, qi);
  if (!prompt) c.add(where, 'Question text ("prompt") is required.', ti, qi);

  const image = parseImage(raw.image, `${where} › image`, c, ti, qi);
  if (raw.code !== undefined && raw.code !== null && typeof raw.code !== 'string') {
    c.add(where, '"code" must be a string (use \\n for new lines).', ti, qi);
  }
  // Keep indentation inside the snippet; only strip blank lines at the start and trailing whitespace.
  const code = typeof raw.code === 'string' ? raw.code.replace(/^(\s*\n)+/, '').replace(/\s+$/, '') : '';
  const explanation = str(raw.explanation)?.trim();
  let difficulty: Difficulty | undefined;
  if (raw.difficulty !== undefined && raw.difficulty !== null && raw.difficulty !== '') {
    if (isDifficulty(raw.difficulty)) difficulty = raw.difficulty;
    else c.add(where, `"difficulty" must be one of: ${DIFFICULTIES.join(', ')}.`, ti, qi);
  }
  const tags = parseTags(raw.tags, where, c, ti, qi);
  const base = {
    id,
    prompt,
    ...(code ? { code } : {}),
    ...(image ? { image } : {}),
    ...(explanation ? { explanation } : {}),
    ...(difficulty ? { difficulty } : {}),
    ...(tags ? { tags } : {}),
  };

  if (!isQuestionType(raw.type)) {
    c.add(where, `Unknown question "type". Use one of: ${QUESTION_TYPES.join(', ')}.`, ti, qi);
    return undefined;
  }
  const type = raw.type;

  if (type === 'typed') {
    const accepted = Array.isArray(raw.acceptedAnswers)
      ? raw.acceptedAnswers.filter((a): a is string => typeof a === 'string').map((a) => a.trim()).filter(Boolean)
      : [];
    if (accepted.length === 0) c.add(where, 'Typed questions need at least one accepted answer.', ti, qi);
    const input = parseInputHints(raw.input);
    return {
      ...base,
      type,
      acceptedAnswers: accepted,
      ...(raw.caseSensitive === true ? { caseSensitive: true } : {}),
      ...(input ? { input } : {}),
    };
  }

  // Choice-based types
  let options: ChoiceOption[];
  if (type === 'true_false' && (raw.options === undefined || raw.options === null)) {
    options = defaultTrueFalseOptions();
  } else {
    options = parseOptions(raw.options, where, c, ti, qi);
  }
  const optionIds = new Set(options.map((o) => o.id));
  const correct = Array.isArray(raw.correct)
    ? raw.correct.filter((x): x is string => typeof x === 'string')
    : typeof raw.correct === 'string'
      ? [raw.correct]
      : [];

  if (type === 'true_false') {
    if (options.length !== 2) c.add(where, 'True/false questions must have exactly two options.', ti, qi);
  } else if (options.length < 2) {
    c.add(where, 'Add at least two options.', ti, qi);
  }
  if (correct.length === 0) c.add(where, 'Mark at least one option as correct.', ti, qi);
  if ((type === 'single_choice' || type === 'true_false') && correct.length > 1) {
    c.add(where, 'Only one option can be correct for this type. Use "multiple_choice" for several.', ti, qi);
  }
  const unknown = correct.filter((id) => !optionIds.has(id));
  if (unknown.length) c.add(where, `"correct" refers to option ids that do not exist: ${unknown.join(', ')}.`, ti, qi);

  return { ...base, type, options, correct: Array.from(new Set(correct)) };
}

/** Validates (and lightly normalises) a subject file. Used for fetched data, imports and author exports. */
export function validateSubject(raw: unknown): ValidationResult<Subject> {
  const c = new Collector();
  if (!isRecord(raw)) {
    return { ok: false, issues: [{ where: 'File', message: 'The file must contain a JSON object for one subject.' }] };
  }
  const id = str(raw.id)?.trim() ?? '';
  const title = str(raw.title)?.trim() ?? '';
  if (!id) c.add('Subject', 'Subject "id" is required.');
  else if (!ID_PATTERN.test(id)) c.add('Subject', 'Subject "id" may only contain letters, numbers, "-" and "_".');
  if (!title) c.add('Subject', 'Subject "title" is required.');
  const description = str(raw.description)?.trim();

  if (!Array.isArray(raw.topics)) {
    c.add('Subject', '"topics" must be a list.');
    return { ok: false, issues: c.issues };
  }
  if (raw.topics.length === 0) c.add('Subject', 'Add at least one topic.');

  const topicIds = new Set<string>();
  const questionIds = new Set<string>();
  const topics: Topic[] = [];

  raw.topics.forEach((t, ti) => {
    const tLabel = isRecord(t) && nonEmpty(t.title) ? `"${t.title.trim()}"` : '';
    const tw = `Topic ${ti + 1}${tLabel ? ` ${tLabel}` : ''}`;
    if (!isRecord(t)) {
      c.add(tw, 'Topic must be an object.', ti);
      return;
    }
    const tid = str(t.id)?.trim() ?? '';
    const ttitle = str(t.title)?.trim() ?? '';
    if (!tid) c.add(tw, 'Topic "id" is required.', ti);
    else if (!ID_PATTERN.test(tid)) c.add(tw, 'Topic "id" may only contain letters, numbers, "-" and "_".', ti);
    else if (topicIds.has(tid)) c.add(tw, `Duplicate topic id "${tid}".`, ti);
    topicIds.add(tid);
    if (!ttitle) c.add(tw, 'Topic "title" is required.', ti);
    const tdesc = str(t.description)?.trim();

    const questions: Question[] = [];
    if (!Array.isArray(t.questions)) {
      c.add(tw, '"questions" must be a list.', ti);
    } else {
      if (t.questions.length === 0) c.add(tw, 'Add at least one question.', ti);
      t.questions.forEach((q, qi) => {
        const qid = isRecord(q) && nonEmpty(q.id) ? ` (${q.id.trim()})` : '';
        const qw = `${tw} › Question ${qi + 1}${qid}`;
        const parsed = parseQuestion(q, qw, c, ti, qi);
        if (parsed) {
          if (parsed.id && questionIds.has(parsed.id)) {
            c.add(qw, `Duplicate question id "${parsed.id}". Question ids must be unique within a subject.`, ti, qi);
          }
          questionIds.add(parsed.id);
          questions.push(parsed);
        }
      });
    }
    topics.push({ id: tid, title: ttitle, ...(tdesc ? { description: tdesc } : {}), questions });
  });

  if (c.issues.length) return { ok: false, issues: c.issues };
  return { ok: true, value: { id, title, ...(description ? { description } : {}), topics } };
}

export function validateIndex(raw: unknown): ValidationResult<SubjectIndex> {
  if (!isRecord(raw) || !Array.isArray(raw.subjects)) {
    return { ok: false, issues: [{ where: 'index.json', message: 'Expected an object with a "subjects" list.' }] };
  }
  const c = new Collector();
  const subjects: SubjectIndexEntry[] = [];
  raw.subjects.forEach((s, i) => {
    const w = `index.json › subject ${i + 1}`;
    if (!isRecord(s) || !nonEmpty(s.id) || !nonEmpty(s.title) || !nonEmpty(s.file)) {
      c.add(w, 'Each subject needs "id", "title" and "file".');
      return;
    }
    subjects.push({
      id: s.id.trim(),
      title: s.title.trim(),
      file: s.file.trim(),
      ...(nonEmpty(s.description) ? { description: s.description.trim() } : {}),
      ...(nonEmpty(s.icon) ? { icon: s.icon.trim() } : {}),
      ...(nonEmpty(s.color) ? { color: s.color.trim() } : {}),
    });
  });
  if (c.issues.length) return { ok: false, issues: c.issues };
  return { ok: true, value: { subjects } };
}

export function formatIssues(issues: ValidationIssue[], max = 5): string {
  const lines = issues.slice(0, max).map((i) => `• ${i.where}: ${i.message}`);
  if (issues.length > max) lines.push(`…and ${issues.length - max} more`);
  return lines.join('\n');
}
