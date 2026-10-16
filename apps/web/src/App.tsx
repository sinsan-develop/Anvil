import { useEffect, useState } from 'react';
import { ApiClient, ApiError } from './api/client.ts';
import { AppShell } from './shell/AppShell.tsx';
import { StatusView } from './shell/StatusView.tsx';
import { parseRoute } from './shell/routes.ts';
import { AuthForm } from './shell/AuthForm.tsx';
import { AccountSecurity } from './shell/AccountSecurity.tsx';
import { ProjectsPage } from './features/projects/ProjectsPage.tsx';
import { ProjectCreatePage } from './features/project-create/ProjectCreatePage.tsx';
import { emptyDraft } from './features/project-create/api.ts';
import { MethodologyEditorPage } from './features/methodology-editor/MethodologyEditorPage.tsx';
import { emptyMethodBuffer } from './features/methodology-editor/common-api.ts';
import { emptyFormBuffer } from './features/methodologies/form-editor-state.ts';
import { DocumentsPage } from './features/design-trace/DocumentsPage.tsx';

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
  const [draftBuffer, setDraftBuffer] = useState(emptyDraft);
  const [methodBuffer, setMethodBuffer] = useState(emptyMethodBuffer);
  const [formBuffer, setFormBuffer] = useState(emptyFormBuffer);
  function newProject() {
    if (draftBuffer.pendingCommand || draftBuffer.pendingAction) { alert('앞선 저장 결과를 먼저 확인하세요. 입력과 명령을 유지했습니다.'); return false; }
    if ((draftBuffer.dirty || draftBuffer.review?.dirty) && !confirm('탭의 미저장 입력을 버리고 새 초안을 시작할까요?')) return false;
    setDraftBuffer(emptyDraft()); return true;
  }
  useEffect(() => {
    if (!draftBuffer.dirty && !draftBuffer.pendingCommand && !draftBuffer.pendingAction && !draftBuffer.review?.dirty && !methodBuffer.dirty && !methodBuffer.pending && !methodBuffer.review?.dirty && !methodBuffer.review?.pending && !formBuffer.dirty && !formBuffer.pending && !formBuffer.review?.dirty && !formBuffer.review?.pending) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [draftBuffer.dirty, draftBuffer.pendingCommand, draftBuffer.pendingAction, draftBuffer.review?.dirty, methodBuffer.dirty, methodBuffer.pending, methodBuffer.review?.dirty, methodBuffer.review?.pending, formBuffer.dirty, formBuffer.pending, formBuffer.review?.dirty, formBuffer.review?.pending]);
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
      {session && route.screen === 'documents' && route.projectId ? <DocumentsPage key={session.user.id + ':' + route.projectId} client={client} projectId={route.projectId} onAuthenticationLost={() => { setSession(null); setError(new ApiError('AUTH_REQUIRED', 401)); }} /> : session && route.screen === 'create' ? <ProjectCreatePage client={client} session={session} buffer={draftBuffer} onChange={setDraftBuffer} onAuthenticationLost={() => { setSession(null); setError(new ApiError('AUTH_REQUIRED', 401)); }} /> : session && route.screen === 'projects' ? <ProjectsPage client={client} onNewProject={newProject} onAuthenticationLost={() => { setSession(null); setError(new ApiError('AUTH_REQUIRED', 401)); }} /> : session && route.screen === 'methodologies' && !route.projectId ? <MethodologyEditorPage client={client} session={session} buffer={methodBuffer} onChange={setMethodBuffer} formBuffer={formBuffer} onFormChange={setFormBuffer} onAuthenticationLost={() => { setSession(null); setError(new ApiError('AUTH_REQUIRED', 401)); }} /> : session && route.screen === 'settings' ? <AccountSecurity client={client} csrfToken={session.csrfToken} onSession={value => setSession(readSession(value))} onRevoked={() => { setSession(null); setError(new ApiError('AUTH_REQUIRED', 401)); }} /> : <section className="status-card"><h2>아직 연결되지 않은 화면</h2><p>공통 탐색을 구현 중입니다. 이 화면의 실제 처리·저장·조회 기능은 아직 연결되지 않았습니다.</p></section>}
    </StatusView>
    {!loading && error?.status === 401 ? <AuthForm client={client} onAuthenticated={value => { setSession(readSession(value)); setError(null); }} /> : null}
  </AppShell>;
}
