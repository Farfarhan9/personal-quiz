import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FeedbackPanel } from '../components/FeedbackPanel';
import { ProgressBar } from '../components/ProgressBar';
import { QuestionCard } from '../components/QuestionCard';
import { ReviewList, type ReviewItem } from '../components/ReviewList';
import { ErrorView, LoadingView } from '../components/StatusViews';
import { QuizTimer } from '../components/QuizTimer';
import { TopBar } from '../components/TopBar';
import { loadSubject, NotFoundError, type LoadedSubject } from '../lib/data';
import { gradeAnswer, isAnswered } from '../lib/grading';
import { useAsync, useDocumentTitle } from '../lib/hooks';
import { subjectPath } from '../lib/routes';
import { getTopicProgress, recordResult } from '../lib/storage';
import { formatDuration, percentOf, scrollBehavior, shuffle } from '../lib/utils';
import type { Question, QuestionStatus, Topic, TopicProgress, UserAnswer } from '../types';
import NotFoundPage from './NotFoundPage';

/* ------------------------------------------------------------------ */
/*  Session + reducer                                                  */
/* ------------------------------------------------------------------ */

function buildQuestions(topic: Topic, shuffleQuestions: boolean, shuffleOptions: boolean): Question[] {
  const ordered = shuffleQuestions ? shuffle(topic.questions) : topic.questions.slice();
  if (!shuffleOptions) return ordered;
  return ordered.map((q) => {
    if (q.type === 'single_choice' || q.type === 'multiple_choice') return { ...q, options: shuffle(q.options) };
    return q; // true/false keeps its natural order; typed has no options
  });
}

interface QuizState {
  index: number;
  answers: Record<string, UserAnswer>;
  statuses: Record<string, QuestionStatus>;
  phase: 'quiz' | 'summary';
  startedAt: number;
  endedAt: number | null;
  /** Increments every time an answer is checked, so effects can react (e.g. scroll to feedback). */
  checkCount: number;
}

type Action =
  | { type: 'answer'; id: string; answer: UserAnswer }
  | { type: 'check'; question: Question }
  | { type: 'skip'; id: string; isLast: boolean }
  | { type: 'goto'; index: number }
  | { type: 'finish' }
  | { type: 'reset' };

function initialState(): QuizState {
  return { index: 0, answers: {}, statuses: {}, phase: 'quiz', startedAt: Date.now(), endedAt: null, checkCount: 0 };
}

function reducer(state: QuizState, action: Action): QuizState {
  switch (action.type) {
    case 'answer': {
      const status = state.statuses[action.id];
      if (status === 'correct' || status === 'incorrect') return state; // locked
      return { ...state, answers: { ...state.answers, [action.id]: action.answer } };
    }
    case 'check': {
      const q = action.question;
      const answer = state.answers[q.id];
      if (!isAnswered(q, answer)) return state;
      const status: QuestionStatus = gradeAnswer(q, answer) ? 'correct' : 'incorrect';
      return { ...state, statuses: { ...state.statuses, [q.id]: status }, checkCount: state.checkCount + 1 };
    }
    case 'skip': {
      const statuses = { ...state.statuses, [action.id]: 'skipped' as const };
      if (action.isLast) return { ...state, statuses, phase: 'summary', endedAt: Date.now() };
      return { ...state, statuses, index: state.index + 1 };
    }
    case 'goto':
      return { ...state, index: action.index };
    case 'finish':
      return { ...state, phase: 'summary', endedAt: Date.now() };
    case 'reset':
      return initialState();
    default:
      return state;
  }
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function QuizPage() {
  const { subjectId = '', topicId = '' } = useParams();
  const data = useAsync(() => loadSubject(subjectId), subjectId);

  if (data.status === 'error' && data.error instanceof NotFoundError) return <NotFoundPage />;
  if (data.status === 'loading' || data.status === 'error') {
    return (
      <>
        <TopBar title="Quiz" backTo={subjectPath(subjectId)} backLabel="Subject" />
        <main className="page" id="main">
          {data.status === 'loading' ? <LoadingView label="Loading quiz" /> : <ErrorView error={data.error} onRetry={data.reload} />}
        </main>
      </>
    );
  }

  const topic = data.data.subject.topics.find((t) => t.id === topicId);
  if (!topic) return <NotFoundPage />;
  // Re-mount the runner whenever the topic changes so state never leaks between quizzes.
  return <QuizRunner key={`${subjectId}/${topicId}`} loaded={data.data} topic={topic} />;
}

interface QuizRunnerProps {
  loaded: LoadedSubject;
  topic: Topic;
}

function QuizRunner({ loaded, topic }: QuizRunnerProps) {
  const { subject, entry } = loaded;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const shuffleQuestions = searchParams.get('sq') === '1';
  const shuffleOptions = searchParams.get('so') === '1';
  useDocumentTitle(topic.title);

  const [attempt, setAttempt] = useState(0);
  const questions = useMemo(
    () => buildQuestions(topic, shuffleQuestions, shuffleOptions),
    // `attempt` is a dependency on purpose: every retry re-shuffles.
    [topic, shuffleQuestions, shuffleOptions, attempt],
  );
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [previousBest] = useState<TopicProgress | undefined>(() => getTopicProgress(subject.id, topic.id));
  const [result, setResult] = useState<TopicProgress | null>(null);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'missed'>('all');

  const headingRef = useRef<HTMLHeadingElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLHeadingElement>(null);
  const recordedAttempt = useRef<number | null>(null);
  const firstRender = useRef(true);

  const total = questions.length;
  const current = questions[state.index] as Question | undefined;
  const currentStatus = current ? state.statuses[current.id] : undefined;
  const isChecked = currentStatus === 'correct' || currentStatus === 'incorrect';
  const isLast = state.index === total - 1;
  const answeredCount = questions.filter((q) => state.statuses[q.id] === 'correct' || state.statuses[q.id] === 'incorrect').length;
  const score = questions.filter((q) => state.statuses[q.id] === 'correct').length;

  /* ---- side effects ---- */

  // New question: scroll to the top and move focus to the prompt (no extra jump).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (state.phase !== 'quiz') return;
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
    headingRef.current?.focus({ preventScroll: true });
  }, [state.index, state.phase, attempt]);

  // After checking: make sure the feedback is visible above the sticky bottom bar.
  useEffect(() => {
    if (state.checkCount === 0) return;
    const el = feedbackRef.current;
    if (!el) return;
    window.requestAnimationFrame(() => el.scrollIntoView({ block: 'nearest', behavior: scrollBehavior() }));
  }, [state.checkCount]);

  // Finished: save progress exactly once per attempt and jump to the summary.
  useEffect(() => {
    if (state.phase !== 'summary' || recordedAttempt.current === attempt) return;
    recordedAttempt.current = attempt;
    const duration = Math.round(((state.endedAt ?? Date.now()) - state.startedAt) / 1000);
    setResult(recordResult(subject.id, topic.id, score, total, duration));
    window.scrollTo({ top: 0, behavior: 'auto' });
    summaryRef.current?.focus({ preventScroll: true });
  }, [state.phase, state.endedAt, state.startedAt, attempt, subject.id, topic.id, score, total]);

  /* ---- actions ---- */

  const check = useCallback(() => {
    if (current) dispatch({ type: 'check', question: current });
  }, [current]);

  const next = () => {
    if (isLast) dispatch({ type: 'finish' });
    else dispatch({ type: 'goto', index: state.index + 1 });
  };

  const prev = () => {
    if (state.index > 0) dispatch({ type: 'goto', index: state.index - 1 });
  };

  const skip = () => {
    if (current) dispatch({ type: 'skip', id: current.id, isLast });
  };

  const retry = () => {
    setResult(null);
    setReviewFilter('all');
    setAttempt((a) => a + 1);
    dispatch({ type: 'reset' });
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const leave = () => {
    const inProgress = state.phase === 'quiz' && Object.keys(state.statuses).length > 0;
    if (!inProgress || window.confirm('Leave this quiz? Your answers in this attempt will be lost.')) {
      navigate(subjectPath(subject.id));
    }
  };

  const style = { '--subject-color': entry.color ?? 'var(--accent)' } as CSSProperties;

  /* ---- empty topic ---- */
  if (total === 0 || (!current && state.phase === 'quiz')) {
    return (
      <>
        <TopBar title={topic.title} backTo={subjectPath(subject.id)} backLabel="Subject" />
        <main className="page" id="main">
          <div className="state-view">
            <p className="state-view__emoji" aria-hidden="true">
              🫙
            </p>
            <h1 className="state-view__title">This topic has no questions yet</h1>
            <Link to={subjectPath(subject.id)} className="btn btn--primary">
              Back to {subject.title}
            </Link>
          </div>
        </main>
      </>
    );
  }

  /* ---- summary ---- */
  if (state.phase === 'summary') {
    const pct = percentOf(score, total);
    const skippedCount = questions.filter((q) => state.statuses[q.id] === 'skipped' || !state.statuses[q.id]).length;
    const duration = Math.round(((state.endedAt ?? Date.now()) - state.startedAt) / 1000);
    const items: ReviewItem[] = questions.map((q) => ({
      question: q,
      answer: state.answers[q.id],
      status: state.statuses[q.id] ?? 'skipped',
    }));
    const shown = reviewFilter === 'all' ? items : items.filter((i) => i.status !== 'correct');
    const isNewBest = result !== null && (!previousBest || pct > previousBest.bestPercent);
    const message =
      pct === 100 ? 'Perfect score! 🌟' : pct >= 80 ? 'Great work! 🎉' : pct >= 50 ? 'Good effort — keep going 💪' : 'Keep practising — you’ll get there 🌱';

    return (
      <>
        <TopBar title={topic.title} backTo={subjectPath(subject.id)} backLabel="Subject" />
        <main className="page page--with-bar" id="main" style={style}>
          <section className="summary" aria-labelledby="summary-title">
            <h1 id="summary-title" className="summary__title" ref={summaryRef} tabIndex={-1}>
              {message}
            </h1>
            <div
              className="score-ring"
              style={{ '--pct': `${pct}%` } as CSSProperties}
              role="img"
              aria-label={`Score ${pct} percent`}
            >
              <span className="score-ring__value">{pct}%</span>
            </div>
            <dl className="stats stats--summary">
              <div className="stat">
                <dt>Correct</dt>
                <dd>
                  {score}/{total}
                </dd>
              </div>
              <div className="stat">
                <dt>Skipped</dt>
                <dd>{skippedCount}</dd>
              </div>
              <div className="stat">
                <dt>Time</dt>
                <dd>{formatDuration(duration)}</dd>
              </div>
            </dl>
            {isNewBest && previousBest && <p className="summary__best">🏆 New best! Previous best was {previousBest.bestPercent}%.</p>}
            {!isNewBest && previousBest && (
              <p className="summary__best muted">Your best on this topic: {Math.max(previousBest.bestPercent, pct)}%</p>
            )}
            <div className="button-row summary__actions">
              <button type="button" className="btn btn--primary" onClick={retry}>
                ↻ Retry quiz
              </button>
              <Link to={subjectPath(subject.id)} className="btn btn--secondary">
                Back to subject
              </Link>
              <Link to="/" className="btn btn--ghost">
                Home
              </Link>
            </div>
          </section>

          <section className="review" aria-labelledby="review-title">
            <div className="review__head">
              <h2 id="review-title" className="section-title">
                Review answers
              </h2>
              <div className="segmented" role="group" aria-label="Filter review">
                <button
                  type="button"
                  className="segmented__btn"
                  aria-pressed={reviewFilter === 'all'}
                  onClick={() => setReviewFilter('all')}
                >
                  All ({items.length})
                </button>
                <button
                  type="button"
                  className="segmented__btn"
                  aria-pressed={reviewFilter === 'missed'}
                  onClick={() => setReviewFilter('missed')}
                >
                  To review ({items.filter((i) => i.status !== 'correct').length})
                </button>
              </div>
            </div>
            <ReviewList items={shown} />
          </section>
        </main>
        <nav className="action-bar" aria-label="Quiz finished actions">
          <div className="action-bar__inner">
            <Link to="/" className="icon-btn icon-btn--bordered" aria-label="Home">
              <span aria-hidden="true">🏠</span>
            </Link>
            <Link to={subjectPath(subject.id)} className="btn btn--secondary">
              Subject
            </Link>
            <button type="button" className="btn btn--primary action-bar__primary" onClick={retry}>
              ↻ Retry
            </button>
          </div>
        </nav>
      </>
    );
  }

  /* ---- question flow ---- */
  const q = current as Question;
  const pctThrough = Math.round(((state.index + (isChecked ? 1 : 0)) / total) * 100);
  const answered = isAnswered(q, state.answers[q.id]);

  return (
    <>
      <TopBar title={topic.title} onBack={leave} backLabel="Subject" />
      <main className="page page--with-bar" id="main" style={style}>
        <div className="quiz-progress">
          <div className="quiz-progress__row">
            <p className="quiz-progress__count" aria-live="polite">
              <span className="quiz-progress__current">{state.index + 1}</span>
              <span className="quiz-progress__sep"> / </span>
              <span>{total}</span>
              <span className="visually-hidden"> questions</span>
            </p>
            <p className="quiz-progress__meta">
              <span>{pctThrough}%</span>
              <span aria-hidden="true">·</span>
              <span>
                {score} correct of {answeredCount}
              </span>
              <span aria-hidden="true">·</span>
              <QuizTimer startedAt={state.startedAt} running={state.phase === 'quiz'} />
            </p>
          </div>
          <ProgressBar value={pctThrough} label={`Quiz progress ${pctThrough}%`} color={entry.color} />
          {(shuffleQuestions || shuffleOptions) && (
            <p className="quiz-progress__flags">
              🔀 {[shuffleQuestions && 'Questions', shuffleOptions && 'Answers'].filter(Boolean).join(' & ')} shuffled
            </p>
          )}
        </div>

        <div key={`${attempt}-${q.id}`} className="question-enter">
          <QuestionCard
            ref={headingRef}
            question={q}
            answer={state.answers[q.id]}
            onChange={(answer) => dispatch({ type: 'answer', id: q.id, answer })}
            locked={isChecked}
            reveal={isChecked}
            onSubmit={check}
            idPrefix={`quiz-${attempt}`}
            eyebrow={`Question ${state.index + 1} of ${total}`}
          />
          {isChecked && currentStatus && <FeedbackPanel ref={feedbackRef} question={q} status={currentStatus} />}
          {currentStatus === 'skipped' && (
            <p className="notice notice--info skipped-note">⏭️ You skipped this one earlier — you can still answer it now.</p>
          )}
        </div>
      </main>

      <nav className="action-bar" aria-label="Quiz controls">
        <div className="action-bar__inner">
          <button
            type="button"
            className="icon-btn icon-btn--bordered"
            onClick={prev}
            disabled={state.index === 0}
            aria-label="Previous question"
          >
            <span aria-hidden="true">←</span>
          </button>
          {isChecked ? (
            <button type="button" className="btn btn--primary action-bar__primary" onClick={next}>
              {isLast ? 'Finish ✓' : 'Next →'}
            </button>
          ) : (
            <>
              <button type="button" className="btn btn--secondary" onClick={skip}>
                {isLast ? 'Skip & finish' : 'Skip'}
              </button>
              <button
                type="button"
                className="btn btn--primary action-bar__primary"
                onClick={check}
                disabled={!answered}
                aria-disabled={!answered}
              >
                Check answer
              </button>
            </>
          )}
        </div>
      </nav>
    </>
  );
}
