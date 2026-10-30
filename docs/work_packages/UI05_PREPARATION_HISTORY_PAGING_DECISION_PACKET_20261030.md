# UI05 과거 실행 준비 기록 탐색 — 계약 결정안 r2

상태: DRAFT / NOT_ADOPTED / 코드 GO 없음. 기준 83c7df1953d231c57a20aa4169914caebaf4ff04. 작성 Main 어울, 기능 누락 읽기 대조 기존 Primary. 새 기능 범위 추가가 아니라 승인된 UI05의 기록·버전·원문 접근에서 21번째 이후 기록을 발견하지 못하는 공백을 완성할 상세 GET 계약 후보다.

## 필요한 결정
- **A 권장:** 기존 집계 API·소비자를 보존하고 준비 이력 전용 보호 페이지 GET과 UI05 과거 기록 탐색/정확 선택을 source-only로 구현한다. 새 DB 표·권한·Agent 실행은 필요 없다.
- **B:** 현재 최근20건만 발견 가능한 제한을 유지하고 이 필수 기능을 미완료로 남긴다. 알려진 ID의 고정 GET이 있다는 이유로 전체 이력 탐색 완료라 하지 않는다.

기존 승인된 작업계획의 구현은 재승인하지 않는다. 다만 A에는 현재 없는 공개 GET 요청/응답 계약이 추가되므로 채택이 필요하다. 기존 집계 route의 엄격한 빈 query에 몰래 cursor를 넣거나 반환키를 바꾸지 않는다. 기존 FN06 HUMAN R2 질문과 합치거나 반복하지 않는다.

## 현재 사실·정확 영향
- apps/web/src/features/session-detail/SessionDetailPage.tsx:130~134는 수신된 preparations만 표시하고 hasMorePreparations면 이전 이력 미연결 안내를 한다. 목록 장식이 아니라 이전 기록을 발견·선택하는 기능의 부재다.
- apps/web/src/features/session-detail/api.ts 및 apps/web/src/features/workspace/responsible-session-api.ts:38~41은 엄격한 집계 반환키와 preparations 최대20개/hasMore boolean만 소비한다. cursor가 없다.
- apps/server/modules/executions/project-execution-state.ts:26~29는 project/assignment id·version 제한, created_at DESC,id DESC LIMIT21→앞20만 반환한다.
- apps/server/modules/projects/routes.ts:208의 기존 집계 GET query는 object({})다. 같은파일207의 준비 버전 GET은 이미 아는 ID만 읽으며 오래된 ID를 찾는 목록이 아니다.
- 기존집계: GET /api/v1/projects/:projectId/assignments/:id/versions/:version/execution-preparation-state
- 기존원문: GET /api/v1/projects/:projectId/execution-preparations/:id/versions/:version
- Main85ab86/f6464a와 Primary 한정 읽기에서 대조했다. 실제 DB 관측은 수행하지 않았다.

## A안 상세 계약
1. **새 GET만 추가:** /api/v1/projects/:projectId/assignments/:id/versions/:version/execution-preparations. query는 optional cursor 한 키만 허용한다. 한 페이지20건 고정, 필터/limit/임의ref 입력·새 쓰기 연산은 없다. 잘못된 params/query/cursor는 거절하며 기존 route와 응답은 그대로 둔다.
2. **권한·임무 범위:** 기존 authenticated transaction→projectMember→확정 assignments.read를 재사용하고 같은 project/id/version의 contentConfirmed·executionAuthorized=false·dispatchPerformed=false를 검산한다. 기존 고정 준비 read와 같은 조회 권한만 사용한다. OWNER만으로 임의 축소하거나 조회권을 새로 부여하지 않는다. 원문은 기존 ProjectExecutionPreparations.read를 그대로 소비한다.
3. **서명 cursor:** 기존 ProjectListCodec을 전용 namespace로 사용한다. actorId·projectId·assignmentRef 전체·정렬(created_at DESC,id DESC)·페이지20·전용query/namespace를 결박하고 기존30분 만료를 유지한다. 다른 actor/project/임무/버전/hash/namespace·변조·만료 cursor는 거절한다. 새 Secret·서명 키 생성0, 기존 서명 도구 의존성을 명시주입한다.
4. **정렬·경계:** DB timestamp의 마이크로초 원문과 UUID tuple로 keyset 비교한다. 기존 projects/repository.ts의 to_char(...US...) 패턴을 참고하고 JS Date.toISOString으로 정렬 위치를 절삭하지 않는다. 21개를 조회해20개만 표시하고 마지막 표시행 위치로 nextCursor를 만든다. 정적 불변 행집합에서 마이크로초·UUID tuple 정렬 경계를 보존한다. 이 cursor는 snapshot/as-of 상한이 아니므로 동시 추가나 지연 COMMIT을 포함한 전체 순회의 완전성은 보장하지 않는다. 이미 지난 정렬 구간에 늦게 추가된 기록은 첫 페이지 새로고침부터 재탐색할 수 있으며, 더 과거 구간의 새 행은 다음 페이지에 포함될 수 있다. 동시성 snapshot 기능을 새로 만들거나 실제 SQL 경합 검증을 수행하지 않는다.
5. **응답 고정:** {projectId,assignmentRef,items,nextCursor,currentness:'NOT_RECHECKED',executionAuthorized:false,dispatchPerformed:false}. items는 최대20개이며 각각 {ref,mode,checkedAt,missingConditions}만 담는다. mode/시각/미확인코드는 기존 준비 snapshot 검산 후 투영하고 자유 reason·전체 intent·Secret/Agent handle은 목록에 복제하지 않는다. 동일 project/임무 fullref·ref/hash를 기존 준비 원문 reader로 검사하며 하나라도 손상되면 페이지 전체를 실패시킨다. 조용히 건너뛰거나 준비 완료로 표시하지 않는다. 직렬화 응답2MiB 이하·결과가 크면 잘라내지 않고 거절한다.
6. **정확 원문 선택:** 서버 목록 ref만 선택해 기존 고정 GET으로 다시 읽고 project/fullref/hash/intent.assignmentRef 전체를 비교한다. UI는 mode·시간·missing과 고정 원문을 표시하지만 현재 실행·권한·능력/예산·OS 소유 상태로 승격하지 않는다. 임의 UUID 붙여넣기 폼·새 준비 생성·Agent 호출0.
7. **UI05 흐름:** 기존집계 요약/현재 작업을 보존하고 '전체 준비 이력'을 명시적으로 열어 보호 페이지를 조회한다. 다음(더과거)/이전·실패 재시도·첫페이지 새로고침·정확 기록 선택을 제공한다. 성공한 페이지 위치/선택을 보존하고 실패한 요청을 성공 이력에 넣지 않는다. 프로젝트/확정임무/user/client/관측된세대 변경·ABA·late/권한실패에서는 이전본문을 즉시 숨긴다. 원래 미확인 작업/승인 buffer를 초기화하거나 자동 쓰기하지 않는다.

## 필수 검증·미실행 구분
- 기존최근집계 API의 params/query/응답 불변·고정원문GET 재사용, 21번째 이후 실제 발견→선택/원문 검산의 합성 정상 흐름을 먼저 RED로 재현한다.
- cursor scope/서명/만료·같은시각 다른UUID·마이크로초 경계·마지막행/빈페이지·중복/순서/다른임무/손상ref·응답크기와 권한 실패를 source fakeDB/실class/ApiClient에서 확인한다.
- 실제 UI05 DOM의 과거/이전/재시도·성공 위치 보존·선택/닫기·sameclient ABA·지연응답/검산·403 숨김·미확인 명령 보존·자동 POST0을 검사한다. 기존 UI01을 다시 구현하거나 공통화하지 않는다.
- 영향범위 build/type/diff·직접 인접 회귀·독립 C/I·Main fresh·QA 회수/부재 후 기존 개발 branch private 게시. 실제DB/HTTP API/served·RLS/경합·사용자인수는 NOT_RUN으로 구분한다.

## 제외·가역성·작업 순서
실제 DB 접속/DDL·migration/GRANT·정책/계정/Secret/키/인증서·서비스·Agent/Job·비용·실행 허가·Oracle/운영 변경은 제외한다. 기존 실패·보호8·main/다른 branch를 변경하지 않는다. 신규 table/SQL 파일도 필요 없다. 코드/상세 계약은 한정 Git revert로 복구 가능하며 실제 데이터 변경이 없어 runtime rollback은 없다.

채택 후 Main은 실제 시작 HEAD/정확 파일 allowlist·WI·QA 이름/owner/수명/정리를 고정한다. 기존 단일 Primary 구현·기존 Reviewer 검수, Main 통합을 유지한다. 채택 전에는 제품 코드·검증 실행을 시작하지 않는다. 전체 FN09/UI05/계획의 실제 기능 완료를 이 source 후보로 대체하지 않는다.

## r2 검토 정정
- r1 SHA6A102F32 사전 C0/I1의 keyset 동시 완전성 과도 보장 문구를 정적 행집합 경계로 정확화했다. 동시 추가·지연 COMMIT의 snapshot/전체 순회 완전성은 미보장이고 새로고침 재탐색으로 구분한다. 기능/권한/자료 범위 확대·새snapshot 구현0·코드GO0.
