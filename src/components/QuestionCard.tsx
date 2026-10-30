import { forwardRef } from 'react';
import { QUESTION_TYPE_LABELS, type Question, type UserAnswer } from '../types';
import { ZoomableImage } from './ImageViewer';
import { QuestionInput } from './QuestionInput';

interface QuestionCardProps {
  question: Question;
  answer: UserAnswer | undefined;
  onChange: (answer: UserAnswer) => void;
  locked: boolean;
  reveal: boolean;
  onSubmit?: () => void;
  idPrefix: string;
  /** e.g. "Question 3 of 10" — announced to screen readers above the prompt. */
  eyebrow?: string;
}

/** Prompt + optional image + the type-specific input. Shared by the quiz and the author preview. */
export const QuestionCard = forwardRef<HTMLHeadingElement, QuestionCardProps>(function QuestionCard(
  { question, answer, onChange, locked, reveal, onSubmit, idPrefix, eyebrow },
  headingRef,
) {
  const promptId = `${idPrefix}-${question.id}-prompt`;
  return (
    <article className="question-card">
      <div className="question-card__meta">
        {eyebrow && <span className="question-card__eyebrow">{eyebrow}</span>}
        <span className="badge">{QUESTION_TYPE_LABELS[question.type]}</span>
        {question.difficulty && (
          <span className={`badge badge--${question.difficulty}`}>{question.difficulty}</span>
        )}
      </div>
      <h2 id={promptId} className="question-card__prompt" ref={headingRef} tabIndex={-1}>
        {question.prompt || <span className="muted">(No question text yet)</span>}
      </h2>
      {question.image && <ZoomableImage image={question.image} className="question-card__image" />}
      <QuestionInput
        question={question}
        answer={answer}
        onChange={onChange}
        locked={locked}
        reveal={reveal}
        onSubmit={onSubmit}
        idPrefix={idPrefix}
        labelledBy={promptId}
      />
    </article>
  );
});
