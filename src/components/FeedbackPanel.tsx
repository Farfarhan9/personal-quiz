import { forwardRef } from 'react';
import { correctAnswerText } from '../lib/grading';
import { RichText } from './RichText';
import type { Question, QuestionStatus } from '../types';

interface FeedbackPanelProps {
  question: Question;
  status: QuestionStatus;
}

const COPY: Record<QuestionStatus, { icon: string; title: string }> = {
  correct: { icon: '✅', title: 'Correct!' },
  incorrect: { icon: '❌', title: 'Not quite' },
  skipped: { icon: '⏭️', title: 'Skipped' },
};

export const FeedbackPanel = forwardRef<HTMLDivElement, FeedbackPanelProps>(function FeedbackPanel(
  { question, status },
  ref,
) {
  const { icon, title } = COPY[status];
  return (
    <div ref={ref} className={`feedback feedback--${status}`} role="status" aria-live="polite">
      <p className="feedback__title">
        <span aria-hidden="true">{icon}</span> {title}
      </p>
      {status !== 'correct' && (
        <p className="feedback__answer">
          <strong>Correct answer:</strong> <RichText text={correctAnswerText(question)} />
        </p>
      )}
      {question.explanation && (
        <p className="feedback__explanation">
          <RichText text={question.explanation} />
        </p>
      )}
    </div>
  );
});
