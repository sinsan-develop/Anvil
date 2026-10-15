import { useEffect, useState } from 'react';
import { ApiClient, ApiError } from './api/client.ts';
import { AppShell } from './shell/AppShell.tsx';
import { StatusView } from './shell/StatusView.tsx';
import { parseRoute } from './shell/routes.ts';

const client = new ApiClient();
interface Session { user: { id: string; displayName: string }; clientId: string }
export function App() {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const changed = () => setRoute(parseRoute(location.hash));
    addEventListener('hashchange', changed);
    return () => removeEventListener('hashchange', changed);
  }, []);
  useEffect(() => {
    let current = true;
    setLoading(true);
    client.get<Session>('/api/v1/session').then(value => {
      if (!value?.user || typeof value.user.id !== 'string' || typeof value.user.displayName !== 'string' || typeof value.clientId !== 'string') throw new ApiError('RESPONSE_INVALID');
      if (current) { setSession(value); setError(null); }
    }).catch((cause: unknown) => {
      if (current) { setSession(null); setError(cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID')); }
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [retry]);
  return <AppShell route={route} displayName={session?.user.displayName}>
    <StatusView loading={loading} error={error} onRetry={() => setRetry(v => v + 1)}>
      <section className="status-card"><h2>아직 연결되지 않은 화면</h2><p>공통 탐색을 구현 중입니다. 이 화면의 실제 처리·저장·조회 기능은 아직 연결되지 않았습니다.</p></section>
    </StatusView>
  </AppShell>;
}
