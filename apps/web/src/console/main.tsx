import {createRoot} from 'react-dom/client';
import {App, consumeOidcPopupRedirect} from './App';
import './app-shell.css';

if (consumeOidcPopupRedirect(window)) {
  window.close();
} else {
  const root = document.getElementById('root');
  if (!root) throw new Error('CONSOLE_ROOT_MISSING');
  createRoot(root).render(<App/>);
}
