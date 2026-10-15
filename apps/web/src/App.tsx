import { useEffect, useState } from 'react';
import { ApiClient, ApiError } from './api/client.ts';
import { AppShell } from './shell/AppShell.tsx';
import { StatusView } from './shell/StatusView.tsx';
import { parseRoute } from './shell/routes.ts';
import { AuthForm } from './shell/AuthForm.tsx';
import { AccountSecurity } from './shell/AccountSecurity.tsx';

const client = new ApiClient();
interface Session { user: { id: string; displayName: string }; clientId: string; csrfToken: string }
function readSession(value: unknown): Session {
  const candidate = value as Session;
  if (!candidate?.user || typeof candidate.user.id !== 'string' || typeof candidate.user.displayName !== 'string' || typeof candidate.clientId !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(candidate.csrfToken)) throw new ApiError('RESPONSE_INVALID');
  return candidate;
}
export function App() {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [retry, setRetry] = useState(0);
  const [endingSession, setEndingSession] = useState(false);
  async function logout() {
    if (!session || endingSession) return;
    setEndingSession(true);
    try {
      await client.postAuth('logout', {}, session.csrfToken);
      setSession(null); setError(new ApiError('AUTH_REQUIRED', 401));
    } catch (cause: unknown) { setError(cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID')); }
    finally { setEndingSession(false); }
  }
  useEffect(() => {
    const changed = () => setRoute(parseRoute(location.hash));
    addEventListener('hashchange', changed);
    return () => removeEventListener('hashchange', changed);
  }, []);
  useEffect(() => {
    let current = true;
    setLoading(true);
    client.get<Session>('/api/v1/session').then(value => {
      const valid = readSession(value);
      if (current) { setSession(valid); setError(null); }
    }).catch((cause: unknown) => {
      if (current) { setSession(null); setError(cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID')); }
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [retry]);
  return <AppShell route={route} displayName={session?.user.displayName} onLogout={session ? () => { void logout(); } : undefined} endingSession={endingSession}>
    <StatusView loading={loading} error={error} onRetry={() => setRetry(v => v + 1)}>
      {session && route.screen === 'settings' ? <AccountSecurity client={client} csrfToken={session.csrfToken} onSession={value => setSession(readSession(value))} onRevoked={() => { setSession(null); setError(new ApiError('AUTH_REQUIRED', 401)); }} /> : <section className="status-card"><h2>아직 연결되지 않은 화면</h2><p>공통 탐색을 구현 중입니다. 이 화면의 실제 처리·저장·조회 기능은 아직 연결되지 않았습니다.</p></section>}
    </StatusView>
    {!loading && error?.status === 401 ? <AuthForm client={client} onAuthenticated={value => { setSession(readSession(value)); setError(null); }} /> : null}
  </AppShell>;
}
