import { createRoot } from 'react-dom/client';

const root = document.getElementById('root');
if (!root) throw new Error('화면 진입점을 찾을 수 없습니다');
createRoot(root).render(<main><h1>Anvil</h1><p>개발 실행 환경을 준비하고 있습니다. 프로젝트 기능은 아직 연결되지 않았습니다.</p></main>);
