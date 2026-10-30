import { useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ProgressBar } from '../components/ProgressBar';
import { EmptyView, ErrorView, LoadingView } from '../components/StatusViews';
import { TopBar } from '../components/TopBar';
import { loadIndex, loadSubjectFromEntry } from '../lib/data';
import { useAsync, useDocumentTitle } from '../lib/hooks';
import { getAllProgress, progressKey } from '../lib/storage';
import { formatRelative, pluralize } from '../lib/utils';
import type { ProgressStore, Subject, SubjectIndexEntry, TopicProgress } from '../types';

interface SubjectSummary {
  entry: SubjectIndexEntry;
  subject?: Subject;
  error?: string;
}

async function loadHome(): Promise<SubjectSummary[]> {
  const index = await loadIndex();
  const results = await Promise.allSettled(index.subjects.map((e) => loadSubjectFromEntry(e)));
  return index.subjects.map((entry, i) => {
    const r = results[i];
    return r.status === 'fulfilled'
      ? { entry, subject: r.value }
      : { entry, error: r.reason instanceof Error ? r.reason.message : 'Could not load' };
  });
}

interface SubjectStats {
  topics: number;
  questions: number;
  completed: number;
  bestAvg: number | null;
  last: (TopicProgress & { topicTitle: string }) | null;
}

function statsFor(subject: Subject, progress: ProgressStore): SubjectStats {
  let completed = 0;
  let bestSum = 0;
  let last: SubjectStats['last'] = null;
  for (const t of subject.topics) {
    const p = progress[progressKey(subject.id, t.id)];
    if (!p) continue;
    completed += 1;
    bestSum += p.bestPercent;
    if (!last || p.lastCompletedAt > last.lastCompletedAt) last = { ...p, topicTitle: t.title };
  }
  return {
    topics: subject.topics.length,
    questions: subject.topics.reduce((n, t) => n + t.questions.length, 0),
    completed,
    bestAvg: completed ? Math.round(bestSum / completed) : null,
    last,
  };
}

export default function HomePage() {
  useDocumentTitle('');
  const state = useAsync(loadHome, 'home');
  const [query, setQuery] = useState('');
  const progress = useMemo(() => getAllProgress(), []);

  const overall = useMemo(() => {
    const entries = Object.values(progress);
    const attempts = entries.reduce((n, p) => n + p.attempts, 0);
    const avg = entries.length ? Math.round(entries.reduce((n, p) => n + p.bestPercent, 0) / entries.length) : null;
    return { quizzesDone: entries.length, attempts, avg };
  }, [progress]);

  const filtered = useMemo(() => {
    if (state.status !== 'success') return [];
    const q = query.trim().toLowerCase();
    if (!q) return state.data;
    return state.data.filter(({ entry, subject }) => {
      const haystack = [entry.title, entry.description ?? '', subject?.description ?? '', ...(subject?.topics.map((t) => t.title) ?? [])]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [state, query]);

  return (
    <>
      <TopBar
        title="Quiz Folders"
        actions={
          <Link to="/author" className="icon-btn" aria-label="Author mode: write your own questions" title="Author mode">
            <span aria-hidden="true">✏️</span>
          </Link>
        }
      />
      <main className="page" id="main">
        <section className="hero">
          <h1 className="hero__title">What are we practising today?</h1>
          <p className="hero__text">Pick a subject, choose a topic, and answer one question at a time.</p>
          <dl className="stats">
            <div className="stat">
              <dt>Quizzes done</dt>
              <dd>{overall.quizzesDone}</dd>
            </div>
            <div className="stat">
              <dt>Avg best</dt>
              <dd>{overall.avg === null ? '—' : `${overall.avg}%`}</dd>
            </div>
            <div className="stat">
              <dt>Attempts</dt>
              <dd>{overall.attempts}</dd>
            </div>
          </dl>
        </section>

        <div className="search">
          <label htmlFor="subject-search" className="search__label">
            Search subjects
          </label>
          <div className="search__field">
            <span className="search__icon" aria-hidden="true">
              🔎
            </span>
            <input
              id="subject-search"
              type="search"
              className="input search__input"
              placeholder="Title, description or topic"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              enterKeyHint="search"
            />
          </div>
        </div>

        {state.status === 'loading' && <LoadingView label="Loading subjects" />}
        {state.status === 'error' && <ErrorView error={state.error} onRetry={state.reload} />}

        {state.status === 'success' && state.data.length === 0 && (
          <EmptyView emoji="📭" title="No subjects yet">
            <p className="state-view__text">
              Add a subject to <code>public/data/index.json</code>, or build one in Author mode.
            </p>
            <Link to="/author" className="btn btn--primary">
              Open Author mode
            </Link>
          </EmptyView>
        )}

        {state.status === 'success' && state.data.length > 0 && filtered.length === 0 && (
          <EmptyView emoji="🤔" title={`No subjects match “${query.trim()}”`}>
            <button type="button" className="btn btn--secondary" onClick={() => setQuery('')}>
              Clear search
            </button>
          </EmptyView>
        )}

        {filtered.length > 0 && (
          <ul className="card-grid" aria-label="Subjects">
            {filtered.map(({ entry, subject, error }) => {
              const stats = subject ? statsFor(subject, progress) : null;
              const style = { '--subject-color': entry.color ?? 'var(--accent)' } as CSSProperties;
              return (
                <li key={entry.id} className="subject-card" style={style}>
                  <div className="subject-card__top">
                    <span className="subject-card__icon" aria-hidden="true">
                      {entry.icon ?? '📁'}
                    </span>
                    <div className="subject-card__heading">
                      <h2 className="subject-card__title">
                        <Link to={`/subject/${encodeURIComponent(entry.id)}`} className="stretched-link">
                          {entry.title}
                        </Link>
                      </h2>
                      {stats && (
                        <p className="subject-card__count">
                          {pluralize(stats.topics, 'topic')} · {pluralize(stats.questions, 'question')}
                        </p>
                      )}
                    </div>
                    <span className="subject-card__chevron" aria-hidden="true">
                      ›
                    </span>
                  </div>
                  {(entry.description ?? subject?.description) && (
                    <p className="subject-card__desc">{entry.description ?? subject?.description}</p>
                  )}
                  {error && <p className="subject-card__error">⚠️ {error}</p>}
                  {stats && (
                    <div className="subject-card__progress">
                      <ProgressBar
                        value={stats.completed}
                        max={Math.max(stats.topics, 1)}
                        label={`${entry.title}: ${stats.completed} of ${stats.topics} topics completed`}
                        color={entry.color}
                        size="sm"
                      />
                      <p className="subject-card__progress-text">
                        <span>
                          {stats.completed}/{stats.topics} topics done
                        </span>
                        {stats.bestAvg !== null && <span className="badge badge--soft">Best avg {stats.bestAvg}%</span>}
                      </p>
                      {stats.last && (
                        <p className="subject-card__last">
                          Last: {stats.last.lastScore}/{stats.last.lastTotal} in {stats.last.topicTitle}
                          {formatRelative(stats.last.lastCompletedAt) && ` · ${formatRelative(stats.last.lastCompletedAt)}`}
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <Link to="/author" className="author-callout">
          <span className="author-callout__icon" aria-hidden="true">
            ✏️
          </span>
          <span>
            <strong>Write your own questions</strong>
            <span className="author-callout__text">Author mode lets you build a quiz and export it as JSON.</span>
          </span>
          <span className="subject-card__chevron" aria-hidden="true">
            ›
          </span>
        </Link>
      </main>
    </>
  );
}
