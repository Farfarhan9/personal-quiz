import { correctAnswerText, userAnswerText } from '../lib/grading';
import type { Question, QuestionStatus, UserAnswer } from '../types';
import { ZoomableImage } from './ImageViewer';

export interface ReviewItem {
  question: Question;
  answer: UserAnswer | undefined;
  status: QuestionStatus;
}

const STATUS_LABEL: Record<QuestionStatus, string> = {
  correct: '✓ Correct',
  incorrect: '✗ Incorrect',
  skipped: '⏭ Skipped',
};

export function ReviewList({ items }: { items: ReviewItem[] }) {
  if (items.length === 0) {
    return <p className="empty-inline">Nothing to show here — nice work! 🎉</p>;
  }
  return (
    <ol className="review-list">
      {items.map(({ question, answer, status }, i) => (
        <li key={question.id} className={`review-item review-item--${status}`}>
          <div className="review-item__head">
            <span className="review-item__num">Q{i + 1}</span>
            <span className={`status-pill status-pill--${status}`}>{STATUS_LABEL[status]}</span>
          </div>
          <p className="review-item__prompt">{question.prompt}</p>
          {question.image && <ZoomableImage image={question.image} className="review-item__image" />}
          <dl className="review-item__answers">
            <div>
              <dt>Your answer</dt>
              <dd>{status === 'skipped' ? 'Skipped' : userAnswerText(question, answer)}</dd>
            </div>
            {status !== 'correct' && (
              <div>
                <dt>Correct answer</dt>
                <dd>{correctAnswerText(question)}</dd>
              </div>
            )}
          </dl>
          {question.explanation && <p className="review-item__explanation">💡 {question.explanation}</p>}
        </li>
      ))}
    </ol>
  );
}
