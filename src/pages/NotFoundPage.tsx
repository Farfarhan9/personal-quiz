import { Link } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { useDocumentTitle } from '../lib/hooks';

export default function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <>
      <TopBar title="Not found" backTo="/" backLabel="Home" />
      <main className="page" id="main">
        <div className="state-view">
          <p className="state-view__emoji" aria-hidden="true">
            🧭
          </p>
          <h1 className="state-view__title">This page wandered off</h1>
          <p className="state-view__text">The link may be old, or the quiz may have been renamed.</p>
          <Link to="/" className="btn btn--primary">
            Go to all subjects
          </Link>
        </div>
      </main>
    </>
  );
}
