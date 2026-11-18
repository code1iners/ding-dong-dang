import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/app.css';
import './styles/hearts.css';

/** React가 그릴 자리. */
const root = document.getElementById('root');
if (!root) throw new Error('#root가 없어요');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
