# FN04/UI05·UI06 등록 산출물–고정 업무 추적 구현 지시서

- 작성: 2026-11-01, Main 어울. 기준 branch codex/av3-stage-b, 부모 64b09f3405253e6026030b6d7be440a620288853.
- 근거: 승인 WORK_PLAN FN04/UI05/UI06, INTERFACES의 ARTIFACT TraceRef·IMPLEMENTS 및 기존 결과 산출물 version1 원본 hash 계약. 독립 사전 대조는 기존 승인 기능의 미구현 분기라고 판정했다. 새 공개 필드·권한·자동 실행 권위는 추가하지 않는다.
- 현재 단계: 소스 구현·합성 검증. 실제 DB·권한·키·서비스·Agent 실행, 사용자/백업 파일 조사, 기존 프로젝트 차단 해제는 제외한다.

## 1. 완료할 사용자 흐름
UI05의 선택 결과에 이미 등록된 산출물 중 하나를 사용자가 선택한다. 같은 고정 임무의 초안/확정본에서 검산한 작업계획 업무를 보여 주고 사유 입력 후 명시 저장한다. 기존 linkTrace 명령/영수증으로 저장하고 UI06의 고정 설계 기준 정방향·역방향 조회에서 동일 edge/hash를 확인한다. 자동 저장·업무 완료/테스트 합격·실제 Agent 산출물 인증으로 해석하지 않는다.

## 2. 허용 제품 8경로와 시험 4경로
- apps/server/modules/traceability/traces.ts
- db/migrations/0064_trace_artifact_links.sql.pending (신규·미적용)
- apps/web/src/features/design-trace/trace-api.ts
- apps/web/src/features/design-trace/TraceViewer.tsx
- apps/web/src/features/session-detail/SessionDetailPage.tsx
- apps/web/src/App.tsx
- apps/web/src/features/session-detail/ArtifactTaskTracePanel.tsx (신규)
- apps/web/src/features/session-detail/artifact-task-trace-api.ts (신규)
- tests/unit/FN04/artifact-trace.test.ts (신규)
- tests/unit/FN04/artifact-trace-sql.test.ts (신규)
- tests/unit/UI05/artifact-task-trace-api.test.ts (신규)
- tests/browser/UI05/artifact-task-trace-dom-harness.tsx (신규)

위 밖 변경 필요 시 이유와 정확 경로를 Main에게 먼저 전달한다. 기존 보호 untracked3와 원0004 SQL 불변. package/lock·설정·공개 계약 변경0. Main은 문서만 작성하며 제품 writer는 기존 Primary 한 명이다. subagent commit/push0.

## 3. 서버·저장 기준
ARTIFACT 참조는 정확히 {kind:'ARTIFACT',id:artifactId,versionRef:{id:artifactId,version:1,contentHash:원본bytes의hash}}이며 localCode/anchor를 허용하지 않는다. 현재 프로젝트의 READY이며 격리되지 않은 등록 metadata의 id/hash/version을 대조한다. 기존 보호 reader의 같은 정책·상태 경계를 재사용한다. 파일 bytes 읽기와 metadata 검증을 혼동하지 않는다. 실제 파일 재검증이나 결과·실행 계보를 서버가 증명한다고 표시하지 않는다.

추가 조합은 ARTIFACT→PLAN_TASK / IMPLEMENTS 한 개뿐이다. 역방향 쓰기·다른 relation과 대상, REQUIREMENT/EXECUTION/TEST_EVIDENCE는 계속 거절한다. 업무는 같은 고정 계획의 고유 taskCode·정확 plan hash·STORED 투영이며 기존 designRef로 연결한다. 현재 membership/명령/정책/제어 세대·기한·감사·중복·영수증/transaction 경계를 보존한다. read의 기존 edge hash/양끝 재검산·cursor 결박·양방향 traversal을 보존한다. 누락 실행/시험 evidence와 미연결 표시를 지우지 않는다.

새0064는 원0004를 수정하지 않는 forward 미적용 SQL이다. from_kind만 ARTIFACT를 추가하고 to_kind 기존4종 유지. ARTIFACT면 PLAN_TASK/IMPLEMENTS/version1/from_code 빈 문자열과 정확 ref·anchor/localCode 부재를 제한한다. 기존 행/트리거/권한 검사 유지. 예상 원 constraint를 명시한 원자 ALTER를 사용하고 IF EXISTS로 schema 불일치를 숨기지 않는다. artifacts에 UPDATE 권한이 없으므로 FOR SHARE/UPDATE나 GRANT를 추가하지 않는다. metadata 불변·현재 보호 경계를 사용하고 동시성/실제 PG 미검증을 명시한다.

## 4. 화면·원명령 보존
SessionDetailPage의 같은 선택 결과 manifest.artifactRefs와 고정 draft/confirmed를 사용한다. 기존 assignment-plan-original 검산으로 draft/확정 정의·plan/designRef·taskCardHash를 확인한다. 수동 ID·새 GET·원문 전수조사0. 기존 다운로드는 재작성하지 않으며 bytes 검산과 trace metadata 표시를 구분한다.

사용자 선택·사유·현재 제어가 유효할 때만 명시 POST한다. App 소유 메모리 buffer로 원명령/정확 payload를 route 이탈·복귀에도 보존한다. actor/project/fixed assignment/result 경계가 다르면 감춘다. client/제어 세대를 재작성하지 않는다. UNKNOWN은 원명령을 유지하고 같은 명령의 명시 결과 확인만 허용하며 자동 재시도/새명령 전송0. 변경된 입력/고정 자료/late 응답/권한 소실·늦은 실패가 다른 버퍼나 현재 화면을 오염하지 않게 한다. 미연결 REQUIRE_APPROVAL 경계를 새 승인 흐름으로 우회하지 않는다. 정/역 조회에 등록 산출물 참조와 고정 업무를 구별하고 안전한 일반 제목을 사용한다. 파일명·내용·Secret metadata 노출0. 완료·실제 실행 인증으로 승격0.

## 5. TDD·검수 순서
1. TEST_ONLY: 신규 서버 시험으로 기존 READY artifact 정상 경로의 TRACE_SOURCE_NOT_READY/412 RED를 실제 확인한다. 모듈 부재 실패만으로 대체하지 않는다. Main fresh 확인 전 제품 변경0.
2. Main PRODUCT_GO 후 서버/미적용 SQL과 기존 link/read 양방향, 정상·교차 프로젝트/비회원/격리/없음/오hash/version/id/anchor/code/관계 음성 및 원 kind 회귀를 구현한다.
3. UI/helper: 고정 결과↔임무/plan/task 불일치, 선택·사유, 명시1회 POST, UNKNOWN 원명령 보존·동일 명령 확인, 다른 actor/project·late 응답·권한 소실·route 복귀를 합성 검증한다. React harness로 실제 component 이벤트 검수 경로를 마련한다.
4. 필요한 인접 FN04/UI05 시험·typecheck·Web in-memory build·diff를 선택해 실행한다. 기존 합격 기준을 낮추지 않는다. 파일/환경 불변 시험의 불필요한 전수 반복0.
5. Main과 독립 reviewer가 실제 diff/시험/원문 계약을 대조하고 Critical/Important0을 확인한다. Main만 문서·검증된 exact 변경을 commit/private push한다. 필수 실제 gate 미충족에서 merge/전체 완료 주장0.

별도 브라우저 QA 자원은 생성 전 Main이 이름·소유·수명·정리 방법을 기록한다. 현재 지시는 source harness와 합성 시험만 허용하며 listener/실제 API/서비스 시작0. 실제 DB·WSL·서버 수락·운영/전체 업무 인수는 NOT_RUN이다.

## 6. 제출
COMPLETED/INCOMPLETE/FAILURE_REPORT 구분, 시작 HEAD/상태·변경 경로/hash·명령/exit·RED→GREEN·회귀·오류 횟수·미검증·잔여 위험·rollback을 보고한다. 결과 hash 기준은 원bytes이며 metadata hash로 바꾸지 않는다. UI/서버/미적용 SQL의 소스 연결 완료와 실제 사용 가능 상태를 구분한다.
