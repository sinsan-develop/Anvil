import { useEffect, useState, type FormEvent } from 'react';
import { ApiClient, ApiError } from '../api/client.ts';

export function AuthForm({ client, onAuthenticated }: { client: ApiClient; onAuthenticated: (value: unknown) => void }) {
  const [setup, setSetup] = useState<boolean | null>(null);
  const [loginName, setLoginName] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bootstrap, setBootstrap] = useState('');
  const [recovery, setRecovery] = useState<string | null>(null);
  const [showRecovery, setShowRecovery] = useState(false);
  const [savedRecovery, setSavedRecovery] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState('');
  const [notice, setNotice] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [invitationId, setInvitationId] = useState('');
  const [invitationSecret, setInvitationSecret] = useState('');
  useEffect(() => {
    let current = true;
    client.get<{ setupRequired: boolean; policyVersion: number }>('/api/v1/auth/setup').then(value => {
      if (typeof value.setupRequired !== 'boolean') throw new ApiError('RESPONSE_INVALID');
      if (current) setSetup(value.setupRequired);
    }).catch((cause: unknown) => { if (current) setFailure(cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID')); });
    return () => { current = false; };
  }, [client]);
  useEffect(() => {
    if (!password && !bootstrap && !recoveryInput && !invitationSecret && (!recovery || savedRecovery)) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [password, bootstrap, recoveryInput, invitationSecret, recovery, savedRecovery]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending || setup === null) return;
    setPending(true); setFailure(null);
    try {
      if (accepting) {
        const result = await client.postAuth<{ user: { id: string }; recoverySecret: string | null }>('invitations/accept', { invitationId, invitationSecret, password, commandId: crypto.randomUUID() });
        if (!result.user?.id || result.recoverySecret !== null && !/^[A-Za-z0-9_-]{43}$/.test(result.recoverySecret)) throw new ApiError('RESPONSE_INVALID');
        setRecovery(result.recoverySecret); setRegistered(true);
      } else if (recovering) {
        await client.postAuth('recovery', { loginName, recoverySecret: recoveryInput, newPassword: password, commandId: crypto.randomUUID() });
        setRecovering(false); setNotice('비밀번호를 변경했습니다. 다시 로그인하세요.');
      } else if (setup) {
        const result = await client.postAuth<{ user: { id: string }; recoverySecret: string | null }>('setup/claim', { bootstrapSecret: bootstrap, loginName, displayName, password, commandId: crypto.randomUUID() });
        if (!result.user?.id || (result.recoverySecret !== null && !/^[A-Za-z0-9_-]{43}$/.test(result.recoverySecret))) throw new ApiError('RESPONSE_INVALID');
        setRecovery(result.recoverySecret); setRegistered(true);
      } else {
        onAuthenticated(await client.postAuth('login', { loginName, password, clientLabel: '웹 브라우저' }));
      }
    } catch (cause: unknown) {
      setFailure(cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'));
    } finally { setPassword(''); setBootstrap(''); setRecoveryInput(''); setInvitationSecret(''); setPending(false); }
  }
  if (registered) return <section className="status-card auth-form" aria-label="초기 등록 결과">
    <h2>{accepting ? '초대 수락이 처리됐습니다' : '초기 등록이 처리됐습니다'}</h2>
    <p>등록은 로그인이나 Agent 실행을 시작하지 않습니다. 복구 비밀은 Anvil 프로젝트 자료와 분리해 보관하세요.</p>
    {recovery ? <><label>복구 비밀<input type={showRecovery ? 'text' : 'password'} value={recovery} readOnly autoComplete="off" /></label><button type="button" onClick={() => setShowRecovery(v => !v)}>{showRecovery ? '비밀 숨기기' : '복구 비밀 보기'}</button><label className="check-label"><input type="checkbox" checked={savedRecovery} onChange={e => setSavedRecovery(e.target.checked)} />복구 비밀을 안전한 곳에 보관했습니다</label></> : <p>이 등록의 일회 복구 비밀은 다시 전달되지 않습니다. 로그인 후 재인증·재발급 절차로 확인해야 합니다.</p>}
    <button type="button" disabled={!!recovery && !savedRecovery} onClick={() => { setRecovery(null); setShowRecovery(false); setRegistered(false); setSetup(false); setAccepting(false); }}>로그인으로 이동</button>
  </section>;
  return <section className="status-card auth-form">
    <h2>{accepting ? 'Anvil 초대 수락' : recovering ? '비밀번호 복구' : setup ? 'Anvil 초기 소유자 등록' : 'Anvil 로그인'}</h2>
    {setup === null ? <p role="status">초기 등록 상태를 확인하고 있습니다.</p> : null}
    {failure ? <p role="alert">{failure.message}</p> : null}
    {notice ? <p role="status">{notice}</p> : null}
    <form onSubmit={submit}>
      {setup ? <label>초기 등록 비밀<input type="password" value={bootstrap} onChange={e => setBootstrap(e.target.value)} required autoComplete="off" /></label> : null}
      <label>사용자명<input name="username" value={loginName} onChange={e => setLoginName(e.target.value)} required autoComplete="username" autoCapitalize="none" spellCheck={false} /></label>
      {setup ? <label>표시 이름<input value={displayName} onChange={e => setDisplayName(e.target.value)} required maxLength={120} /></label> : null}
      {recovering ? <label>일회 복구 비밀<input type="password" value={recoveryInput} onChange={e => setRecoveryInput(e.target.value)} required autoComplete="off" /></label> : null}
      {accepting ? <><p>초대에서 안내받은 사용자명과 아래 비밀을 입력하세요. 프로젝트 참여·제어권은 계정 등록과 별개입니다.</p><label>초대 ID<input value={invitationId} onChange={e => setInvitationId(e.target.value)} required maxLength={36} autoComplete="off" /></label><label>초대 비밀<input type="password" value={invitationSecret} onChange={e => setInvitationSecret(e.target.value)} required autoComplete="off" /></label></> : null}
      <label>{recovering || accepting ? '새 비밀번호' : '비밀번호'}<input name="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete={setup || recovering || accepting ? 'new-password' : 'current-password'} /></label>
      {setup ? <p className="meta">비밀번호는15~128자입니다. 공백과 대소문자를 그대로 사용합니다.</p> : null}
      <button className="primary" disabled={pending || setup === null} type="submit">{pending ? '처리 확인 중' : accepting ? '초대 수락 후 계정 등록' : recovering ? '복구 후 비밀번호 변경' : setup ? '초기 소유자 등록' : '로그인'}</button>
    </form>
    {setup === false ? <><button disabled={pending} onClick={() => { setRecovering(accepting ? false : !recovering); setAccepting(false); setPassword(''); setRecoveryInput(''); setInvitationSecret(''); setFailure(null); setNotice(''); }}>{recovering || accepting ? '로그인으로 돌아가기' : '비밀번호 복구'}</button>{!recovering && !accepting ? <button disabled={pending} onClick={() => { setAccepting(true); setPassword(''); setFailure(null); setNotice(''); }}>초대 수락</button> : null}</> : null}
  </section>;
}
