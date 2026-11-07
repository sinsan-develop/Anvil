import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './styles/tokens.css';
import './styles/app.css';

const root = document.getElementById('root');
if (!root) throw new Error('화면 진입점을 찾을 수 없습니다');
createRoot(root).render(<App />);
