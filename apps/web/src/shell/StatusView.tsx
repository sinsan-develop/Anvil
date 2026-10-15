import type { ReactNode } from 'react';
import { ApiError } from '../api/errors.ts';

export function StatusView({ error, loading, onRetry, children }: { error?: ApiError | null; loading?: boolean; onRetry?: () => void; children?: ReactNode }) {
  if (loading) return <section className="status-card" role="status" aria-live="polite">접근 상태를 확인하고 있습니다.</section>;
  if (error) return <section className="status-card status-error" role="alert">
    <h2>{error.status === 401 ? '로그인 확인 필요' : error.status === 403 ? '권한 확인 필요' : '조회하지 못했습니다'}</h2>
    <p>{error.message}</p>
    {error.requestId ? <p className="meta">확인 번호 {error.requestId}</p> : null}
    {onRetry ? <button onClick={onRetry}>접근 상태 다시 확인</button> : null}
  </section>;
  return <>{children}</>;
}
