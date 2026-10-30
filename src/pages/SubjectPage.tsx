import { useMemo, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ProgressBar } from '../components/ProgressBar';
import { ErrorView, LoadingView } from '../components/StatusViews';
import { Toggle } from '../components/Toggle';
import { TopBar } from '../components/TopBar';
import { loadSubject, NotFoundError } from '../lib/data';
import { useAsync, useDocumentTitle } from '../lib/hooks';
import { getAllProgress, getSettings, progressKey, updateSettings } from '../lib/storage';
import { quizPath } from '../lib/routes';
import { formatRelative, pluralize } from '../lib/utils';
import NotFoundPage from './NotFoundPage';

export default function SubjectPage() {
  const { subjectId = '' } = useParams();
  const state = useAsync(() => loadSubject(subjectId), subjectId);
  const progress = useMemo(() => getAllProgress(), []);
  const [settings, setSettings] = useState(getSettings);
  useDocumentTitle(state.status === 'success' ? state.data.subject.title : 'Subject');

  if (state.status === 'error' && state.error instanceof NotFoundError) return <NotFoundPage />;

  const setShuffle = (patch: { shuffleQuestions?: boolean; shuffleOptions?: boolean }) => {
    setSettings(updateSettings(patch));
  };

  return (
    <>
      <TopBar
        title={state.status === 'success' ? state.data.subject.title : 'Subject'}
        backTo="/"
        backLabel="Subjects"
      />
      <main className="page" id="main">
        {state.status === 'loading' && <LoadingView label="Loading subject" />}
        {state.status === 'error' && <ErrorView error={state.error} onRetry={state.reload} />}
        {state.status === 'success' &&
          (() => {
            const { subject, entry } = state.data;
            const topicProgress = subject.topics.map((t) => progress[progressKey(subject.id, t.id)]);
            const completed = topicProgress.filter(Boolean).length;
            const style = { '--subject-color': entry.color ?? 'var(--accent)' } as CSSProperties;
            return (
              <>
                <nav className="breadcrumb" aria-label="Breadcrumb">
                  <ol>
                    <li>
                      <Link to="/">Subjects</Link>
                    </li>
                    <li aria-current="page">{subject.title}</li>
                  </ol>
                </nav>

                <section className="subject-hero" style={style}>
                  <span className="subject-hero__icon" aria-hidden="true">
                    {entry.icon ?? '📁'}
                  </span>
                  <div className="subject-hero__body">
                    <h1 className="subject-hero__title">{subject.title}</h1>
                    {subject.description && <p className="subject-hero__desc">{subject.description}</p>}
                    <ProgressBar
                      value={completed}
                      max={Math.max(subject.topics.length, 1)}
                      label={`${completed} of ${subject.topics.length} topics completed`}
                      color={entry.color}
                      size="sm"
                    />
                    <p className="subject-hero__meta">
                      {completed}/{subject.topics.length} topics completed
                    </p>
                  </div>
                </section>

                <details className="options-panel">
                  <summary className="options-panel__summary">
                    <span aria-hidden="true">⚙️</span> Quiz options
                    <span className="options-panel__state">
                      {[settings.shuffleQuestions && 'questions shuffled', settings.shuffleOptions && 'answers shuffled']
                        .filter(Boolean)
                        .join(', ') || 'in order'}
                    </span>
                  </summary>
                  <div className="options-panel__body">
                    <Toggle
                      id="opt-shuffle-q"
                      label="Shuffle questions"
                      description="Ask the questions in a random order."
                      checked={settings.shuffleQuestions}
                      onChange={(v) => setShuffle({ shuffleQuestions: v })}
                    />
                    <Toggle
                      id="opt-shuffle-o"
                      label="Shuffle answer options"
                      description="Mix up the order of the choices (true/false stays in order)."
                      checked={settings.shuffleOptions}
                      onChange={(v) => setShuffle({ shuffleOptions: v })}
                    />
                  </div>
                </details>

                <h2 className="section-title">Topics</h2>
                <ul className="topic-list">
                  {subject.topics.map((topic, i) => {
                    const p = topicProgress[i];
                    const href = quizPath(subject.id, topic.id, settings.shuffleQuestions, settings.shuffleOptions);
                    return (
                      <li key={topic.id} className={`topic-card ${p ? 'is-done' : ''}`} style={style}>
                        <div className="topic-card__head">
                          <h3 className="topic-card__title">{topic.title}</h3>
                          {p ? (
                            <span className="badge badge--success">✓ Completed</span>
                          ) : (
                            <span className="badge">New</span>
                          )}
                        </div>
                        {topic.description && <p className="topic-card__desc">{topic.description}</p>}
                        <p className="topic-card__count">{pluralize(topic.questions.length, 'question')}</p>
                        {p && (
                          <>
                            <ProgressBar
                              value={p.bestPercent}
                              label={`${topic.title}: best score ${p.bestPercent}%`}
                              color={entry.color}
                              size="sm"
                            />
                            <dl className="topic-card__scores">
                              <div>
                                <dt>Best</dt>
                                <dd>
                                  {p.bestScore}/{p.bestTotal} <span className="muted">({p.bestPercent}%)</span>
                                </dd>
                              </div>
                              <div>
                                <dt>Last</dt>
                                <dd>
                                  {p.lastScore}/{p.lastTotal} <span className="muted">({p.lastPercent}%)</span>
                                </dd>
                              </div>
                              <div>
                                <dt>Attempts</dt>
                                <dd>{p.attempts}</dd>
                              </div>
                            </dl>
                            {formatRelative(p.lastCompletedAt) && (
                              <p className="topic-card__when">Last completed {formatRelative(p.lastCompletedAt)}</p>
                            )}
                          </>
                        )}
                        <Link
                          to={href}
                          className={`btn ${p ? 'btn--secondary' : 'btn--primary'} btn--block`}
                          aria-label={`${p ? 'Retry' : 'Start'} quiz: ${topic.title}`}
                        >
                          {p ? '↻ Retry quiz' : '▶ Start quiz'}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </>
            );
          })()}
      </main>
    </>
  );
}
