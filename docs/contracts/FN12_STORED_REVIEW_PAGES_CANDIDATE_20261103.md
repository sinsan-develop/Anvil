# FN12 보관 검수 과거 페이지 조회 — 한정 결정 후보
2026-11-03 · 작성 Main 어울 · NOT_ADOPTED / SOURCE_GO0 / EXECUTION_GO0
기준 branch codex/av3-stage-b / 19c61093acceb52c9c5ee1d223e5847645f4c33e.
설계 UI05의 검수 이력·FN12 결과 검수 조회를 위한 상세 계약이다. 기존 작업계획 전체 재승인을 요구하지 않는다.

## 실제 미완료와 선택
현재 GET /api/v1/projects/:projectId/results/:id/reviews 는 쿼리를 받지 않고 최근20+hasMore만 반환한다. Web reader는 정확6키를 검사하고 UI에 이전 목록 미연결을 표시한다. 기존 원문 직접 GET·검수기준·REWORK/BLOCKED/보완 저장은 구현돼 있으므로 재개발하지 않는다.
- A 권장: 아래 별도 read-only page GET과 기존 UI의 명시 페이지 이동만 추가한다. 기존 GET/DTO/원문 조회를 보존한다.
- B: 최근20 제한을 유지한다. 변경은 없지만 전체 과거 목록 탐색은 계속 미구현으로 남는다.
고정된 당시 전체 목록을 재현하는 지속 snapshot/새 원장 안은 이번 후보에서 제외한다. 실제 Agent/증거 인증·완료 판정·보완 실행을 확대하지 않는다.

## A 공개 계약
- 신규 GET /api/v1/projects/:projectId/results/:id/review-pages.
- 최초 query {} 또는 후속 {cursor}만. 추가 키·중복키·빈 값·배열/잘못된 encoding 거절. cursor UTF8/문자 모두4096 이하. limit 입력 없음.
- 고정 pageSize20. DB result_reviews 후보 최대21개, project/result 동일 조건, created_at,id DESC의 엄격 keyset. 원 회원·원제출과 기존 exact 검수 reader의 command/receipt/audit/ref/hash·원자료 검산을 재사용한다. 합성 source 출처를 인증 증거로 바꾸지 않는다.
- 기존 GET /results/:id/reviews와 /result-reviews/:id의 no-query·DTO·권한·상태 의미는 불변이다. 새 API의 오류를 구 API 성공으로 몰래 대체하지 않는다.
- 신규 응답 정확9키:
  {projectId,resultRef,items,hasMore,nextCursor,selectionState,observedAt,pageSize,window}
  pageSize=20, selectionState=NOT_SELECTED.
  items는 기존 StoredReviewSummary 정확 원형, 최대20/중복없음/내림차순. hasMore면20개와 nextCursor 비어있지 않은 문자열, 아니면 nextCursor=null.
  window 정확 {startedAt,expiresAt}; 모든 시각은 UTC ISO 밀리초 표준 원형. observedAt는 이번 최종 관측 시각, startedAt는 최초 관측 상한이다.
  flags completionAccepted/formalFailureCounted/evidenceProvenanceVerified/executionAuthorized/dispatchPerformed는 계속false, reviewStored만true. 목록에 reason/snapshot/파일 bytes/실행 증거를 추가하지 않는다.
- 응답 UTF8 JSON 총64KiB 이하. 기존 summary 고정필드20개·최대4096 cursor와 고정 외피를 실제 codec 최대값으로 산출/검산한다. 초과를 자르거나 빈 성공으로 바꾸지 않는다.

## cursor와 접근
- 새 키 생성/조회·보호 저장을 하지 않는다. 기존 AccessRepository.signProjectCursor의 서버 전용 서명 기능을 목적 구분한 canonical/base64url cursor에 사용한다. 기존 ProjectListCodec의 단순 actor/filter 모양을 그대로 허가로 재사용하지 않는다.
- 내부 서명 원형에는 schema/purpose=FN12_REVIEW_PAGES, 사용자/client·인증 session/credential 세대·project·exact resultRef·고정20의 결박 digest, 최초 startedAt/상한·원 expiresAt·마지막 created_at/id tuple을 포함한다. 내부 session ID/키/토큰을 응답 필드나 가독 payload로 내보내지 않는다. 결박 digest는 서버 서명으로 파생하며 사용자 입력을 신뢰하지 않는다.
- 최초 expiresAt=min(startedAt+30분, 당시 session idle/absolute expiry). 후속 페이지·이전·재시도에서 원 기한을 연장하지 않는다. 현재 session의 현재 기한도 매번 별도 검사한다. 기존 codec의30분과 요청 처리 예산30초는 다른 값이다.
- 서명·canonical 원형·정확 키·길이·tuple·한도·주체/project/result 및 기한을 검산한다. cursor를 회원/권한·정책·현재 제어권의 증거로 쓰지 않는다. 현재 로그인과 회원 접근은 매 요청과 반환 직전에 재검산한다. 기존 조회에 없는 OWNER/현재 제어/쓰기 정책을 추가 요구하지 않는다.
- 잘못된/다른 범위 cursor400, 만료410, 인증/회원 거절은 원401/404, 원장/DB 무결성 오류는 원503으로 구분한다. 오류를 빈 목록/합격으로 숨기지 않는다. Cache-Control:no-store.
- GET의 인증·pool 취득/BEGIN/세션 조회·인증 Tx rollback/release 소유는 기존 repository가 유지하며 이번8경로에서 변경하지 않는다. 처리 예산30초는 인증 callback 안의 page 메서드 첫 진입부터 시작하는 페이지 소유 처리 예산이다. 페이지 소유 await 전후에 단조시각/DB시각·현재 session 원기한을 재검산하고 만료/취소 뒤 새 페이지 query를 시작하지 않는다. page 진입 전 pool.connect가 늦게 정착한 경우 기존 인증 query까지 차단한다고 주장하지 않는다. 요청 취소는 page 첫 진입에서 다시 검사한다. pending query 취소 요청을 정착으로 간주하거나 Promise.race만으로 DB를 회수 완료 처리하지 않는다. 기존 인증 소유자의 필요한 rollback/release는 금지할 새 페이지 query에 포함하지 않는다. 이미 진행 중인 query의 원 정착/rollback/release 전까지 응답 완료/정리0을 주장하지 않으며 인증 진입부터의 전체30초 hard SLA도 아니다.

## 목록 가시성의 한계
첫 관측시각과 이전 tuple은 새로운 상단 append 및 순방향 중복을 제한한다. 처음 관측시각 이하의 과거 transaction_timestamp를 가진 지연 Tx가 나중 commit되면 이후 페이지에 들어오거나 이미 지난 위치에서 누락될 수 있다.
이 API는 요청 때 현재 보이는 불변행 목록이며 완전 고정 DB snapshot/당시 전체 membership 재현을 보장하지 않는다. 신규·지연 저장을 다시 찾으려면 사용자가 '처음부터 새 조회'를 실행한다. 조회 시각/기한/이 한계를 UI에서 확인 가능하게 한다. 새 원장·지속 자료를 만들지 않는다.

## 화면과 상태 보존
- 기존 UI05 보관 검수 목록을 새 page API로 연결하고 이전/다음/처음부터 새 조회 및 실패 위치 재조회는 사용자 명시 행동으로만 한다. 자동 모든 페이지 순회·추가POST·원문 선택/판정 적용0.
- 이동/오류/재조회 때 이전 상세는 숨긴다. 성공한 페이지 위치는 응답 전체 검산 후에만 확정하고 실패 target과 성공 위치를 구분한다. 동일 cursor 명시 재조회가 원문 추가 저장을 만들지 않는다.
- 이전 위치는 현재 조회창 안에서 최대100개의 cursor만 메모리에 보관한다. 넘친 오래된 이전 위치는 안내 후 버리고 순방향 조회는 계속 가능하다. 과거 위치 재발견은 새 조회를 사용하며 지속 browser storage는 추가하지 않는다.
- client/transport·로그인 사용자/client/session/credential·project/result fullref·조회창이 바뀌는 경우 및 A→B→A에서 늦은 응답/JSON/오류/finally가 새 화면을 덮지 않도록 단조 request fence를 둔다. 명령 buffer·UNKNOWN 원명령은 삭제하지 않는다.
- 빈 page는 items[]/hasMorefalse/nextCursornull인 현재 조회 결과일 뿐 전체 검수/문제가 없다는 판정이 아니다. 원문은 기존 정확ref GET과 기존 검증기로 별도 선택/조회한다.
- 실제 Agent/완료 인증·정식 실패집계/새 검수 저장/자동 보완 배정·권한 부여0.

## 구현 후보 경로 — 승인 전 쓰기0
기존7:
apps/server/modules/results/project-result-reviews.ts
apps/server/modules/projects/routes.ts
apps/web/src/features/session-detail/stored-result-reviews-api.ts
apps/web/src/features/session-detail/ResultReviewSources.tsx
tests/unit/FN12/project-result-reviews.test.ts
tests/unit/FN12/result-routes.test.ts
tests/unit/UI05/stored-result-reviews-api.test.ts
신규 시험1: tests/unit/UI05/stored-result-reviews-pagination.test.ts (0d1b6c 부재 확인).
source 코드·화면·합성 검증만 대상이다. 새 SQL/DDL/migration·실제 DB 접속·권한/정책/회원·키·파일 조사·서비스·Agent/OS/네트워크 실행은 제외한다. 일반 SELECT 코드도 실제 SQL 실행과 구분한다.
승인 후 WI에서 실제 시작 지문·허용8을 다시 고정하며 기존 단일 Primary만 writer, Main은 관리·독립검수·통합을 맡는다.

## 검수
기존 GET/DTO no-query/권한·false flags 보존. 21개 이상 페이지·같은 시각/id 동률·append·지연 commit 가시성 한계·빈 page·100개 이전 위치·위조/만료/타인·client/session/credential/project/result cursor·원문 재선택·접근 회수·64KiB/4096 제한을 검증한다.
실제 UI 상태행동의 pending/JSON 지연/오류/ABA·선택 상세 숨김/성공 위치·실패 target·DB 정착 소유를 검사한다. actual route/reader와 메모리 DB·합성DOM을 구분하고 타입/직접인접/diff를 확인한다. 기존 테스트·기대값을 낮추지 않는다.
실제 PG/RLS/served·사용자 인수는 미검증으로 보존한다. 롤백은 새 source 단위만 정상 revert하며 기존 저장 검수·원자료는 바꾸지 않는다.


## r2 한정 기술 보완
Primary 첫검토 C0/I1의 인증 진입/페이지 소유 기한 혼동을 분리했다. 기존 AccessRepository 경로/인증·pool·Tx 종료 소유는 그대로이며 페이지 소유30초만 명시했다. 부모 후보 SHA46CE3D9725930F3E65EB4F9C0823BD299973ACB72DA7B866FF0138DA596EBBBB. 공개 page 기능/8경로/실환경 제외·NOT_ADOPTED/SOURCE_GO0은 불변이다.
Main af537e의 최대폭 계산은 summary691B·20개+4096cursor+고정외피18355B<=65536B이며 순수 메모리 산술이다. 실제 API/DB/브라우저 검증이 아니다.
