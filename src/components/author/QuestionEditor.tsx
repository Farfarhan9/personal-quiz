import { useState } from 'react';
import { convertQuestion, nextOptionId } from '../../lib/authoring';
import { assetUrl } from '../../lib/data';
import { gradeAnswer, isAnswered, isChoiceQuestion, optionLetter } from '../../lib/grading';
import type { ValidationIssue } from '../../lib/validate';
import {
  DIFFICULTIES,
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  type ChoiceOption,
  type ChoiceQuestion,
  type Difficulty,
  type Question,
  type QuestionType,
  type QuizImage,
  type TypedQuestion,
  type UserAnswer,
} from '../../types';
import { FeedbackPanel } from '../FeedbackPanel';
import { QuestionCard } from '../QuestionCard';
import { SelectField, TextAreaField, TextField } from './Fields';

interface QuestionEditorProps {
  question: Question;
  index: number;
  total: number;
  issues: ValidationIssue[];
  onChange: (q: Question) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMove: (delta: -1 | 1) => void;
}

export function QuestionEditor({ question, index, total, issues, onChange, onDelete, onDuplicate, onMove }: QuestionEditorProps) {
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const uid = `qe-${index}`;

  return (
    <div className="qeditor">
      <div className="segmented segmented--full" role="tablist" aria-label="Question editor view">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'edit'}
          className="segmented__btn"
          onClick={() => setTab('edit')}
        >
          ✏️ Edit
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'preview'}
          className="segmented__btn"
          onClick={() => setTab('preview')}
        >
          👀 Preview
        </button>
      </div>

      {issues.length > 0 && (
        <ul className="issue-list" aria-label="Problems with this question">
          {issues.map((issue, i) => (
            <li key={i}>⚠️ {issue.message}</li>
          ))}
        </ul>
      )}

      {tab === 'preview' ? (
        <QuestionPreview key={`${question.id}-${question.type}`} question={question} />
      ) : (
        <div className="qeditor__form">
          <SelectField<QuestionType>
            id={`${uid}-type`}
            label="Question type"
            value={question.type}
            options={QUESTION_TYPES.map((t) => ({ value: t, label: QUESTION_TYPE_LABELS[t] }))}
            onChange={(t) => onChange(convertQuestion(question, t))}
            hint="Changing the type keeps your text where possible."
          />
          <TextAreaField
            id={`${uid}-prompt`}
            label="Question"
            required
            value={question.prompt}
            onChange={(prompt) => onChange({ ...question, prompt })}
            placeholder="e.g. What is the powerhouse of the cell?"
          />
          <TextAreaField
            id={`${uid}-code`}
            label="Code snippet (optional)"
            monospace
            rows={4}
            value={question.code ?? ''}
            onChange={(code) => onChange({ ...question, code: code || undefined })}
            placeholder={'e.g. <ul>\n  <li>Item</li>\n</ul>'}
            hint="Shown under the question in a monospace box. Indentation is kept."
          />
          <ImageFields
            id={`${uid}-img`}
            label="Question image"
            image={question.image ?? undefined}
            onChange={(image) => onChange({ ...question, image })}
          />

          {isChoiceQuestion(question) && <OptionsEditor uid={uid} question={question} onChange={onChange} />}
          {question.type === 'typed' && <TypedEditor uid={uid} question={question} onChange={onChange} />}

          <TextAreaField
            id={`${uid}-expl`}
            label="Explanation (shown after checking)"
            value={question.explanation ?? ''}
            onChange={(explanation) => onChange({ ...question, explanation })}
            placeholder="Why is the answer correct?"
          />
          <div className="field-row">
            <SelectField<'' | Difficulty>
              id={`${uid}-diff`}
              label="Difficulty"
              value={question.difficulty ?? ''}
              options={[{ value: '', label: '—' }, ...DIFFICULTIES.map((d) => ({ value: d, label: d }))]}
              onChange={(d) => onChange({ ...question, difficulty: d === '' ? undefined : d })}
            />
            <TextField
              id={`${uid}-id`}
              label="Question id"
              required
              monospace
              value={question.id}
              onChange={(id) => onChange({ ...question, id: id.trim() })}
              hint="Unique within the subject."
            />
          </div>
          <TextField
            id={`${uid}-tags`}
            label="Tags"
            value={(question.tags ?? []).join(', ')}
            onChange={(v) => onChange({ ...question, tags: v.split(',').map((t) => t.trimStart()) })}
            placeholder="cells, organelles"
            hint="Comma separated. Optional."
          />

          <div className="qeditor__actions">
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => onMove(-1)} disabled={index === 0}>
              ↑ Move up
            </button>
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => onMove(1)} disabled={index === total - 1}>
              ↓ Move down
            </button>
            <button type="button" className="btn btn--secondary btn--sm" onClick={onDuplicate}>
              ⧉ Duplicate
            </button>
            <button type="button" className="btn btn--danger btn--sm" onClick={onDelete}>
              🗑 Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ImageFields({
  id,
  label,
  image,
  onChange,
  compact,
}: {
  id: string;
  label: string;
  image: QuizImage | undefined;
  onChange: (image: QuizImage | undefined) => void;
  compact?: boolean;
}) {
  if (!image) {
    return (
      <button type="button" className="btn btn--ghost btn--sm add-image-btn" onClick={() => onChange({ src: 'images/', alt: '' })}>
        🖼️ Add {compact ? 'image' : label.toLowerCase()}
      </button>
    );
  }
  return (
    <fieldset className="image-fields">
      <legend className="field__label">{label}</legend>
      <TextField
        id={`${id}-src`}
        label="Image path"
        monospace
        required
        value={image.src}
        onChange={(src) => onChange({ ...image, src })}
        placeholder="images/diagram.png"
        hint={
          <>
            Put the file in <code>public/images/</code> and enter <code>images/your-file.png</code>.
          </>
        }
      />
      <TextField
        id={`${id}-alt`}
        label="Alt text"
        required
        value={image.alt}
        onChange={(alt) => onChange({ ...image, alt })}
        placeholder="Describe what the image shows"
      />
      {!compact && (
        <TextField
          id={`${id}-cap`}
          label="Caption (optional)"
          value={image.caption ?? ''}
          onChange={(caption) => onChange({ ...image, caption: caption || undefined })}
        />
      )}
      {image.src && image.src !== 'images/' && (
        <img src={assetUrl(image.src)} alt={image.alt || 'Image preview'} className="image-fields__preview responsive-img" />
      )}
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => onChange(undefined)}>
        Remove image
      </button>
    </fieldset>
  );
}

/* ------------------------------------------------------------------ */

function OptionsEditor({
  uid,
  question,
  onChange,
}: {
  uid: string;
  question: ChoiceQuestion;
  onChange: (q: Question) => void;
}) {
  const multi = question.type === 'multiple_choice';
  const tf = question.type === 'true_false';

  const setOptions = (options: ChoiceOption[], correct = question.correct) =>
    onChange({ ...question, options, correct: correct.filter((c) => options.some((o) => o.id === c)) });

  const toggleCorrect = (id: string) => {
    if (multi) {
      const correct = question.correct.includes(id) ? question.correct.filter((c) => c !== id) : [...question.correct, id];
      onChange({ ...question, correct });
    } else {
      onChange({ ...question, correct: [id] });
    }
  };

  return (
    <fieldset className="options-editor">
      <legend className="field__label">
        {tf ? 'Correct answer' : 'Answer options'} <span className="field__req">*</span>
      </legend>
      <p className="field__hint">
        {tf
          ? 'Choose whether the statement is true or false.'
          : multi
            ? 'Tick every correct option. Grading requires the exact set.'
            : 'Choose the single correct option.'}
      </p>
      <ol className="options-editor__list">
        {question.options.map((option, i) => {
          const isCorrect = question.correct.includes(option.id);
          return (
            <li key={option.id} className={`opt-row ${isCorrect ? 'is-correct' : ''}`}>
              <div className="opt-row__top">
                <span className="opt-row__letter" aria-hidden="true">
                  {optionLetter(i)}
                </span>
                <label className="opt-row__correct">
                  <input
                    type={multi ? 'checkbox' : 'radio'}
                    name={`${uid}-correct`}
                    checked={isCorrect}
                    onChange={() => toggleCorrect(option.id)}
                  />
                  <span>{isCorrect ? '✓ Correct' : 'Mark correct'}</span>
                </label>
                {!tf && (
                  <button
                    type="button"
                    className="icon-btn opt-row__remove"
                    onClick={() => setOptions(question.options.filter((o) => o.id !== option.id))}
                    aria-label={`Remove option ${optionLetter(i)}`}
                    disabled={question.options.length <= 2}
                  >
                    <span aria-hidden="true">🗑</span>
                  </button>
                )}
              </div>
              {tf ? (
                <p className="opt-row__tf">{option.text}</p>
              ) : (
                <>
                  <TextField
                    id={`${uid}-opt-${option.id}`}
                    label={`Option ${optionLetter(i)} text`}
                    value={option.text ?? ''}
                    onChange={(text) =>
                      setOptions(question.options.map((o) => (o.id === option.id ? { ...o, text } : o)))
                    }
                    placeholder={option.image ? 'Optional when an image is set' : 'Answer text'}
                  />
                  <ImageFields
                    id={`${uid}-opt-${option.id}-img`}
                    label={`Option ${optionLetter(i)} image`}
                    compact
                    image={option.image ?? undefined}
                    onChange={(image) =>
                      setOptions(question.options.map((o) => (o.id === option.id ? { ...o, image } : o)))
                    }
                  />
                </>
              )}
            </li>
          );
        })}
      </ol>
      {!tf && (
        <button
          type="button"
          className="btn btn--secondary btn--block"
          onClick={() => setOptions([...question.options, { id: nextOptionId(question.options), text: '' }])}
        >
          + Add option
        </button>
      )}
    </fieldset>
  );
}

/* ------------------------------------------------------------------ */

function TypedEditor({ uid, question, onChange }: { uid: string; question: TypedQuestion; onChange: (q: Question) => void }) {
  const set = (acceptedAnswers: string[]) => onChange({ ...question, acceptedAnswers });
  return (
    <fieldset className="options-editor">
      <legend className="field__label">
        Accepted answers <span className="field__req">*</span>
      </legend>
      <p className="field__hint">Any of these counts as correct. Extra spaces are ignored.</p>
      <ol className="options-editor__list">
        {question.acceptedAnswers.map((ans, i) => (
          <li key={i} className="opt-row opt-row--inline">
            <TextField
              id={`${uid}-acc-${i}`}
              label={`Accepted answer ${i + 1}`}
              value={ans}
              onChange={(v) => set(question.acceptedAnswers.map((a, j) => (j === i ? v : a)))}
              placeholder="e.g. mitochondria"
            />
            <button
              type="button"
              className="icon-btn opt-row__remove"
              onClick={() => set(question.acceptedAnswers.filter((_, j) => j !== i))}
              aria-label={`Remove accepted answer ${i + 1}`}
              disabled={question.acceptedAnswers.length <= 1}
            >
              <span aria-hidden="true">🗑</span>
            </button>
          </li>
        ))}
      </ol>
      <button type="button" className="btn btn--secondary btn--block" onClick={() => set([...question.acceptedAnswers, ''])}>
        + Add accepted answer
      </button>
      <label className="check-row">
        <input
          type="checkbox"
          checked={question.caseSensitive === true}
          onChange={(e) => onChange({ ...question, caseSensitive: e.target.checked })}
        />
        <span>Case-sensitive (e.g. “DNA” ≠ “dna”)</span>
      </label>
      <TextField
        id={`${uid}-ph`}
        label="Input placeholder (optional)"
        value={question.input?.placeholder ?? ''}
        onChange={(placeholder) => onChange({ ...question, input: { ...question.input, placeholder: placeholder || undefined } })}
        placeholder="Type your answer"
      />
    </fieldset>
  );
}

/* ------------------------------------------------------------------ */

function QuestionPreview({ question }: { question: Question }) {
  const [answer, setAnswer] = useState<UserAnswer | undefined>(undefined);
  const [checked, setChecked] = useState(false);
  const answered = isAnswered(question, answer);
  const check = () => {
    if (answered) setChecked(true);
  };
  return (
    <div className="preview">
      <p className="preview__note">This is how the question looks in a quiz. Try answering it.</p>
      <QuestionCard
        question={question}
        answer={answer}
        onChange={setAnswer}
        locked={checked}
        reveal={checked}
        onSubmit={check}
        idPrefix="preview"
      />
      {checked && <FeedbackPanel question={question} status={gradeAnswer(question, answer) ? 'correct' : 'incorrect'} />}
      <div className="button-row">
        {checked ? (
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => {
              setChecked(false);
              setAnswer(undefined);
            }}
          >
            ↻ Try again
          </button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={check} disabled={!answered}>
            Check answer
          </button>
        )}
      </div>
    </div>
  );
}
