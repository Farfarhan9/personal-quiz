import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../lib/hooks';

interface TopBarProps {
  title: string;
  /** Where the back arrow goes. Omit on the home page. */
  backTo?: string;
  backLabel?: string;
  /** Optional handler that runs instead of navigating (e.g. to confirm leaving a quiz). */
  onBack?: () => void;
  actions?: ReactNode;
}

export function TopBar({ title, backTo, backLabel = 'Back', onBack, actions }: TopBarProps) {
  const [theme, toggleTheme] = useTheme();
  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  return (
    <header className="topbar">
      <div className="topbar__inner">
        {backTo || onBack ? (
          onBack ? (
            <button type="button" className="icon-btn topbar__back" onClick={onBack} aria-label={backLabel}>
              <span aria-hidden="true">←</span>
              <span className="topbar__back-text">{backLabel}</span>
            </button>
          ) : (
            <Link to={backTo ?? '/'} className="icon-btn topbar__back" aria-label={backLabel}>
              <span aria-hidden="true">←</span>
              <span className="topbar__back-text">{backLabel}</span>
            </Link>
          )
        ) : (
          <Link to="/" className="topbar__brand" aria-label="Quiz Folders home">
            <span className="topbar__logo" aria-hidden="true">
              🗂️
            </span>
          </Link>
        )}
        <p className="topbar__title" title={title}>
          {title}
        </p>
        <div className="topbar__actions">
          {actions}
          <button
            type="button"
            className="icon-btn"
            onClick={toggleTheme}
            aria-label={`Switch to ${nextTheme} mode`}
            title={`Switch to ${nextTheme} mode`}
          >
            <span aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
