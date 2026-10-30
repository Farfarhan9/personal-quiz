import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import AuthorPage from './pages/AuthorPage';
import HomePage from './pages/HomePage';
import NotFoundPage from './pages/NotFoundPage';
import QuizPage from './pages/QuizPage';
import SubjectPage from './pages/SubjectPage';

/** Start every page at the top, like a normal page load. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <div className="app">
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/subject/:subjectId" element={<SubjectPage />} />
        <Route path="/quiz/:subjectId/:topicId" element={<QuizPage />} />
        <Route path="/author" element={<AuthorPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  );
}
