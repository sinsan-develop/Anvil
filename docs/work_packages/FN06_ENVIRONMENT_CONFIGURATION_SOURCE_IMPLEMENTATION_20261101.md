# FN06 환경 설정 source-only 구현 작업지시서

2026-11-01 / Main 어울 / ADOPTED_SOURCE_ONLY / TEST_FIRST
r4 A 직접 채택 완료 / 정확 범위 Main dispatch 후 단일 Primary 수행

## 1. 목표·기준·착수 조건

기존 FN06/S11의 환경 정의를 실제 metadata 생산→환경 불변 저장/고정 조회→연결 정의의 환경 ref 결박까지 source-only로 완성한다.
기준 후보: docs/contracts/FN06_ENVIRONMENT_VERSION_CONTRACT_CANDIDATE_20261101.md r4 SHA256 BA002F75E66D2A07374F1919F241AB1F843E839AF0D6F9CBEEB0603951DD1EBA.
분석 기준: docs/contracts/FN06_ENVIRONMENT_VERSION_REFERENCE_GAP_AND_COMPLETION_PACKET_20261101.md SHA256 A1A49632D60889B5B892DCCE86AC556A6CAC22EC27F29D9FEFCB3A0AB56F7061.
계획 FN06·설계 §9.2/S11·INTERFACES §12.1과 연결한다.

기존 FN09 완료 체크포인트276f8dcc와 후속현황77147d83·분석3ab4ac46·후보c4aef268을 재구현하지 않는다. source baseline은 branch codex/av3-stage-b의 안전한 실제 HEAD를 dispatch 직전에 재검산한다. 기존 보호3/사용자 dirty·untracked는 범위 밖이다.

PMO가 직접 채택 대상으로 구분했던 r4 A는 신산님의 현재 직접 승인으로 채택됐다. 승인 기록의 대상hash·제외범위와 이 WI exact29를 결박하고 Main이 동일 Primary에게 TDD를 dispatch한다. 기존 FN09 승인을 재사용한 것이 아니다. §7의 현재 승인 결박을 적용한다.

## 2. 역할과 순서

동일 기존 Primary 단일 code writer가 EV-A→EV-B→EV-C를 순서대로 수행한다. Main은 문서·관리·검수·Git통합, 기존 Reviewer는 읽기전용 독립 검토다. Main은 Primary의 제품 경로를 동시에 수정하지 않는다. 새 세션·agent·branch·자동화를 만들지 않는다.

EV-A: 실제 세 metadata producer/개정/회수/list/fixed reader·등록 증빙·정확 승인/정책 연결.
EV-B: EnvironmentVersion producer/CAS/replay/고정조회·ConnectionDefinition 환경 소비·기존 정의/보고와 원장 양방향 총량.
EV-C: 기존 S11의 폼/보호선택·App 전용버퍼 ACK·별도승인·POST/receipt/fixed GET·UNKNOWN/늦은결과 보호.

중간 단위 검사와 전체 기능 검수를 분리한다. 중간 PASS를 환경 전체 완료로 보고하지 않는다.

## 3. 정확 코드·시험 허용30경로

기존16:
1. apps/server/modules/projects/routes.ts
2. apps/server/modules/access/project-command.ts
3. apps/server/modules/approvals/project-approvals.ts
4. apps/server/modules/connections/project-connection-definitions.ts
5. apps/server/modules/connections/project-definition-capability-reports.ts
6. tests/unit/FN06/connection-definitions.test.ts
7. tests/unit/FN06/definition-capability-reports.test.ts
8. apps/web/src/App.tsx
9. apps/web/src/features/connections/ConnectionsPage.tsx
10. apps/web/src/features/connections/ConnectionDefinitionPanel.tsx
11. apps/web/src/features/connections/connection-definition-api.ts
12. apps/web/src/features/connections/policy-editor-profile.ts
13. apps/web/src/features/connections/CandidatePolicyPanel.tsx
14. apps/web/src/features/connections/candidate-policy-api.ts
15. apps/web/src/features/decisions/api.ts
16. apps/web/src/features/decisions/ApprovalsPage.tsx

신규14:
17. contracts/runtime/environment-configuration-v1.ts
18. apps/server/modules/connections/project-environment-resources.ts
19. apps/server/modules/connections/environment-registration-evidence.ts
20. db/migrations/0069_environment_configuration.sql.pending
21. tests/unit/FN06/environment-resources.test.ts
22. tests/unit/FN06/environment-configuration-schema.test.ts
23. apps/server/modules/connections/project-environments.ts
24. tests/unit/FN06/environment-versions.test.ts
25. apps/web/src/features/connections/environment-configuration-api.ts
26. apps/web/src/features/connections/environment-configuration-approval.ts
27. apps/web/src/features/connections/EnvironmentConfigurationPanel.tsx
28. tests/unit/UI11/environment-configuration-ui.test.ts
29. tests/browser/UI11/environment-configuration-dom-harness.tsx
30. tests/unit/FN06/environment-configuration-fixture.ts

신규 이름 충돌이 없고 현재 migration0068까지임은 읽기 조사에서 확인했다. 0069는 이 구현의 제안 번호이며 dispatch 직전에 충돌을 재확인하고 Main이 단일 담당자에게 예약한다. 앞 번호를 덮어쓰거나 기존 SQL을 수정하지 않는다. 새 경로·상수/함수 이동이 필요하면 코드 쓰기 전에 근거를 Main에 반환한다.

정본 docs/WORK_STATUS.md·WORK_PLAN·검수 결과·후보/이WI 갱신은 Main 소유 별도 문서 경로다. Primary는 제품 제출과 오류/명령 evidence를 반환하며 정본 현황을 동시에 편집하지 않는다.

## 4. 구현 세부·금지선

- typed namespace·환경원형9/소스6·선언/관측/실행 비권위를 후보대로 보존한다.
- 실제 SourceRoots/RegistrationReads/SourceReadRecords/정책 reader를 소비한다. supplier 성공 bool·가짜 UUID·문법검사만으로 실제 ref를 유효 처리하지 않는다.
- 기존 등록 GET 권한을 변경하지 않는다. 저장당시 최소 증빙의 새 내부 보호 소비를 후보 범위에서 구현하고 원요청 전체 재구성/현재 host 신뢰로 승격하지 않는다.
- 승인 API가 candidateRef·최상위 policyRef/expiresAt을 가정하는 기존 후보 분기는 그대로 둔다. 신규 metadata/완성형환경은 원 버퍼·중첩 policyRef·baseRef·현재 기한의 닫힌 분기로 처리한다.
- 정책 editor profile의 명시 allowlist와 실제 서버 정책 분류를 함께 연결한다. 실제 사용자 정책 자동부여0.
- App 전용 네 종류 버퍼/CAS ACK와 현재 문맥 fencing을 구현한다. 부모 ACK 전에 POST하지 않는다.
- 연결 정의의 environmentRef만 실제 보호 reader로 연결한다. connector/account/capability·HUMAN보고 환경지원·실행준비·예약/실행을 함께 열지 않는다.
- quota는 기존 used/held+정의/보고+네종류원형+증빙을 한 번씩 합산한다. 회수버전 포함/환급0·환경만있는프로젝트·이후 정의/보고/account/reservation 변경에도 적용한다.
- 0069는 기존0059/0065/0067과 완결 chain의 함수 서명/권한/trigger 의미를 보존하는 forward SQL만 작성한다. 실제 SQL/DDL/GRANT/PG접속0.
- 기존 시험2 변경은 새 정확조회/합산을 소비하는 fixture 보완과 반례 추가만 허용한다. 기존 단언·보안/거절 기준·QA/FS 분기를 삭제/약화하지 않는다.
- 임의 generic repository·전체리팩토링·기존공통헬퍼의 무관 의미변경·package/lock/설정 변경0.

## 5. TDD·독립 검수·최소 실행 계획

먼저 실제 소비 시험의 기능 RED를 확인한다. 준비 실패(파일부재/loader/fixture 선행)와 기능 RED를 분리한다. 명령·native exit·count·시간·변경hash를 반환한다.

필수 한정 사례:
- metadata 세종류 실제 producer→불변버전/회수→fixed/list reader, 다른project/kind/hash/부모/회수/정책 실패.
- 실제 metadata→환경9 생성/고정조회→실제정의 environmentRef 결박. 정상은 소스/host/명령/비밀 참조가 채워진 사례를 포함하고, 합법적 비밀미사용·identity=null의 사전 정의도 따로 확인한다.
- 원 생성 등록 감사target v1/CREATED·정확source/reason·저장resultRef hash·AUTO/일회 null/실제소비·다른scopeDigest·증빙손상/누락/다중 반례.
- 원명령 별도승인→결정→일회소비→원replay, fresh CAS·현재보호와 과거원형 분리. 기존 후보와 UUID충돌/혼합payload에 fallback0.
- 환경만 있는프로젝트/양방향추가·예약UNKNOWN 포함/미검증원장·중복청구·상한/CAS 경쟁 모델. 메모리 모델이 실PG경합 증거는 아님을 명시.
- 실제 React 컴포넌트+합성 Host/transport로 보호선택·필드폼·부모ACK→POST·POST전실패 편집회복/POST후UNKNOWN/영수증후GET실패·늦은401/CSRF·선택세대/ABA·실transport교체를 구분한다.
- 미적용 SQL 구조/함수chain·서버/화면변경 typecheck·선정 인접회귀·메모리Web build·diff/raw 검사를 수행한다.

기본 선정 명령은 고정 Node로 신규 FN06 세 시험(environment-resources/environment-configuration-schema/environment-versions)·UI11 environment-configuration-ui만 시작한다. 기존 FN06 두 시험은 수정 영향이 있는 합성 사례의 정확 이름만 먼저 읽어 Main이 선정하며, 기존 QA/FS 분기를 파일 전체 실행으로 함께 돌리지 않는다. 선정하지 않은 기존 실제 FS/PG 사례는 NOT_RUN으로 명시한다. 브라우저용 신규 harness는 이 합성 UI 시험이 메모리로 소비할 소스이며 실제 브라우저/서비스 기동을 뜻하지 않는다. 추가 인접 시험은 수정 영향 근거가 있을 때만 선정한다.

typecheck: 기존 node_modules/typescript/bin/tsc -p tsconfig.base.json --noEmit.
Web build: 기존 Vite의 configFile:false/envDir:false/publicDir:false/write:false/emptyOutDir:false 메모리 방식.
패키지 설치·native compile·기존 실제 FS/PG/브라우저/서비스 QA를 자동 실행하지 않는다. 테스트가 새 자원을 요구하면 먼저 정확 이름/수명/정리를 Main에 보고하고 현재 범위와 대조한다.

수행자 제출 후 Reviewer는 diff/실제생산소비·승인/원장/UNKNOWN과 시험을 독립 읽기 검토한다. Main은 수정된 범위의 선정 검사를 직접 확인하며 unchanged 전체검사를 반복하지 않는다. C/I 보완 후에만 source-only 판정·기존branch checkpoint/private게시를 한다. 실제 필수 gate 미충족이므로 Stage병합/계획완료·실행지원/사용자인수 주장0이다.

## 6. 제외·제출·복구

실제 DB/DDL·사용자권한/정책부여·GRANT·키/인증서/credential/실Secret·서비스·실Agent/비용·실사용자/백업파일 조사·기존프로젝트차단해제·원본SQL변경·main변경은 제외한다. 새 임시PG/컨테이너/native/실브라우저도 이 지시서에 포함하지 않는다.

제출은 COMPLETED/FAILURE_REPORT/INCOMPLETE/BLOCKED를 구분한다. 변경30경로의 실제diff/hash·실행명령/exit·기능/준비실패·시험범위·미검증·livehandle/QA잔여·다음조치를 반환한다. 진행상태 문장만으로 완료라고 하지 않는다.

실제환경 변경이 없으므로 복구는 해당source checkpoint의 정상 Git 되돌리기 검토로 한정한다. 사용자dirty/보호3/기존원문/SQL/이력을 reset/rebase/force로 지우지 않는다. 문서/합성 PASS를 실제 PG·RLS/OID/경합·App·서비스·Agent·전체FN06/계획의 PASS로 승격하지 않는다.

## 7. 2026-11-01 직접 승인 결박·착수 확정

신산님이 현재 대화에서 r4 A의 코드·화면·미적용 SQL·합성 검증을 직접 승인했다.
docs/04_test_reports/AV3/FN06_ENVIRONMENT_CONFIGURATION_APPROVAL_20261101.md에 원문·대상 BA002F75·제외를 기록한다.
기존 WI 초안8E23109E의 exact29·EV-A/B/C·검수/복구·제외는 불변이다. 이 확정은 미채택 경계를 해소하고 동일 범위 TDD 착수 상태로 전환하는 것이다.
0069 부재와 기존 보호3/hash·source ea46d188 local/private동일을 확인했다. Main의 통제문서 게시 후 실제 새 HEAD가 작업 기준이다.
기존 Primary만 허용29의 단일 code writer다. Main은 같은 제품 경로를 수정하지 않는다.
최초 기능 RED와 준비 실패를 구분해 보고하고, 올바른 RED 후 같은 허용 범위에서 EV-A→EV-B→EV-C 구현·기본 검증을 계속한다. 중간 결과를 전체 완료로 처리하지 않는다.
현재 source-only 승인 외 효과를 요구하는 시험/명령은 자동 실행하지 않는다.

## 8. Main 비의미 revision — 공유 합성 fixture 한 경로

부모 WI SHA256 66503F67914258179B7AACFF64B98F35156643078A444C837005F68324F33235.
부모 직접 승인 기록 E56BC7DC86998BAF7E40668E8687DEAA84F1F57994D8D972BD352EDCCD721579 / 계약 r4 BA002F75는 불변이다.

Main은 필수 검수의 Node-only fixture 배치 보완으로 신규 tests/unit/FN06/environment-configuration-fixture.ts 한 파일을 추가 허용한다. 총 허용은 기존16/신규14의 정확30이다. 기능·공개/보호 계약·검수 기준·실환경제외는 변경하지 않아 MAIN_RECONFIRMED_NON_SEMANTIC으로 결박한다. 추가 사람 승인은 요구하지 않는다.

기존 environment-resources.test.ts의 실제 buildApp/인증/SQL 메모리 factory와 상수를 의미변경 없이 추출해 environment-versions/UI11 시험에서 같은 실제 생산·저장·조회 모델을 소비한다. test.ts 직접 import로 시험이 중복 등록되거나 전체 SQL 모델을 복제하는 것을 피한다.
이 helper는 test 등록·최상위 App/공유 global store/실DB·Secret·사용자 파일 접근을 만들지 않는다. 각 시험은 독립 factory와 정확 close를 유지하고, 미모델 SQL 거절·실제 보호 검산·기존 단언을 보존한다. browser harness/bundle은 이 Node-only helper를 import하지 않는다.
0069·기존 코드/시험의 나머지 동일 Primary 단일 writer GO는 유지한다.
