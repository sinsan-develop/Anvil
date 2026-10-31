# UI10 관련 고정 원문 보기 — 미검증 경계 보완

2026-10-31 / Main 어울 / 기존 Primary 단일 writer / TEST_ONLY

## 기준과 목적

신산님 최신 직접지시는 승인된 구현·검수에 필요한 제품 소스·시험 읽기를 허용하며 실제 사용자 자료·백업 대상 조사, DB·권한·키·서비스·Agent 실행은 제외한다. 기존 승인된 UI10/FN05 조회 흐름과 WORK_STATUS의 2026-10-25 관련 원문 checkpoint에서 남긴 두 경계만 검증한다. 새 API·저장·권한 계약은 만들지 않는다.

기준 branch `codex/av3-stage-b`, HEAD `7651527446cd107790810154687ff9412a360206`. 완료된 수동정책 83개와 다른 기능의 전수검사는 반복하지 않는다. 기존 reviewer의 읽기 검토에서 두 미검증 경계가 남아 있음을 확인했다. 기능 오류는 아직 확정되지 않았다.

## 허용 변경

- 신규 `tests/unit/UI10/knowledge-scope-original-boundary.test.ts` 한 파일만 작성한다. 시작 시 부재를 재확인한다.
- 기존 제품·시험·설정·의존성·SQL은 변경하지 않는다. 실제 사용 흐름의 행동 실패가 나오면 원인을 보고하고 별도 Main 제품 GO 전 수정하지 않는다.
- 실제 `KnowledgePage`, `KnowledgeScopeOriginals`, reader, `ApiClient` 및 decoder를 실행한다. 현재 Page는 inspect 시작에 view를 비우고 project/user/client/fullref key로 자식을 교체한다. 이를 모사 부모로 대체하거나 무key 단독 ABA를 실제 제품 오류로 간주하지 않는다.
- 기존 UI14 시험의 MemoryNode·ReactDOM·Vite 메모리 번들 패턴만 재사용한다. 공통 도구 추출·패키지 추가·실서비스·브라우저·파일 산출물은 만들지 않는다. 합성 transport와 메모리 원문만 쓴다.

## 필수 행동 증거

1. 실제 부모에서 A의 원문 최종 응답을 기다리다 B의 다른 fullref를 명시 선택한다. 늦은 A 성공을 풀어도 A 원문이 보이지 않고 B 선택·본문·부모 편집 buffer가 유지된다. B의 새 명시 원문 조회는 정상이어야 한다. 가능하면 A로 돌아오는 순서도 포함하되 새 명시 조회 전 과거 응답은 채택하지 않는다.
2. 같은 실제 부모 이탈 뒤 늦은 A의 401은 B 화면에 오류를 만들거나 인증상실 callback을 호출하지 않는다. 각 응답과 화면 전환이 실제 도달했는지 확인한다.
3. STAGE의 마지막 methodology 응답 `json()` 반환을 기다리다 실제 닫기 버튼을 누른다. 반환과 실제 hash 검산을 끝내도 원문·오류·진행 표시가 되살아나지 않고 자동 재조회가 없다. 명시 재조회로 정상 회복해야 한다.
4. STAGE snapshot의 실제 native digest가 완료된 뒤 반환만 보류하고 닫는다. 원 native 결과를 그대로 반환한 후에도 비노출이며 다음 명시 조회는 정상이다. 입력을 식별해 정확 목표 digest만 보류하고 다른 hash 검산을 성공 대역으로 바꾸지 않는다.

모든 경우 GET만 허용하고 예상 밖 호출·POST·부모 변경 callback은 0으로 단언한다. gate 도달·해제·JSON/native hash 완료를 관측하며 시간 경과만으로 폐기를 주장하지 않는다. 모든 gate는 finally에서 풀고 root unmount·전역/native 함수 복구·소유 MessageChannel 양 port 회수를 보장한다. unhandled rejection·무한 pending·열린 handle을 남기지 않는다.

## 검수와 반환

- 새 파일의 선택된 행동검사만 먼저 실행한다. 실패는 제품 행동 실패와 하네스/fixture 준비 오류를 분리한다. 기존 동작이 처음부터 통과하면 신규 검증 증거이며 RED→GREEN 수정이라고 주장하지 않는다.
- 기존 FN05 reader 단위 5개는 직접 인접 범위로만 최종 묶음에서 확인한다. 변경된 새 파일의 typecheck와 diff를 수행한다. 제품이 불변이면 별도 전체 build·기존 완료검사를 반복하지 않는다.
- 수행자는 실제 명령·exit·개수·최종 hash·변경 파일·오류/미실행·handle/QA 상태와 writer 반환을 보고한다. Main이 동일 최종 바이트를 독립 검수하고 필요한 최종 묶음만 실행한다.
- 메모리 DOM은 실제 브라우저 레이아웃·보안·served·DB/사용자 인수가 아니다. 두 경계의 메모리 행동검증만 완료 처리하며 전체 UI10/FN05/Stage/작업계획은 별도로 남긴다. rollback은 이 시험 및 소유 문서의 정상 revert다.
