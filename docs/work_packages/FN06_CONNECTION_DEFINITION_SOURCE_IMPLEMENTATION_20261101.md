# FN06 ConnectionDefinition A source 구현 작업지시서

2026-11-01 신산님 직접 승인: FN06 ConnectionDefinition A와 FN16 잠금 조회 함수 r2 A의 코드·화면·미적용 SQL·합성 검증을 기존 subagent에게 맡기고 Main이 검수·통합한다. 실제 DB·권한·키·서비스·Agent 실행은 제외한다. 이 지시는 앞선 계약결정 BLOCKED를 해소하며 기존 후보 hash는 바꾸지 않는다.

승인 기준: docs/contracts/FN06_CONNECTION_DEFINITION_STORAGE_DETAIL_CANDIDATE_20261101.md SHA256 80A2E0C160D3F5DCDB161AECBDFE3F4CCE632716C33C71A7C26C188A35639B12의 A. 시작 코드/private 3301a1f6b8eba2e4382be130e3c84cc6fd83eea1 / codex/av3-stage-b. 문서 전용 후속 commit은 Main이 전달한다. 담당은 기존 Primary 단일 writer, Main 제품write0, Reviewer 읽기. FN06 다음에 같은 writer로 FN16을 진행한다.

## 허용16
기존8은 위 HEAD의 원형을 기준으로 보존·최소 수정한다.
1. apps/server/modules/projects/routes.ts
2. apps/server/modules/access/project-command.ts
3. apps/server/modules/transfers/preparation-record-source-adapter.ts
4. apps/web/src/App.tsx
5. apps/web/src/features/connections/ConnectionsPage.tsx
6. apps/web/src/features/connections/policy-editor-profile.ts
7. apps/web/src/features/transfers/preparation-record-api.ts
8. apps/web/src/features/transfers/TransferPreparationRecordPanel.tsx
신규8은 부재가 확인된 경로다.
9. apps/server/modules/connections/connection-definition-input.ts
10. apps/server/modules/connections/project-connection-definitions.ts
11. apps/web/src/features/connections/connection-definition-api.ts
12. apps/web/src/features/connections/ConnectionDefinitionPanel.tsx
13. db/migrations/0065_connection_definitions.sql.pending
14. tests/unit/FN06/connection-definitions.test.ts
15. tests/unit/FN06/connection-definition-schema.test.ts
16. tests/unit/UI11/connection-definition.test.ts
이외 제품/시험·기존 migration·의존성·AGENTS·보호 untracked3·완료 FN15/FN12/UI05는 수정하지 않는다. 꼭 필요한 기술 보완 경로는 근거와 함께 Main에게 먼저 보고하며 임의 확대하지 않는다. 문서/commit/push는 Main 소유다.

## 실제 누락·RED 우선
현재 routes의 registerConnection은 전부 후보 분기로 보내 definition을412로 닫는다. FN14 adapter/Web도 nonnull target을412로 닫고 있다. 실제 기존 명령/reader·React Panel을 소비하는 합성 시험으로 정상 정의 등록·고정 조회·target 선택의 누락 RED를 먼저 확인하고 허용 범위에서 구현한다. loader/fixture 실패는 기능 RED가 아니다.

## 입력·명령·저장·조회
- 기존 후보 registerConnection payload와 동작은 보존한다. 새 분기는 exact {definition,reason}; 입력 definition exact10과 서버 소유 id/version/status를 합친 exact13은 승인 후보 그대로다. kind/candidate/정의 혼합, caller id/version/status·실행 권위 주입을 거절한다.
- null과 누락을 구분한다. connector/account/environment/capability는 사용자가 명시 null을 선택할 수 있고 비null은 실제 보호 source가 검산해야 한다. source 미연결은412이며 후보 보고서/hosttrust·임의 fullref를 증빙으로 대체하지 않는다. policyRef는 현재 프로젝트의 정확 현재 정책이다.
- Unicode·JSON·비밀 의심 검사와 기존 전체2MiB 상한을 유지한다. modelOptions object의 auto 등 원값을 보존하고 executable/path/실모델 호출로 해석하지 않는다. status NOT_READY·support UNVERIFIED·실행/재개 false를 고정한다.
- 현재 로그인·OWNER/단독 제어·현재 세대·명시 registerConnection 정책·정확 policyRef/기한·기존 AUTO/REQUIRE 일회 승인/원명령 hash·감사를 재사용한다. 새 승인 유형·자동 정책 부여0. replay를 새 산입보다 먼저 판정하고 COMMIT/응답 불명은 UNKNOWN 원명령으로 보존한다.
- head·불변 version/canonical 원문·provenance를 같은 transaction으로 저장한다. 프로젝트 lock 아래 실제 row/canonical hash·UTF8 bytes를 검산해 head1000/version10000/전체canonical64MiB를 지킨다. archived/과거 버전도 산입, replay추가0·자동삭제/상한초기화0. 초과는 승인된429/같은Tx rollback 의미를 유지한다.
- 기존 project 저장량 정책도 우회하지 않는다. 기존 원장 kind는 ARTIFACT/CHECKPOINT 등 고정 범위이므로 새 정의를 그 종류로 위장하거나 기존 ledger가 metadata를 이미 산입한다고 표시하지 않는다. 0065 안의 내부 검산/지연 guard로 정의 canonical 합계와 기존 VERIFIED 계정/used·held·원장 정합성을 동일 project lock 아래 함께 검산하고 기존 예약 쓰기 뒤에도 더 엄격한 프로젝트 cap이 깨지지 않게 할 수 있다. 기존 SQL/원장 수치·kind를 임의 재정의하지 않으며 실제 보호 source/coverage가 미연결·불명일 때 정상 저장으로 우회하지 않는다. 구체적 검산이 승인 계약 범위에서 불가능하면 정확 근거를 Main에게 반환하고 다른 구현을 계속한다.
- public 고정 GET은 승인 경로/DTO 그대로이며 현재 member+명시 readConnectionDefinition 정책을 검사한다. 원작성 client·쓰기 제어권을 읽기 전제로 추가하지 않는다. head 일치와 실제 도구 현재성을 구분한다. 목록/수정/CAS/해제는 이번 범위가 아니다.

## UI11·FN14 수직 연결
App 소유 전용 원명령 버퍼로 작성→준비→기존 AUTO/별도 REQUIRE→저장 영수증→보호 고정 GET을 연결한다. UNKNOWN/PENDING 원문·binding·payload hash를 보존하고 화면 이동/재인증/다른 주체의 옛 응답이 원형을 바꾸지 않게 한다. 저장 성공 후 GET 실패는 저장 실패로 재전송하지 않는다.

FN14는 동일 db/transaction의 실제 head·불변 정의 row와 canonical fullref를 검산한 내부 REGISTERED_CONNECTION reader만 사용한다. 외부 고정 GET의 현재 보호와 별개로 내부 source도 현재 주체/정책·프로젝트 보호를 유지한다. Web은 보호 GET 뒤 정확 ref 선택·준비를 연결한다. 실제 능력/공급자 미확인을 TRUE로 바꾸지 않고 TARGET_CAPABILITIES_UNVERIFIED·실인계/재개 불가를 유지한다. 후보/hosttrust ref 자동 승격0.

## 검증·반환
신규3시험은 실제 parser/명령·정책/reader·동일Tx 및 실제 React 작성→기존 API→영수증/고정GET→FN14선택을 메모리 합성으로 소비한다. 정상 null·누락/비밀·다른 프로젝트/소유자·정책/제어/기한·비null source부재·hash/version·REQUIRE 소비/재사용·quota 경계/기존원장 미확인/replay0·UNKNOWN/저장후GET실패·late401/ABA를 확인한다. SQL 구조와 합성 DB 모델은 실제 PG/RLS/권한/경합 검증이 아니다.

실제 파일/키/DB·서비스·Agent·OS 권한·브라우저 신뢰·현재 프로젝트 차단 해제0. React는 기존 메모리 DOM/Vite configFile:false/envDir:false/write:false 양식만 사용한다. createServer/실설정 탐색·이름필터로 넓은 시험 실행0. 직접 관련된 기존 pure 시험을 내용 확인 후 선택하고 정확 type/diff를 수행한다. 기존 기대값을 느슨하게 바꾸지 않는다. 기존 unconditional target412가 새 계약과 달라지면 source 미연결 음성을 보존하며 근거/diff를 Main에게 먼저 보고한다.

정확 명령/exit·RED/GREEN·변경 diff·오류·미검증·QA/live0·최종16지문과 writer 반환을 보고한다. Main fresh 및 독립 C/I 검토 후 통합한다. source 검수를 실서비스/실사용/전체 FN06·FN14·WORK_PLAN 완료로 승격하지 않는다.
