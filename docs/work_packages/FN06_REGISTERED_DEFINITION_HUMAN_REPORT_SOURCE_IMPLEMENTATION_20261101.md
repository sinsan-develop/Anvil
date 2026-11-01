# FN06 등록 정의 HUMAN 보고 A source 구현 작업지시서

2026-11-01 신산님 직접 승인: “등록 정의 HUMAN 보고 A안 승인해. 코드·화면·미적용 SQL·합성 검증은 기존 subagent에게 맡겨. 실제 DB·권한·키·서비스·Agent 실행은 제외하고, 너는 검수·통합하면서 작업계획서 완료까지 계속 진행해.” goal active 전환도 수신했다. 기존 BLOCKED/NOT_ADOPTED 기록은 당시 이력이며 이번 범위는 직접 채택됐다.

기준 계약 docs/contracts/FN06_REGISTERED_DEFINITION_HUMAN_REPORT_DECISION_CANDIDATE_20261101.md SHA256 5AEB6CE901F3AEBF891C7CEED550E0AE754EDAE427D4D1068B9B63F2A6EF6D8D의 A 및 r2보완 전체. 후보 원문/옛 미채택 머리글은 바꾸지 않는다. 시작 source/private 3fb08553ed924b9e3499219575d2627efea706f4 / codex/av3-stage-b·tracked clean/보호untracked3. Main 문서통제 후속commit은 별도 전달한다. 기존 Primary 단일 code writer, Main 제품write0·Reviewer 읽기/검수다. 새agent/chat/branch/worktree/Agency·자동화0.

## 허용14와 경계
기존6:
1. apps/server/modules/projects/routes.ts
2. apps/server/modules/connections/project-connection-definitions.ts
3. apps/web/src/App.tsx
4. apps/web/src/features/connections/ConnectionsPage.tsx
5. apps/web/src/features/connections/ConnectionDefinitionPanel.tsx
6. tests/unit/FN06/connection-definitions.test.ts — 실제 변경되는 정의 합산cap의 엄격한 메모리fixture/반례 적응만, 기존 단언/기준 보존
신규8(부재 확인):
7. apps/server/modules/connections/definition-capability-report-input.ts
8. apps/server/modules/connections/project-definition-capability-reports.ts
9. apps/web/src/features/connections/definition-capability-report-api.ts
10. apps/web/src/features/connections/DefinitionCapabilityReportsPanel.tsx
11. db/migrations/0067_definition_capability_reports.sql.pending
12. tests/unit/FN06/definition-capability-reports.test.ts
13. tests/unit/FN06/definition-capability-report-schema.test.ts
14. tests/unit/UI11/definition-capability-report.test.ts

기존 v1 parser/service/Web decoder·0057/0065/0066·공용cursor codec·다른업무/보호untracked3·의존성·AGENTS는 수정하지 않는다. 필요한 내부 소비/fixture 경로가 추가로 드러나면 이유와 실제경로를 Main에 보고한다. 임의 새공개계약/기한/한도/권한 추가0. 문서·Git commit/push는 Main 소유다.

## 실행 순서
먼저 신규시험3의 TEST_ONLY로 기존 실제route/React에서 v2 저장/이력 미연결의 행동 RED를 확인한다. module loader/새SQL 부재는 별도 준비 실패이며 기능 RED로 꾸미지 않는다. 사전 독립 WI 검토와 Main PRODUCT_GO 후 허용14 제품/SQL을 구현한다. 기능별 신규/인접검수·type·메모리Web build·diff·최종14지문/오류/미검증·writer 반환 후 Main fresh/독립검수로 통합한다. 기존 완료검사는 이번 변경에 직접 영향받는 경우만 선택한다.

## 명령·원형·실제 보호 소비
v1 입력/후보/응답과 412 승인제한을 보존하고 명시 payload.schemaVersion2 exact9만 새 분기로 보낸다. 기존 HUMAN r2의 현재 재인증/세션·OWNER/제어·세대·명시 AUTO정책을 먼저 검사한 뒤 replay 원보고/원command/hash/receipt/audit를 검산한다. replay에는 fresh 보고만료/정의head/supersedes·증거·새cap을 소급 적용하지 않는다. 현재 접근 보호를 빼지 않고 같은 원결과만 반환하며 재사용/다른본문/주체를 거절한다.

fresh는 실제 ProjectConnectionDefinitions.read를 같은 PoolClient/주체로 소비해 고정fullref와 head를 확인한다. tool.product/version 일치, adapterVersion과 adapterKind 독립, 환경null=정의null·누락거절·비null 보호provider미연결412를 유지한다. supersedes는 같은 v2 정의/환경 관계만 허용한다. 동일Tx/실제시각·정책과 기존2시간 범위/현재세션의 가장 짧은 처리기한을 전후 확인하고 잠금/증거읽기로 연장하지 않는다. 사람 VERIFIED 주장은 원문만 보존하고 파생6능력은 UNVERIFIED/권한false다.

증거 metadata/격리/hash·mediaType/bytes 검사와 실제 ProjectDocuments.originalText 소비를 보존한다. 성공bool/stub을 실제 원문 검산으로 대체하지 않는다. 순수모델은 그 한계로 보고하며 새로운 실제 보호reader 양성에 합성파일이 필요하면 Main이 literal 자원/owner/수명/정리를 먼저 등록한 뒤 별도 한정검증한다. 실제 사용자/백업대상 파일·키는 읽지 않는다.

## 저장·cap·SQL 완결
0067.pending의 분리2표/불변claim·snapshot·증거·정의FK/fullref·namespace·원command/receipt/audit를 같은Tx에 묶는다. v1변환/원문수정/자동삭제0. count10000/모든보관 canonical64MiB·replay산입0/UNKNOWN보존과 기존 VERIFIED account used+held+정의canonical+새보고canonical의10GiB를 실제row/정합성으로 검산한다. 현재 원장kind/수치를 위장하지 않는다. 보고 신규쓰기와 이후 정의/기존account/reservation쓰기 양쪽을 같은project lock에서 보호한다. 기존migration은 고치지 않고 신규forward SQL로 guard를 보완한다. source 권한정의는 미적용 파일이며 실제DDL/GRANT/role/SQL실행0.

정확1행 감사/receipt·외부/내부commandID/operationId·subject/target/policy·승인null SQL형식·canonical bytes/hash를 양방향완결 검산한다. 실제SQL NULL과 JSON null을 혼동하지 않는다. 빠진행/추가행·오염snapshot/다른namespace를 정상조회로 반환하지 않는다. 상한429와 같은Tx 전체rollback 의미를 서버오류 처리까지 보존하고 미확정COMMIT을 명확거절로 낮추지 않는다.

## 목록·고정GET·UI
계약의 exact응답/닫힌currentness {code,target}를 따른다. 목록은member·고정view/20·정확선택ref/filter·시각/id 역순, 원문/증거 재검산은 고정GET 선택후다. ProjectListCodec의 기존 cursor 수명30분을 그대로 쓰고 새 전용 signing domain FN06_REGISTERED_DEFINITION_HUMAN_REPORTS: 및 canonical query에 project/view/connectionRef/order를 결박한다. keyset 저장시각은 DB UTC 마이크로초 문자열 to_char(...US...)·id로 보존하고 Date 변환으로 정렬정밀도를 잃지 않는다. 같은actor의새client 조회는 현재로그인/회원검사로 보호하며 쓰기제어권을 요구하지 않는다.

App 소유 별도 frozen 버퍼로 정의 보호조회 성공→명시 사람보고 작성→원명령 준비→명시저장→영수증/고정GET과 전체/정의별 이력·다음/이전·실패동일cursor 명시재조회를 연결한다. 첫commit/계정·project·session/CSRF/transport/mounted/revision·관측ABA와 늦은401을 fencing한다. 저장후GET실패는receipt를보존·새POST0, 판독불가/비정형/초과POST오류는 UNKNOWN·원body보존, 명확한서버거절만별도수정한다. 기존v1 form/권한/후보·정의역갱신·책임세션 활성화·실행허가는 열지 않는다.

## 검증·반환
실제route/클래스/원body·React를 소비하는 신규3과 직접인접을 고른다. 정상null→저장→목록/고정조회, v1불변·fresh/replay 순서, 참조/환경/도구·정책/제어/재인증·증거격리/변조·row/감사반쪽·namespace·상한과후속원장·cursor다른조건/만료/정밀도·UNKNOWN/저장후GET실패/문맥ABA를 확인한다. 기존기대값 완화/시험삭제0. React는 memory DOM·Vite configFile:false/envDir:false/write:false만 사용하고 기존 FS/SSR 그룹을 이름필터로 통째 실행하지 않는다.

정확명령/즉시native exit·실제 RED/GREEN/실패분류·변경사유/diff·최종14 SHA·미검증/rollback·QA/live0을 반환한다. 실제DB/RLS/권한/경합/서비스/Agent·실Browser/사용자인수는 NOT_RUN으로 남긴다. Source검수를 실제연동/전체FN06·WORK_PLAN 완료로 승격하지 않는다.
