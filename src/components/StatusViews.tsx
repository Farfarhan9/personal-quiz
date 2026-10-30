import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function LoadingView({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="state-view" role="status" aria-live="polite">
      <div className="skeleton skeleton--title" />
      <div className="skeleton" />
      <div className="skeleton" />
      <span className="visually-hidden">{label}</span>
    </div>
  );
}

export function ErrorView({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="state-view state-view--error" role="alert">
      <p className="state-view__emoji" aria-hidden="true">
        ⚠️
      </p>
      <h1 className="state-view__title">Something went wrong</h1>
      <p className="state-view__text pre-line">{error.message}</p>
      <div className="button-row">
        {onRetry && (
          <button type="button" className="btn btn--primary" onClick={onRetry}>
            Try again
          </button>
        )}
        <Link to="/" className="btn btn--secondary">
          Home
        </Link>
      </div>
    </div>
  );
}

export function EmptyView({ emoji, title, children }: { emoji: string; title: string; children?: ReactNode }) {
  return (
    <div className="state-view">
      <p className="state-view__emoji" aria-hidden="true">
        {emoji}
      </p>
      <h2 className="state-view__title">{title}</h2>
      {children}
    </div>
  );
}
