import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { SelectField, TextAreaField, TextField } from '../components/author/Fields';
import { QuestionEditor } from '../components/author/QuestionEditor';
import { TopBar } from '../components/TopBar';
import {
  blankQuestion,
  blankTopic,
  coerceDraft,
  copyText,
  downloadJson,
  starterDraft,
  uniqueQuestionId,
  type AuthorDraft,
} from '../lib/authoring';
import { loadIndex, loadSubjectFromEntry } from '../lib/data';
import { useDocumentTitle } from '../lib/hooks';
import { getAuthorDraft, saveAuthorDraft } from '../lib/storage';
import { slugify } from '../lib/utils';
import { validateSubject, type ValidationIssue } from '../lib/validate';
import { QUESTION_TYPES, QUESTION_TYPE_LABELS, type Question, type QuestionType, type SubjectIndexEntry, type Topic } from '../types';

type Notice = { tone: 'success' | 'error' | 'info'; text: string; details?: string[] } | null;

function loadInitialDraft(): { draft: AuthorDraft; savedAt: string | null } {
  const stored = getAuthorDraft();
  const draft = stored ? coerceDraft(stored.data) : null;
  return draft ? { draft, savedAt: stored?.savedAt ?? null } : { draft: starterDraft(), savedAt: null };
}

export default function AuthorPage() {
  useDocumentTitle('Author mode');
  const [initial] = useState(loadInitialDraft);
  const [draft, setDraft] = useState<AuthorDraft>(initial.draft);
  const [savedAt, setSavedAt] = useState<string | null>(initial.savedAt);
  const [topicIndex, setTopicIndex] = useState(0);
  const [openQuestion, setOpenQuestion] = useState<number | null>(null);
  const [newType, setNewType] = useState<QuestionType>('single_choice');
  const [notice, setNotice] = useState<Notice>(null);
  const [siteSubjects, setSiteSubjects] = useState<SubjectIndexEntry[]>([]);
  const [siteChoice, setSiteChoice] = useState('');
  const [showAllIssues, setShowAllIssues] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);

  const { subject, meta } = draft;
  const topic: Topic | undefined = subject.topics[Math.min(topicIndex, subject.topics.length - 1)];
  const safeTopicIndex = topic ? subject.topics.indexOf(topic) : -1;

  /* ---- autosave (debounced) ---- */
  useEffect(() => {
    const id = window.setTimeout(() => {
      const at = saveAuthorDraft(draft);
      if (at) setSavedAt(at);
    }, 400);
    return () => window.clearTimeout(id);
  }, [draft]);

  /* ---- list subjects already on the site (for "load existing") ---- */
  useEffect(() => {
    let active = true;
    loadIndex()
      .then((idx) => {
        if (active) setSiteSubjects(idx.subjects);
      })
      .catch(() => {
        /* the author page still works without the index */
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (notice) noticeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [notice]);

  const validation = useMemo(() => validateSubject(subject), [subject]);
  const issues: ValidationIssue[] = validation.ok ? [] : validation.issues;

  /* ---- draft mutation helpers ---- */
  const setSubject = (patch: Partial<typeof subject>) => setDraft((d) => ({ ...d, subject: { ...d.subject, ...patch } }));
  const setMeta = (patch: Partial<typeof meta>) => setDraft((d) => ({ ...d, meta: { ...d.meta, ...patch } }));
  const updateTopic = (ti: number, patch: Partial<Topic>) =>
    setDraft((d) => ({
      ...d,
      subject: { ...d.subject, topics: d.subject.topics.map((t, i) => (i === ti ? { ...t, ...patch } : t)) },
    }));
  const setQuestions = (ti: number, fn: (qs: Question[]) => Question[]) =>
    setDraft((d) => ({
      ...d,
      subject: {
        ...d.subject,
        topics: d.subject.topics.map((t, i) => (i === ti ? { ...t, questions: fn(t.questions) } : t)),
      },
    }));

  const replaceDraft = (next: AuthorDraft, message: string) => {
    setDraft(next);
    setTopicIndex(0);
    setOpenQuestion(null);
    setNotice({ tone: 'success', text: message });
  };

  /* ---- actions ---- */
  const newSubject = () => {
    if (!window.confirm('Start a new subject? Your current draft will be replaced (export it first if you want to keep it).')) return;
    const fresh = starterDraft();
    replaceDraft({ ...fresh, subject: { ...fresh.subject, id: 'new-subject', title: 'New Subject' } }, 'Started a new subject.');
  };

  const loadFromSite = async () => {
    const entry = siteSubjects.find((s) => s.id === siteChoice);
    if (!entry) return;
    if (!window.confirm(`Load “${entry.title}” into the editor? Your current draft will be replaced.`)) return;
    try {
      const s = await loadSubjectFromEntry(entry);
      replaceDraft(
        { subject: s, meta: { icon: entry.icon ?? '📘', color: entry.color ?? '#0f6e64' } },
        `Loaded “${entry.title}”. Edit it, then export and replace public/data/${entry.file}.`,
      );
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof Error ? err.message : 'Could not load that subject.' });
    }
  };

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      setNotice({ tone: 'error', text: `“${file.name}” is not valid JSON.` });
      return;
    }
    const result = validateSubject(raw);
    if (!result.ok) {
      setNotice({
        tone: 'error',
        text: `“${file.name}” doesn’t match the subject format, so it wasn’t loaded.`,
        details: result.issues.slice(0, 8).map((i) => `${i.where}: ${i.message}`),
      });
      return;
    }
    if (!window.confirm(`Import “${result.value.title}”? Your current draft will be replaced.`)) return;
    const known = siteSubjects.find((s) => s.id === result.value.id);
    replaceDraft(
      { subject: result.value, meta: { icon: known?.icon ?? meta.icon, color: known?.color ?? meta.color } },
      `Imported “${result.value.title}” (${result.value.topics.length} topics).`,
    );
  };

  const exportedValue = () => {
    const result = validateSubject(subject);
    if (!result.ok) {
      setShowAllIssues(true);
      setNotice({
        tone: 'error',
        text: `Fix ${result.issues.length} problem${result.issues.length === 1 ? '' : 's'} before exporting. They are listed under “Check & export”.`,
      });
      return null;
    }
    return result.value;
  };

  const onExport = () => {
    const value = exportedValue();
    if (!value) return;
    downloadJson(`${value.id}.json`, value);
    setNotice({
      tone: 'success',
      text: `Downloaded ${value.id}.json. Put it in public/data/subjects/ and commit it to make it permanent.`,
    });
  };

  const onCopyJson = async () => {
    const value = exportedValue();
    if (!value) return;
    const ok = await copyText(`${JSON.stringify(value, null, 2)}\n`);
    setNotice(ok ? { tone: 'success', text: 'Subject JSON copied to the clipboard.' } : { tone: 'error', text: 'Copy failed. Use Download instead.' });
  };

  const indexEntry = {
    id: subject.id,
    title: subject.title,
    description: subject.description ?? '',
    file: `subjects/${subject.id || 'my-subject'}.json`,
    icon: meta.icon,
    color: meta.color,
  };

  const onCopyIndexEntry = async () => {
    const ok = await copyText(JSON.stringify(indexEntry, null, 2));
    setNotice(ok ? { tone: 'success', text: 'index.json entry copied.' } : { tone: 'error', text: 'Copy failed — select the text and copy it manually.' });
  };

  /* ---- topic actions ---- */
  const addTopic = () => {
    const t = blankTopic(subject);
    setSubject({ topics: [...subject.topics, t] });
    setTopicIndex(subject.topics.length);
    setOpenQuestion(null);
  };

  const deleteTopic = () => {
    if (!topic) return;
    if (subject.topics.length <= 1) {
      setNotice({ tone: 'info', text: 'A subject needs at least one topic.' });
      return;
    }
    if (!window.confirm(`Delete topic “${topic.title || topic.id}” and its ${topic.questions.length} questions?`)) return;
    setSubject({ topics: subject.topics.filter((_, i) => i !== safeTopicIndex) });
    setTopicIndex(Math.max(0, safeTopicIndex - 1));
    setOpenQuestion(null);
  };

  const moveTopic = (delta: -1 | 1) => {
    const target = safeTopicIndex + delta;
    if (target < 0 || target >= subject.topics.length) return;
    const topics = subject.topics.slice();
    [topics[safeTopicIndex], topics[target]] = [topics[target], topics[safeTopicIndex]];
    setSubject({ topics });
    setTopicIndex(target);
  };

  /* ---- question actions ---- */
  const addQuestion = () => {
    if (!topic) return;
    const q = blankQuestion(newType, uniqueQuestionId(subject, topic.id));
    setQuestions(safeTopicIndex, (qs) => [...qs, q]);
    setOpenQuestion(topic.questions.length);
  };

  const issuesFor = (ti: number, qi: number) => issues.filter((i) => i.topicIndex === ti && i.questionIndex === qi);
  const topicLevelIssues = issues.filter((i) => i.topicIndex === safeTopicIndex && i.questionIndex === undefined);

  const goToIssue = (issue: ValidationIssue) => {
    if (issue.topicIndex !== undefined) setTopicIndex(issue.topicIndex);
    setOpenQuestion(issue.questionIndex ?? null);
    const target = issue.questionIndex !== undefined ? `q-row-${issue.questionIndex}` : issue.topicIndex !== undefined ? 'topic-card' : 'subject-card';
    window.setTimeout(() => document.getElementById(target)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 50);
  };

  return (
    <>
      <TopBar title="Author mode" backTo="/" backLabel="Home" />
      <main className="page page--author" id="main">
        <h1 className="page-title">Author mode</h1>

        <div className="notice notice--info" role="note">
          <p>
            <strong>This is a static site.</strong> Your work is saved as a draft in this browser only. To make it
            permanent, <strong>export the JSON</strong>, put it in <code>public/data/subjects/</code>, add an entry to{' '}
            <code>public/data/index.json</code>, and commit both to the repo.
          </p>
        </div>

        <div ref={noticeRef} aria-live="polite">
          {notice && (
            <div className={`notice notice--${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
              <p>{notice.text}</p>
              {notice.details && (
                <ul className="notice__details">
                  {notice.details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setNotice(null)}>
                Dismiss
              </button>
            </div>
          )}
        </div>

        {/* ---------------- Draft ---------------- */}
        <section className="panel" aria-labelledby="draft-h">
          <div className="panel__head">
            <h2 id="draft-h" className="panel__title">
              📝 Draft
            </h2>
            <span className="save-state" aria-live="polite">
              {savedAt ? `Saved ${new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not saved yet'}
            </span>
          </div>
          <div className="button-grid">
            <button type="button" className="btn btn--secondary" onClick={newSubject}>
              ＋ New subject
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => fileInput.current?.click()}>
              📂 Import JSON
            </button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            tabIndex={-1}
            aria-hidden="true"
            onChange={onImport}
          />
          {siteSubjects.length > 0 && (
            <div className="inline-form">
              <SelectField<string>
                id="site-subject"
                label="Edit a subject already on this site"
                value={siteChoice}
                options={[{ value: '', label: 'Choose a subject…' }, ...siteSubjects.map((s) => ({ value: s.id, label: s.title }))]}
                onChange={setSiteChoice}
              />
              <button type="button" className="btn btn--secondary" onClick={loadFromSite} disabled={!siteChoice}>
                Load
              </button>
            </div>
          )}
        </section>

        {/* ---------------- Subject ---------------- */}
        <section className="panel" id="subject-card" aria-labelledby="subject-h">
          <h2 id="subject-h" className="panel__title">
            📚 Subject
          </h2>
          <TextField
            id="s-title"
            label="Title"
            required
            value={subject.title}
            onChange={(title) => setSubject({ title })}
            placeholder="e.g. Biology"
          />
          <div className="field-row">
            <TextField
              id="s-id"
              label="Subject id"
              required
              monospace
              value={subject.id}
              onChange={(id) => setSubject({ id: id.trim() })}
              hint="Used in URLs and the file name."
            />
            <button
              type="button"
              className="btn btn--ghost btn--sm field-row__btn"
              onClick={() => setSubject({ id: slugify(subject.title) || subject.id })}
            >
              Use title
            </button>
          </div>
          <TextAreaField
            id="s-desc"
            label="Description"
            value={subject.description ?? ''}
            onChange={(description) => setSubject({ description })}
            rows={2}
          />
          <div className="field-row">
            <TextField id="s-icon" label="Icon (emoji)" value={meta.icon} onChange={(icon) => setMeta({ icon })} />
            <TextField id="s-color" label="Colour" type="color" value={meta.color} onChange={(color) => setMeta({ color })} />
          </div>
          <p className="field__hint">Icon and colour go in index.json (see “Check &amp; export”).</p>
        </section>

        {/* ---------------- Topic ---------------- */}
        <section className="panel" id="topic-card" aria-labelledby="topic-h">
          <h2 id="topic-h" className="panel__title">
            🗂️ Topics
          </h2>
          <div className="inline-form">
            <SelectField<string>
              id="topic-select"
              label="Editing topic"
              value={String(safeTopicIndex)}
              options={subject.topics.map((t, i) => ({
                value: String(i),
                label: `${i + 1}. ${t.title || t.id || 'Untitled'} (${t.questions.length})`,
              }))}
              onChange={(v) => {
                setTopicIndex(Number(v));
                setOpenQuestion(null);
              }}
            />
            <button type="button" className="btn btn--secondary" onClick={addTopic}>
              ＋ Topic
            </button>
          </div>

          {topic && (
            <>
              {topicLevelIssues.length > 0 && (
                <ul className="issue-list">
                  {topicLevelIssues.map((i, k) => (
                    <li key={k}>⚠️ {i.message}</li>
                  ))}
                </ul>
              )}
              <TextField
                id="t-title"
                label="Topic title"
                required
                value={topic.title}
                onChange={(title) => updateTopic(safeTopicIndex, { title })}
              />
              <div className="field-row">
                <TextField
                  id="t-id"
                  label="Topic id"
                  required
                  monospace
                  value={topic.id}
                  onChange={(id) => updateTopic(safeTopicIndex, { id: id.trim() })}
                />
                <button
                  type="button"
                  className="btn btn--ghost btn--sm field-row__btn"
                  onClick={() => updateTopic(safeTopicIndex, { id: slugify(topic.title) || topic.id })}
                >
                  Use title
                </button>
              </div>
              <TextAreaField
                id="t-desc"
                label="Topic description"
                value={topic.description ?? ''}
                onChange={(description) => updateTopic(safeTopicIndex, { description })}
                rows={2}
              />
              <div className="button-grid button-grid--3">
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => moveTopic(-1)} disabled={safeTopicIndex === 0}>
                  ↑ Move
                </button>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => moveTopic(1)}
                  disabled={safeTopicIndex === subject.topics.length - 1}
                >
                  ↓ Move
                </button>
                <button type="button" className="btn btn--danger btn--sm" onClick={deleteTopic}>
                  🗑 Delete
                </button>
              </div>
            </>
          )}
        </section>

        {/* ---------------- Questions ---------------- */}
        {topic && (
          <section className="panel" aria-labelledby="questions-h">
            <h2 id="questions-h" className="panel__title">
              ❓ Questions in “{topic.title || topic.id || 'Untitled'}”
            </h2>
            {topic.questions.length === 0 && <p className="empty-inline">No questions yet. Add the first one below.</p>}
            <ol className="q-list">
              {topic.questions.map((q, qi) => {
                const qIssues = issuesFor(safeTopicIndex, qi);
                const open = openQuestion === qi;
                return (
                  <li key={qi} id={`q-row-${qi}`} className={`q-row ${open ? 'is-open' : ''}`}>
                    <button
                      type="button"
                      className="q-row__toggle"
                      aria-expanded={open}
                      aria-controls={`q-panel-${qi}`}
                      onClick={() => setOpenQuestion(open ? null : qi)}
                    >
                      <span className="q-row__num">{qi + 1}</span>
                      <span className="q-row__body">
                        <span className="q-row__prompt">{q.prompt || 'Untitled question'}</span>
                        <span className="q-row__meta">
                          {QUESTION_TYPE_LABELS[q.type]}
                          {qIssues.length > 0 && (
                            <span className="q-row__warn">
                              {' '}
                              · ⚠️ {qIssues.length} issue{qIssues.length === 1 ? '' : 's'}
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="q-row__chev" aria-hidden="true">
                        {open ? '▴' : '▾'}
                      </span>
                    </button>
                    {open && (
                      <div id={`q-panel-${qi}`} className="q-row__panel">
                        <QuestionEditor
                          question={q}
                          index={qi}
                          total={topic.questions.length}
                          issues={qIssues}
                          onChange={(next) => setQuestions(safeTopicIndex, (qs) => qs.map((x, i) => (i === qi ? next : x)))}
                          onDelete={() => {
                            if (!window.confirm('Delete this question?')) return;
                            setQuestions(safeTopicIndex, (qs) => qs.filter((_, i) => i !== qi));
                            setOpenQuestion(null);
                          }}
                          onDuplicate={() => {
                            const copy = { ...q, id: uniqueQuestionId(subject, topic.id) };
                            setQuestions(safeTopicIndex, (qs) => [...qs.slice(0, qi + 1), copy, ...qs.slice(qi + 1)]);
                            setOpenQuestion(qi + 1);
                          }}
                          onMove={(delta) => {
                            const target = qi + delta;
                            if (target < 0 || target >= topic.questions.length) return;
                            setQuestions(safeTopicIndex, (qs) => {
                              const copy = qs.slice();
                              [copy[qi], copy[target]] = [copy[target], copy[qi]];
                              return copy;
                            });
                            setOpenQuestion(target);
                          }}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
            <div className="inline-form">
              <SelectField<QuestionType>
                id="new-q-type"
                label="New question type"
                value={newType}
                options={QUESTION_TYPES.map((t) => ({ value: t, label: QUESTION_TYPE_LABELS[t] }))}
                onChange={setNewType}
              />
              <button type="button" className="btn btn--primary" onClick={addQuestion}>
                ＋ Add question
              </button>
            </div>
          </section>
        )}

        {/* ---------------- Check & export ---------------- */}
        <section className="panel" aria-labelledby="export-h">
          <h2 id="export-h" className="panel__title">
            📦 Check &amp; export
          </h2>
          {issues.length === 0 ? (
            <p className="notice notice--success">✅ Everything looks valid. Ready to export.</p>
          ) : (
            <div className="notice notice--warning">
              <p>
                ⚠️ {issues.length} problem{issues.length === 1 ? '' : 's'} to fix before export.
              </p>
              <ul className="issue-links">
                {(showAllIssues ? issues : issues.slice(0, 5)).map((issue, i) => (
                  <li key={i}>
                    <button type="button" className="link-btn" onClick={() => goToIssue(issue)}>
                      {issue.where}
                    </button>
                    : {issue.message}
                  </li>
                ))}
              </ul>
              {issues.length > 5 && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowAllIssues((v) => !v)}>
                  {showAllIssues ? 'Show fewer' : `Show all ${issues.length}`}
                </button>
              )}
            </div>
          )}
          <div className="button-grid">
            <button type="button" className="btn btn--primary" onClick={onExport}>
              ⬇️ Download {subject.id || 'subject'}.json
            </button>
            <button type="button" className="btn btn--secondary" onClick={onCopyJson}>
              📋 Copy JSON
            </button>
          </div>

          <h3 className="panel__subtitle">index.json entry</h3>
          <p className="field__hint">
            Add this object to the <code>subjects</code> list in <code>public/data/index.json</code> (skip if the subject is already
            listed).
          </p>
          <pre className="code-block">
            <code>{JSON.stringify(indexEntry, null, 2)}</code>
          </pre>
          <button type="button" className="btn btn--secondary btn--block" onClick={onCopyIndexEntry}>
            📋 Copy index entry
          </button>
          <p className="field__hint">
            Then commit and push. See the README for the full steps. <Link to="/">Back to subjects</Link>
          </p>
        </section>
      </main>
    </>
  );
}
