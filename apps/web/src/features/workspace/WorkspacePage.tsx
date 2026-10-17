import { useEffect, useState } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { routeHref } from '../../shell/routes.ts';
import { readWorkspaceProject, type WorkspaceProject } from './api.ts';
import { WorkspaceDocuments } from './WorkspaceDocuments.tsx';

export function WorkspacePage({ client, projectId, onAuthenticationLost }: { client: ApiClient; projectId: string; onAuthenticationLost: () => void }) {
  const [project, setProject] = useState<WorkspaceProject | null>(null), [error, setError] = useState<ApiError | null>(null);
  const [pending, setPending] = useState(true), [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true; setPending(true); setError(null); setProject(null);
    readWorkspaceProject(client, projectId).then(value => { if (current) setProject(value); }).catch((cause: unknown) => {
      if (!current) return; const failure = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setError(failure);
      if (failure.status === 401) onAuthenticationLost();
    }).finally(() => { if (current) setPending(false); });
    return () => { current = false; };
  }, [client, projectId, revision]);
  return <section aria-label="프로젝트 작업" lang="ko">
    <div className="project-toolbar"><button disabled={pending} onClick={() => setRevision(value => value + 1)}>프로젝트 원본 새로고침</button></div>
    {pending ? <p role="status">프로젝트 원본 조회 중</p> : null}{error ? <p role="alert">{error.message} 프로젝트 원본은 현재 미확인입니다.</p> : null}
    {project && !pending && !error ? <>
      <header><h2>{project.name}</h2><p>{project.purpose}</p><p className="meta">원본 버전 {project.version} · 원본 변경 <time dateTime={project.updatedAt}>{new Date(project.updatedAt).toLocaleString('ko-KR')}</time> · 아래 내용은 프로젝트 조회 결과이며 실행 상태가 아닙니다.</p></header>
      <div className="project-workspace">
        <section className="status-card" aria-label="개발 절차"><h3>개발 절차</h3>
          {project.currentMethodologyRef ? <><p>고정 적용 참조 · 세대 {project.currentMethodologyRef.version}</p><p className="meta">{project.currentMethodologyRef.id}<br />{project.currentMethodologyRef.contentHash}</p></> : <p>확인된 방법론 적용본 없음</p>}
          <a href={routeHref('methodologies', projectId)}>방법론 원본·검토 열기</a><p className="meta">단계별 절차·실행 순서와 책임 세션은 이 화면에 아직 연결되지 않았습니다.</p>
        </section>
        <section className="status-card" aria-label="총괄 작업"><h3>총괄 작업</h3><h4>원하는 결과</h4><p>{project.desiredOutcome}</p>
          <p>총괄·단계책임자 세션과 지시 전달은 미연결입니다.</p><p className="meta">이 화면을 열거나 자료를 조회해도 Agent를 호출하거나 작업을 시작하지 않습니다.</p>
          <button disabled>지시 전송 · 미연결</button>
          <h4>준비 상태</h4>{project.readinessIssues.length ? <ul>{project.readinessIssues.map((item, index) => <li key={index}>{issueLabel(item.code)}</li>)}</ul> : <p>프로젝트 조회에서 보고된 준비 부족 없음 · 실행 준비 완료 판정은 아닙니다.</p>}
          <p className="meta">원본 참여: {project.participation === 'OWNER' ? '소유자' : project.participation === 'VIEWER' ? '조회자' : '인계 가능 참여자'} · 원본 편집 제어: {project.controlState.status === 'HELD' ? '현재 사용자·기기' : project.controlState.status === 'OTHER_CLIENT' ? '다른 사용자·기기' : '미할당/회수됨'} · 실행 권한은 별도이며 이 화면에서는 지시할 수 없습니다.</p>
        </section>
        <section className="status-card" aria-label="프로젝트 자료"><h3>프로젝트 자료</h3><ul>
          <li><a href={routeHref('documents', projectId)}>문서·설계·작업계획 열기</a></li><li><a href={routeHref('knowledge', projectId)}>헌법·지식·결정 이유 열기</a></li>
          <li><a href={routeHref('approvals', projectId)}>승인 요청·결정 열기</a></li><li><a href={routeHref('connections', projectId)}>도구·환경·소스 선언 열기</a></li>
        </ul>
          {project.sourceMode === 'EXISTING' ? project.sourceDeclaration ? <details aria-label="기존 소스 사용자 선언 · 실제 관측 미확인">
            <summary>기존 소스 사용자 선언 · 실제 관측 미확인</summary>
            <p>{project.sourceDeclaration.declaration.displayName} · {project.sourceDeclaration.declaration.hostLabel}</p>
            <pre>{project.sourceDeclaration.declaration.pathHint}</pre><p>{project.sourceDeclaration.declaration.reason}</p>
            <p className="meta">선언 버전 {project.sourceDeclaration.ref.version} · {project.sourceDeclaration.ref.id}<br />{project.sourceDeclaration.ref.contentHash}</p>
            <p className="meta">사용자가 저장한 위치 설명이며 파일 접근·검증·실행 권한이 아닙니다.</p>
          </details> : <p>기존 소스 사용자 선언 있음 · 원문은 소유자에게만 표시됩니다.</p> : <p className="meta">빈 프로젝트로 생성됨 · 기존 소스 선언 없음</p>}
          <WorkspaceDocuments key={projectId} client={client} projectId={projectId} onAuthenticationLost={onAuthenticationLost} />
          <p className="meta">상세 작성·검토는 자료 화면에서 진행합니다. 실제 실행·코드 변경·테스트 결과는 아직 연결되지 않았습니다.</p></section>
      </div>
    </> : null}
  </section>;
}
function issueLabel(code: string) { return ({ SOURCE_DECLARATION_UNVERIFIED: '기존 소스 선언: 실제 관측 미확인', METHODOLOGY_CONNECTION_PENDING: '방법론 적용 연결 필요', PERMISSION_POLICY_UNCONFIGURED: '명시 권한 정책 미설정' } as Record<string, string>)[code] ?? '그 밖의 준비 항목 미확인'; }
