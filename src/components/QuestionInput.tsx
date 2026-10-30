import { useState, type FormEvent } from 'react';
import { assertNever, optionLetter } from '../lib/grading';
import { assetUrl } from '../lib/data';
import type { ChoiceQuestion, Question, QuizImage, TypedQuestion, UserAnswer } from '../types';
import { ImageDialog } from './ImageViewer';

export interface QuestionInputProps {
  question: Question;
  answer: UserAnswer | undefined;
  onChange: (answer: UserAnswer) => void;
  /** True once the answer has been checked: inputs become read-only. */
  locked: boolean;
  /** Show correct / incorrect markers on the options. */
  reveal: boolean;
  /** Called when the user presses Enter / Go in a typed answer, or taps the inline Check button. */
  onSubmit?: () => void;
  /** Prefix that keeps element ids unique when several questions are on screen. */
  idPrefix: string;
  /** Id of the element holding the question prompt (for aria-labelledby). */
  labelledBy: string;
}

/** Picks the right input UI for the question type. Add a case here when you add a new type. */
export function QuestionInput(props: QuestionInputProps) {
  const { question } = props;
  switch (question.type) {
    case 'single_choice':
    case 'multiple_choice':
    case 'true_false':
      return <ChoiceList {...props} question={question} />;
    case 'typed':
      return <TypedAnswerInput {...props} question={question} />;
    default:
      return assertNever(question);
  }
}

/* ------------------------------------------------------------------ */

interface ChoiceListProps extends QuestionInputProps {
  question: ChoiceQuestion;
}

function ChoiceList({ question, answer, onChange, locked, reveal, idPrefix, labelledBy }: ChoiceListProps) {
  const [zoomImage, setZoomImage] = useState<QuizImage | null>(null);
  const multi = question.type === 'multiple_choice';
  const selected = answer?.kind === 'choice' ? answer.selected : [];
  const name = `${idPrefix}-${question.id}`;

  const toggle = (optionId: string) => {
    if (locked) return;
    if (multi) {
      const next = selected.includes(optionId) ? selected.filter((x) => x !== optionId) : [...selected, optionId];
      onChange({ kind: 'choice', selected: next });
    } else {
      onChange({ kind: 'choice', selected: [optionId] });
    }
  };

  const hint = multi ? 'Select all that apply' : 'Select one answer';

  return (
    <fieldset className={`choices ${question.type === 'true_false' ? 'choices--tf' : ''}`} aria-labelledby={labelledBy}>
      <legend className="choices__hint">{hint}</legend>
      <div className="choices__list">
        {question.options.map((option, index) => {
          const inputId = `${name}-${option.id}`;
          const isSelected = selected.includes(option.id);
          const isCorrect = question.correct.includes(option.id);
          let state = '';
          if (reveal) {
            if (isCorrect) state = 'is-correct';
            else if (isSelected) state = 'is-wrong';
            else state = 'is-dimmed';
          }
          const letter = optionLetter(index);
          const marker = isSelected ? '✓' : question.type === 'true_false' ? (option.id === 'true' ? 'T' : 'F') : letter;
          return (
            <div key={option.id} className={`option ${isSelected ? 'is-selected' : ''} ${state}`}>
              <input
                id={inputId}
                className="option__input"
                type={multi ? 'checkbox' : 'radio'}
                name={name}
                value={option.id}
                checked={isSelected}
                disabled={locked}
                onChange={() => toggle(option.id)}
              />
              <label htmlFor={inputId} className="option__label">
                <span className={`option__mark ${multi ? 'option__mark--square' : ''}`} aria-hidden="true">
                  {marker}
                </span>
                <span className="option__body">
                  {option.text && <span className="option__text">{option.text}</span>}
                  {option.image && (
                    <img
                      src={assetUrl(option.image.src)}
                      alt={option.image.alt}
                      className="option__img responsive-img"
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                  {reveal && isCorrect && <span className="option__tag option__tag--correct">✓ Correct answer</span>}
                  {reveal && isSelected && !isCorrect && (
                    <span className="option__tag option__tag--wrong">✗ Your answer</span>
                  )}
                </span>
              </label>
              {option.image && (
                <button
                  type="button"
                  className="icon-btn option__zoom"
                  onClick={() => setZoomImage(option.image ?? null)}
                  aria-label={`Enlarge image for option ${letter}`}
                >
                  <span aria-hidden="true">🔍</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
      <ImageDialog image={zoomImage} onClose={() => setZoomImage(null)} />
    </fieldset>
  );
}

/* ------------------------------------------------------------------ */

interface TypedAnswerProps extends QuestionInputProps {
  question: TypedQuestion;
}

function TypedAnswerInput({
  question,
  answer,
  onChange,
  locked,
  reveal,
  onSubmit,
  idPrefix,
  labelledBy,
}: TypedAnswerProps) {
  const value = answer?.kind === 'text' ? answer.value : '';
  const [showEmptyHint, setShowEmptyHint] = useState(false);
  const inputId = `${idPrefix}-${question.id}-typed`;
  const hints = question.input ?? {};

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (locked) return;
    if (!value.trim()) {
      setShowEmptyHint(true);
      return;
    }
    onSubmit?.();
  };

  return (
    <form className="typed" onSubmit={handleSubmit} noValidate>
      <label htmlFor={inputId} className="typed__label">
        Your answer
      </label>
      <div className="typed__row">
        <input
          id={inputId}
          className={`input typed__input ${reveal ? 'is-revealed' : ''}`}
          type="text"
          value={value}
          readOnly={locked}
          aria-describedby={`${labelledBy}${showEmptyHint ? ` ${inputId}-hint` : ''}`}
          inputMode={hints.inputMode ?? 'text'}
          autoComplete="off"
          autoCorrect={hints.autoCorrect ? 'on' : 'off'}
          autoCapitalize={hints.autoCapitalize ?? 'off'}
          spellCheck={hints.spellCheck ?? false}
          enterKeyHint="go"
          placeholder={hints.placeholder ?? 'Type your answer'}
          onChange={(e) => {
            setShowEmptyHint(false);
            onChange({ kind: 'text', value: e.target.value });
          }}
          onFocus={(e) => {
            // Give the on-screen keyboard time to open, then keep the input and button in view.
            const el = e.currentTarget;
            window.setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
          }}
        />
        {!locked && (
          <button type="submit" className="btn btn--primary typed__submit">
            Check answer
          </button>
        )}
      </div>
      {showEmptyHint && (
        <p id={`${inputId}-hint`} className="typed__hint" role="status">
          Type an answer first, or use Skip.
        </p>
      )}
      {!locked && (
        <p className="typed__note">{question.caseSensitive ? 'Case matters for this answer.' : 'Not case-sensitive.'}</p>
      )}
    </form>
  );
}
