import {createRoot} from 'react-dom/client';
import {App} from './App';
import './app-shell.css';

const root = document.getElementById('root');
if (!root) throw new Error('CONSOLE_ROOT_MISSING');
createRoot(root).render(<App/>);
