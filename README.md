# Quiz Folders

A calm, mobile-first personal quiz website. Subjects work like folders: open a subject, pick a topic, answer one question at a time, get instant feedback, then review your answers and retry. Everything is static, so it runs free on GitHub Pages.

It ships with two subjects built from the Software Testing notes:

| Subject | Topics | Questions |
| --- | --- | --- |
| 🧪 Software Testing · Chapter 2 | What Is Testing · General Testing Principles · Why Testing Is Necessary · Fundamental Test Process · Psychology of Testing | 61 |
| 🔁 Software Testing · Chapter 3 | SDLC & Development Models · Test Levels · Test Types · Maintenance Testing | 67 |

All four question types are used (single choice, multiple choice, true/false, typed), including questions with diagrams and one question whose answer options are images.

## Features

- **Home** – subject cards with topic/question counts, progress, best average and last score; search by title, description or topic name.
- **Subject** – topic cards with best score, last score, attempts and completed badge; shuffle options for questions and answers.
- **Quiz** – one question per screen, “3 / 10” counter, progress bar, calm timer, Check → instant feedback with explanation, Skip, Previous, Next, Finish.
- **Summary** – score ring, correct/total, skipped, time, new-best message, full review list (filterable to just the ones to review), Retry / Back to subject / Home.
- **Author mode** – create or edit subjects, topics and questions in the browser, preview them, validate, and export JSON.
- **Progress** saved in `localStorage` (`quiz-app:progress:v1`); malformed storage is ignored safely.
- **Light theme by default**, dark mode toggle in the top bar, respects `prefers-reduced-motion`.
- Installable (“Add to Home Screen”) via a web manifest. No service worker.

## Run locally

Requires Node.js 18+.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-checks, then builds to dist/
npm run preview    # serves dist/ to check the production build
```

## Project structure

```
public/
  data/index.json              ← list of subjects
  data/subjects/*.json         ← one file per subject (topics + questions)
  images/                      ← question/option images (SVG/PNG/JPG)
  icons/, favicon.svg, manifest.webmanifest
src/
  main.tsx, App.tsx            ← HashRouter + routes
  types.ts                     ← discriminated-union question types
  lib/data.ts                  ← fetches JSON via import.meta.env.BASE_URL
  lib/validate.ts              ← schema validation (fetch, import, export)
  lib/grading.ts               ← grading + answer formatting per type
  lib/storage.ts               ← namespaced localStorage helpers
  lib/authoring.ts             ← author-mode helpers
  components/                  ← TopBar, QuestionCard, QuestionInput, FeedbackPanel, ReviewList, …
  pages/                       ← Home, Subject, Quiz, Author, NotFound
  styles.css                   ← plain CSS with variables
```

## Adding questions with JSON

1. Add the subject to `public/data/index.json`:

```json
{
  "subjects": [
    {
      "id": "biology",
      "title": "Biology",
      "description": "Cells, genetics, and living systems.",
      "file": "subjects/biology.json",
      "icon": "🧬",
      "color": "#22c55e"
    }
  ]
}
```

2. Create `public/data/subjects/biology.json`:

```json
{
  "id": "biology",
  "title": "Biology",
  "description": "Cells, genetics, and living systems.",
  "topics": [
    {
      "id": "cell-basics",
      "title": "Cell Basics",
      "description": "Organelles and cell structure.",
      "questions": [
        {
          "id": "bio-001",
          "type": "single_choice",
          "prompt": "What organelle is known as the powerhouse of the cell?",
          "image": null,
          "options": [
            { "id": "a", "text": "Nucleus" },
            { "id": "b", "text": "Mitochondria" }
          ],
          "correct": ["b"],
          "explanation": "Mitochondria produce most of the cell's ATP.",
          "difficulty": "easy",
          "tags": ["cells"]
        }
      ]
    }
  ]
}
```

### Question types

| `type` | Required fields | Grading |
| --- | --- | --- |
| `single_choice` | `options` (2+), `correct` (exactly 1 id) | selected id is correct |
| `multiple_choice` | `options` (2+), `correct` (1+ ids) | exact set match |
| `true_false` | `correct`: `["true"]` or `["false"]`; `options` optional (defaults to True/False) | as single choice |
| `typed` | `acceptedAnswers` (1+ strings) | trimmed, spaces collapsed, case-insensitive unless `"caseSensitive": true` |

Optional on every question: `image`, `explanation`, `difficulty` (`easy`/`medium`/`hard`), `tags`.

**Images** – put files in `public/images/` and reference them without a leading slash. `alt` is required:

```json
"image": { "src": "images/v-model.svg", "alt": "V-shaped diagram of development phases and test levels", "caption": "V-model" }
```

Options can have `text`, `image`, or both: `{ "id": "a", "image": { "src": "images/a.svg", "alt": "…" } }`.

**Typed keyboard overrides** (optional): `"input": { "placeholder": "Type a number", "inputMode": "numeric", "autoCapitalize": "off", "autoCorrect": false, "spellCheck": false }`.

Question ids must be unique within a subject. If a file has a problem, the app shows a readable error that names the topic, question and field.

## Author mode

Open `#/author` (✏️ in the top bar).

1. **Draft** – your work autosaves to this browser. Start a new subject, **Import JSON** from a file, or **load a subject already on the site** to edit it.
2. **Subject** – title, id, description, icon and colour.
3. **Topics** – switch topics with the dropdown; add, rename, reorder, delete.
4. **Questions** – tap a question to expand its editor. Change type, edit the prompt, image, options (tick the correct ones) or accepted answers, explanation, difficulty, tags. Use the **Preview** tab to try it exactly as it appears in a quiz.
5. **Check & export** – problems are listed with links that jump to the right question. When everything is valid, **Download** the `.json` (or **Copy JSON** on a phone) and copy the `index.json` entry shown underneath.

> **This is a static site.** Nothing is saved to a server. To make your questions permanent, put the exported file in `public/data/subjects/`, add the entry to `public/data/index.json`, then commit and push.

## Deploy to GitHub Pages

The repo includes `.github/workflows/deploy.yml`.

1. Push the project to a GitHub repository (branch `main`).
2. In the repo go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. Push again (or run the workflow manually from the **Actions** tab). The site appears at `https://<username>.github.io/<repo>/`.

Manual alternative: run `npm run build` and publish the `dist/` folder with any static host (or the `gh-pages` branch).

### Why HashRouter?

GitHub Pages can't rewrite unknown paths to `index.html`, so a normal route like `/quiz/biology/cells` would 404 on refresh. With `HashRouter`, routes live after the `#` (`/#/quiz/biology/cells`), so deep links, refreshes and bookmarks always work. Vite's `base: './'` keeps asset paths relative, and all data is fetched with `import.meta.env.BASE_URL`, so the same build works under any repo name.

## Test on a phone

- **Same Wi-Fi:** `npm run dev -- --host`, then open the “Network” URL Vite prints (e.g. `http://192.168.1.20:5173`) on your phone.
- **Deployed:** open `https://<username>.github.io/<repo>/` on your phone. Use the browser's Share → *Add to Home Screen* for an app-like icon.
- **Desktop simulation:** Chrome DevTools → device toolbar, check widths 320, 375, 390, 414 and 768, and rotate to landscape. Check that there is no sideways scroll, the bottom bar stays visible, and feedback appears above it.

## Mobile design decisions

- **Tap targets** – every button, link, option row and toggle is at least 44×44 CSS px (most are 48px+). Answer rows are full-width labels, so tapping anywhere on the row selects it.
- **Selection is never colour-only** – a selected option gets a thicker border plus a ✓ in its marker; after checking, rows are tagged “✓ Correct answer” / “✗ Your answer” and wrong picks use a dashed border.
- **One-thumb flow** – Check / Next / Finish / Skip / Previous live in a sticky bottom bar. The page reserves bottom padding equal to the bar, and feedback scrolls into view above it. “Next” scrolls smoothly to the top of the new question.
- **Safe areas** – `viewport-fit=cover` + `env(safe-area-inset-*)` keep the top bar clear of the notch and the bottom bar clear of the iOS home indicator; side insets are respected in landscape.
- **Viewport height** – full-height layouts use `100dvh` with a `100vh` fallback.
- **Typed answers** – inputs are 16px+ (no iOS zoom), with autocorrect/autocapitalise/spellcheck off by default, `enterkeyhint="go"`, Enter checks the answer, and the field scrolls to the centre when the keyboard opens. A Check button sits directly under the input.
- **Images** – responsive (`max-width: 100%; height: auto`), and tap-to-enlarge in a full-screen viewer (pinch-zoom allowed) with a large close button.
- **No hover dependence**, `touch-action: manipulation` on interactive elements, and short-landscape layouts tighten spacing.

## Adding a new question type

`Question` in `src/types.ts` is a discriminated union on `type`. Add your interface to the union, then follow the TypeScript errors: `assertNever` in `lib/grading.ts`, `components/QuestionInput.tsx` and `lib/authoring.ts` will flag every switch that needs a new case. Add validation rules in `lib/validate.ts`.
