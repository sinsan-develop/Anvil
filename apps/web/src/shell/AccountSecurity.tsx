import { useEffect, useState, type FormEvent } from 'react';
import { ApiClient, ApiError } from '../api/client.ts';
import {BrowserPushSupportPanel} from '../notifications/BrowserPushSupportPanel.tsx';
import {ProjectWaitingQueue} from '../features/settings/ProjectWaitingQueue.tsx';
import {SettingsSourceLinks} from '../features/settings/SettingsSourceLinks.ts';
import {ProjectPermissionPolicyView} from './ProjectPermissionPolicyView.tsx';

export function AccountSecurity({ client, csrfToken, onSession, onRevoked,projectId }: { client: ApiClient; csrfToken: string; onSession: (session: unknown) => void; onRevoked: () => void;projectId?:string|null }) {
  const [reauthPassword, setReauthPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const [rotateConsent, setRotateConsent] = useState(false);
  const [recovery, setRecovery] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  useEffect(() => {
    if (!reauthPassword && !currentPassword && !newPassword && (!recovery || saved)) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [reauthPassword, currentPassword, newPassword, recovery, saved]);
  async function run(operation: 'reauthenticate' | 'password' | 'recovery/rotate', event?: FormEvent) {
    event?.preventDefault();
    if (pending || (operation !== 'reauthenticate' && !ready)) return;
    setPending(true); setFailure(null);
    try {
      if (operation === 'reauthenticate') {
        const session = await client.postAuth<{ reauthUntil: string }>(operation, { password: reauthPassword }, csrfToken);
        if (!Number.isFinite(Date.parse(session.reauthUntil)) || Date.parse(session.reauthUntil) <= Date.now()) throw new ApiError('RESPONSE_INVALID');
        onSession(session); setReady(true);
      } else if (operation === 'password') {
        await client.postAuth(operation, { currentPassword, newPassword, commandId: crypto.randomUUID() }, csrfToken);
        onRevoked();
      } else {
        if (!rotateConsent || (recovery && !saved)) return;
        const result = await client.postAuth<{ recoverySecret: string | null }>(operation, { commandId: crypto.randomUUID() }, csrfToken);
        if (result.recoverySecret !== null && !/^[A-Za-z0-9_-]{43}$/.test(result.recoverySecret)) throw new ApiError('RESPONSE_INVALID');
        setRecovery(result.recoverySecret); setSaved(false); setShowRecovery(false); setRotateConsent(false);
      }
    } catch (cause: unknown) {
      const error = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID');
      setFailure(error);
      if (error.status === 412 || error.status === 401) setReady(false);
    } finally { setReauthPassword(''); setCurrentPassword(''); setNewPassword(''); setPending(false); }
  }
  return <><SettingsSourceLinks projectId={projectId??null}/><BrowserPushSupportPanel/>{projectId?<><ProjectPermissionPolicyView client={client} projectId={projectId} onAuthenticationLost={onRevoked}/><ProjectWaitingQueue key={projectId} client={client} projectId={projectId} onAuthenticationLost={onRevoked}/></>:null}<section className="status-card auth-form" aria-label="로그인 보안">
    <h2>로그인 보안</h2>
    <p>민감한 변경 전 비밀번호를 다시 확인합니다. 비밀번호 변경은 모든 로그인 세션을 회수합니다.</p>
    {failure ? <p role="alert">{failure.message}</p> : null}
    <form onSubmit={event => { void run('reauthenticate', event); }}>
      <label>재인증 비밀번호<input type="password" value={reauthPassword} onChange={event => setReauthPassword(event.target.value)} autoComplete="current-password" required /></label>
      <button disabled={pending}>재인증</button>
    </form>
    {ready ? <p role="status">재인증했습니다. 실제 변경 시 서버가 유효 기한과 권한을 다시 확인합니다.</p> : null}
    <form onSubmit={event => { void run('password', event); }}>
      <label>현재 비밀번호<input type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} autoComplete="current-password" required /></label>
      <label>새 비밀번호<input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} autoComplete="new-password" required minLength={15} /></label>
      <button disabled={pending || !ready || !!recovery && !saved}>비밀번호 변경</button>
    </form>
    <details><summary>일회 복구 비밀 재발급</summary>
      <p>기존 비밀은 즉시 회수됩니다. 새 비밀은 한 번만 표시되며 별도로 보관해야 합니다.</p>
      <label className="check-label"><input type="checkbox" checked={rotateConsent} onChange={event => setRotateConsent(event.target.checked)} />기존 복구 비밀 회수에 동의합니다</label>
      <button disabled={pending || !ready || !rotateConsent || !!recovery && !saved} onClick={() => { void run('recovery/rotate'); }}>새 복구 비밀 발급</button>
      {recovery ? <><label>새 일회 복구 비밀<input type={showRecovery ? 'text' : 'password'} value={recovery} readOnly autoComplete="off" /></label><button onClick={() => setShowRecovery(v => !v)}>{showRecovery ? '복구 비밀 숨기기' : '복구 비밀 보기'}</button><label className="check-label"><input type="checkbox" checked={saved} onChange={event => setSaved(event.target.checked)} />새 복구 비밀을 안전한 곳에 보관했습니다</label></> : null}
    </details>
  </section></>;
}
