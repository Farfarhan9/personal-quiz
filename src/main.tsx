import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { applyTheme } from './lib/hooks';
import { getSettings } from './lib/storage';
import './styles.css';

applyTheme(getSettings().theme);

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found');

createRoot(rootElement).render(
  <StrictMode>
    {/* HashRouter: GitHub Pages has no server rewrites, so deep links live after the "#". */}
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
