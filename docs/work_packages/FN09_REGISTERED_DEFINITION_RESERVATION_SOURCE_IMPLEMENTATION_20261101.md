# FN09 등록 정의 책임 세션 예약 A — source 구현 지시서

2026-11-01 / Main 어울 / TEST_ONLY → Main 행동 RED → PRODUCT_GO

## 기준과 역할

직접 승인 후보: docs/contracts/FN09_REGISTERED_DEFINITION_RESERVATION_DECISION_CANDIDATE_20261101.md
SHA256 81E87C515C35D3689859C15259B464238F4B0BDBE10DDC6AAB21D848A11DD759.
시작 codex/av3-stage-b / 10cd3c84770f5b54798cc486a2e5d4aa0380b281. Main이 승인 기록/WI를 게시한 문서 전용 자식에서 같은 제품 지문으로 착수한다. 옛 결정 대기와 실패 감사는 이력이며 현재 직접 승인으로 해소됐다.

기존 Primary만 제품·시험 단일 writer다. Main은 정본 문서·Git·검수·통합을 맡고 같은 제품 경로를 동시에 수정하지 않는다. 기존 Reviewer는 읽기 전용이다. 새 agent·chat·branch·worktree·자동화 생성0. 실제 DB/DDL·권한·키·서비스·Agent·사용자/백업 대상 파일 조사·기존 프로젝트 차단 해제는 제외한다.

## 허용12

기존 제품8과 시작 SHA256:

| 파일 | SHA256 |
|---|---|
| apps/server/modules/assignments/responsible-sessions.ts | 3AA13069F5A40CD2E4C093421969353CE0FE6211C30CCFE95CE9ACE6BD01EF6E |
| apps/server/modules/projects/routes.ts | 57171F5407B73BDEAC06A8A5F8173FC516AA5DC129FD2E1C32B9DC1E71AF83FB |
| apps/web/src/features/workspace/responsible-session-api.ts | 4D5E16016C22C7225E3661C016D7F43338B9BFE6F4EA6BD8B6C7082BEA88279D |
| apps/web/src/features/workspace/responsible-session-approval.ts | 9B4044004F1766AC61FA822B4F61FE1D5FCAB9C6601031806CCF90F57D37825E |
| apps/web/src/features/workspace/WorkspaceResponsibleSessions.tsx | A61EF09A2B49176FCB8CAD1E1449A349469E0196A9911C9E6A159031A731D439 |
| apps/server/modules/executions/project-execution-preparations.ts | BAF8F69C6E178C0D502D469756E086326E2E990B44436D163BA956DC051901CE |
| apps/server/modules/backups/responsible-session-inventory.ts | B5883116BEF97BB88651CB51CDC9D53C24A39D67C9168427D24306A08366438E |
| apps/server/modules/results/result-rework-input.ts | 21FED28C6CEE478DEBE91A6E953165279CB111A145A60840A995C33C11A92375 |

신규4는 부재 확인했다.

- db/migrations/0068_registered_definition_reservations.sql.pending
- tests/unit/FN09/registered-definition-responsible-session.test.ts
- tests/unit/FN09/registered-definition-responsible-session-schema.test.ts
- tests/unit/FN09/registered-definition-responsible-session-ui.test.ts

추가3 제품은 실제 readBinding 소비자다. 실행 준비는 등록 정의를 후보로 오인하지 않도록 candidate reader 전에 명시 거절한다. inventory는 새 정상 원형의 hash/관계/참조 종류를 수집하되 기존 NOT_PERFORMED와 실제 반출 미확인을 보존한다. FN12 보완 초안 준비는 새 정확 원형을 읽고 기존 currentBinding/currentAuthority/실행 false를 유지한다. 새로운 기능·DTO·권한을 추가하는 범위가 아니다.

기존0016 SHA612BE372C2A82F201C072DDE62E7C1222FF96168172EDF22A11226E7291FE91D,
0049 SHA9AE757B30F78F730124932935A7F6462AD48E538AB1A22D9FA75A2B0AC6A73B0 및 나머지 migration/기존 시험·fixture/의존성/AGENTS·보호untracked3은 변경하지 않는다. 추가 경로가 실제 필요하면 원인·정확경로·최소 diff를 Main에 먼저 반환한다.

## TDD 순서

처음에는 신규 시험3만 작성한다. 실제 기존 parser/route/클래스와 실제 React 화면을 소비해 등록 정의 예약 미연결의 행동 RED를 확인한다. module/fixture 부재·SQL 준비 실패를 기능 RED로 꾸미지 않는다. 정상 후보 흐름으로 fixture 준비를 먼저 검산하되 오래된 실제 DB/FS 시험은 실행하지 않는다.

Main이 제품8 불변·정확 행동 RED와 독립 WI 검토를 확인하고 PRODUCT_GO를 보내면 허용12를 구현한다. 기존 시험 삭제/단언 완화·제품 timeout 연장·가짜 성공0. native exit는 즉시 보관한다. fixture 준비 오류와 제품 오류를 구분하며 동일 근본원인3회는 추가 재시도 중지·원인/증거/변경/남은 작업을 Main에 인계한다.

## 정확 입력·원형·보호

기존 exact5 payload는 그대로 후보만 의미한다. 새 exact6은 connectionKind:'REGISTERED_DEFINITION'을 명시한다. 부재만 기존 분기, null/unknown/추가키/위조는 거절한다. 바깥 ProjectCommand schemaVersion1과 bindResponsibleSession·target/expected/prior·baselineRefs·approvalRef는 유지한다.

신규 binding은 exact15/REGISTERED_DEFINITION_ONLY, session은 exact7에 같은 connectionKind를 보존한다. 기존 exact14/6·CANDIDATE_ONLY 원형을 소급 변환하지 않는다. state RESERVED, 외부 handle null, executionAuthorized/dispatchPerformed false이며 NOT_READY 설정은 능력 합격이 아니다. HUMAN 보고/개별 claim을 자동 능력·권한으로 사용하거나 역갱신하지 않는다.

fresh는 실제 ProjectConnectionDefinitions.read를 같은 PoolClient/actor로 소비하고 정확 project/fullref/head를 검사한다. 없는 정의·다른 프로젝트·변조·옛 head를 후보 행으로 대체하지 않는다. 기존 후보와 동일 UUID여도 명시 종류에만 결박한다.

현재 회원/OWNER·단독 제어·세대·현재 정책·기한을 보존한 뒤 정확 원명령 replay를 검산한다. replay에는 fresh 정의 head/관계/신규 한도를 소급하지 않는다. history read는 현재 회원과 원명령·receipt/audit·원hash/관계를 검산하고 실제 현재 실행 효력으로 승격하지 않는다.

같은 분기·같은 connection fullref와 정확 existingSessionBindingRef만 기존 후속 예약으로 허용한다. 분기 변경/다른 연결은 기존 SESSION_REPLACEMENT_REQUIRED/FN14에 남긴다. 새 세션 재해석/자동 교체0. AUTO/DENY/REQUIRE_APPROVAL과 기존 일회 승인 요청→별도 결정→원payloadHash/command/policy/target/기한/한 번 소비를 보존한다. 역할 정의/후보 exact5 승인 상속·다른 명령 재사용0.

## forward SQL과 실제 소비자

0068.pending에만 분기를 작성한다. 새 표·데이터 변환/삭제·초기화·기존 migration 쓰기0. guard_responsible_session, guard_session_binding_complete 및 0049의 payload 재구성·fn09_responsible_approval_execution_valid/related/complete 등 실제 함수·trigger chain을 모두 대조해 기존 후보 분기 의미와 INVOKER/ACL을 유지한다. 원command/외부ID·session/binding·영수증·감사·소비/승인과 exact discriminator/hash/SQL NULL·JSON null을 양방향 완결 검산한다.

0016의 후보 전용 CHECK는 명시 이름이 없다. DB 이름을 추정해 drop하지 않는다. 새 forward SQL에서 정확 원정의/대상 relation/namespace와 일치하는 CHECK만 유한 검산하고 0개/다중/기대와 다른 정의면 중단한다. 기존 CHECK의 보호 표현을 보존하는 두 정확 분기를 만든다. 다른 CHECK·trigger를 광범위하게 지우거나 disable하지 않는다. 모든 SQL은 미적용이다.

project-execution-preparations는 등록 정의 예약이면 candidate reader 전에 기존 의미의 미지원/결박 오류로 닫고 실제 준비를 열지 않는다. FN14 source adapter는 원 ref/관계만 읽는 기존 지원 미확인/gap을 유지하며 추가 supplier로 바꾸지 않는다. FN16 inventory의 source 관계는 새 정의 namespace로 명시하고 기존 후보 기록을 유지한다. FN12 보완 초안은 예약 원형 수용만 보완하며 반환 status·현재권위/실행 false와 기존 범위검산은 같다.

## 화면

기존 후보/총괄·단계 기본 동작은 보존한다. 등록 정의만 별도 명시 선택으로 기존 보호 GET(id/version/hash)에 연결해 성공한 정확 원형을 사용한다. 새 목록 API0. 실패/오래된 응답은 선택을 확정하지 않는다. 선택 종류·고정 ref·예약/미확인/실행 허가 없음이 구분돼야 한다.

선택→원명령 준비→명시 보관→receipt/고정 재조회를 연결한다. owner/project/client/session/CSRF/transport·선택 binding/관측 ABA·첫 async 전후 및 전송 직전 원명령 부모 보존 성공을 결박한다. pending/UNKNOWN 중 선택변경·자동 POST를 막고 원명령을 보존한다. 저장 후 GET 실패는 receipt 보존·새POST0, 명확 서버 거절과 판독불가 오류는 구분한다. 늦은401이 새 문맥을 종료하지 않아야 하며 닫기/무렌더 transport 교체 후 자기 작업 latch만 회수한다.

## 검수·반환

신규3과 실제 영향에 맞는 직접 인접만 선택한다. 후보 정상/회귀, 등록 정의 fullref/head/project/같은UUID namespace, 판별값 부재/null/unknown, 같은 session 후속 CAS/분기 교체, REQUIRE 원payloadHash 일회소비·승인 상속 차단, 보호 뒤 replay/역사·영수증/감사 손상, 실행 준비 차단과 inventory/FN12 원형·false 유지, 첫 prepare 중 선택 교체 POST0·UNKNOWN/receipt/늦은401/닫기·transport 복구를 검증한다.

responsible-sessions.test.ts는 Pool/randomBytes를 포함하므로 전체 실행 대상으로 자동 선정하지 않는다. React는 메모리 DOM·Vite configFile:false/envDir:false/publicDir:false/write:false만 사용한다. 넓은 FS/SSR/native/DB 그룹·실브라우저는 실행하지 않는다. 새 합성 파일/프로세스가 필요하면 literal 이름/owner/수명/정리를 Main이 사전등록한 뒤에만 만든다.

최종12 SHA와 diff/변경사유·정확 명령/native exit·행동 RED/GREEN/오류 분류·미실행/rollback·writer 반환을 제출한다. Main fresh/독립 검토와 기존 private branch checkpoint는 별도다. 실제 PG/RLS/권한/경합/SQL OID·브라우저/실제 Agent·서비스·사용자인수는 NOT_RUN으로 남긴다. 전체FN09/Stage/WORK_PLAN 완료로 승격하지 않는다.
