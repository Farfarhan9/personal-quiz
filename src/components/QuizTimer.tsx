import { useEffect, useState } from 'react';
import { formatDuration } from '../lib/utils';

/** A calm elapsed-time display. Lives in its own component so the quiz doesn't re-render every second. */
export function QuizTimer({ startedAt, running }: { startedAt: number; running: boolean }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return undefined;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running, startedAt]);

  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  return (
    <span className="quiz-timer" role="timer" aria-label="Time elapsed">
      <span aria-hidden="true">⏱ </span>
      {formatDuration(seconds)}
    </span>
  );
}
