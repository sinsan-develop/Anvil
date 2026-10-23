import {ApiClient} from '../../api/client.ts';
import {routeHref} from '../../shell/routes.ts';
import {ProjectAccessSummary} from '../projects/ProjectAccessSummary.tsx';
/** 기존 프로젝트 GET의 사용자 선택 조회만 연결한다. 제어권 전환 연산은 없다. */
export function ControlAccessPage({client,projectId,onAuthenticationLost}:{client:ApiClient;projectId:string;onAuthenticationLost:()=>void}){
 return <section aria-label="작업 권한 인계"><h2>작업 권한 인계</h2>
  <p>인수 요청·안전 요약·다음 담당자 수락·권한 전환은 미구현입니다. 현재는 기존 프로젝트의 참여·제어 기록만 명시 조회합니다.</p>
  <p role="status">조회는 인수 요청·수락·새 권한 발급이 아닙니다. 현재 제어 기록이나 미확인 상태를 다른 사람·기기로 자동 전환하지 않습니다.</p>
  <ProjectAccessSummary key={projectId} client={client} projectId={projectId} name="선택 프로젝트" disabled={false} onAuthenticationLost={onAuthenticationLost}/>
  <a href={routeHref('workspace',projectId)}>프로젝트 작업으로 돌아가기</a>
 </section>;
}
