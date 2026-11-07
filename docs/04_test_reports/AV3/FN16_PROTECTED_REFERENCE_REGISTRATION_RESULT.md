# FN16 보호참조 등록·조회 source-only 구현 결과

2026-10-28 · 작성 담당 fn05_share_request_impl · Project Main 독립 검수/실행 증거 반영.

## 1. 판정과 범위

**SOURCE_ONLY_PARTIAL_IMPLEMENTATION_ACCEPTED — 채택된 보호참조 metadata 단위의 source·합성검증 완료. 전체 FN16/UI14/Stage/작업계획·사용자 인수는 미완료.**

CA777의 GET4, 저장/개정·정확 버전 신규사용 회수 command2, UI14/기존 UI08 명시 승인 복귀를 연결했다. 실제 설치 공급자가 없는 기본 상태는 UNCONFIGURED이며 자원/키 descriptor와 실행 가능 상태를 합성하지 않는다. RETENTION 자동삭제OFF metadata 저장만 양성이다. 실제 TARGET/ENCRYPTION_KEY 설치·키 준비/해제/복구키·VERIFICATION 공급자·saveBackupPolicy/createBackup·수집/암호화/job·실제 백업/복원은 미구현 또는 범위 밖이다.

Main은 서버·UI 독립 검수의 필수 finding 해소/C0·I0를 확인했다. 마지막 프로젝트 ABA 반례도 독립 C0·I0다. 실제 PG compile/DML/GRANT/RLS/COMMIT/경합은 수행하지 않았다. Node fakeDB/inject와 실제 App bundle+Edge의 합성 same-origin API 검증을 실제 DB/공급자/운영 서비스 PASS로 승격하지 않는다.

## 2. 권위·기준·관리 경계

- 직접 승인: docs/approvals/FN16_PROTECTED_REFERENCE_DIRECT_APPROVAL_20261028.json, SHA256 C1846395A56A0FCF47E4F6DCD66420D4DC9EF5AB5B275A94AAD9932F3CA98530. “FN16 보호참조 계약과 P03 R2 복제 1회 둘 다 승인해. 계속 진행해.” 중 FN16 source-only 범위를 소비했다. P03 실행은 Main 별도 소유이며 이 구현 담당자는 접근·실행하지 않았다.
- 계약: docs/contracts/FN16_PROTECTED_REFERENCE_REGISTRATION_CONTRACT_R2.md, SHA256 CA7774F7A5C102B2B6EDD3D5D6E87701FEADE197E91B2186D05F4AACFE30AA21. 원 후보의 과거 채택대기 표현은 이력으로 보존했다.
- WI: docs/work_packages/FN16_PROTECTED_REFERENCE_REGISTRATION_IMPLEMENTATION.md, SHA256 36B5B718E3AAA9E186ECA0CF49EC216BCFF16C0E6F7E3A6A34A7A7885C70B8BD.
- 현 manifest: docs/work_packages/FN16_PROTECTED_REFERENCE_REGISTRATION_SOURCE_MANIFEST.json, SHA256 692443B55153A87F27ACD9BA01A4F98DDF646D6B37245F491AEC07B6446BE594. Main이 최초 DOCUMENT_TWO_ONLY를 history에 보존하고 실제 단계 GO를 누적했다. 최초 WI41D4/manifestBB30 및 source채택 갱신 이력은 삭제하지 않았다.
- 최초 제품 기준은 Main이 확인한 625f4255, branch codex/av3-stage-b다. 이전 문서준비 기준4191a7faf67d1f7b56b79eb89c269ddcfb0ad5b1과 pending 이력은 남겨 두었다. Git/현황/게시·최종 checkpoint는 Main 소유다. 작성자 commit/push/WORK_STATUS·WORK_PLAN 변경0이다.
- 기존8+신규12=코드·시험20, WI/manifest2+이 결과1=총23 관리 경로다. 기존 시험·기존 SQL·적용 manifest·기존 선택문서 반출 API/Panel·보호 기존4/untracked8을 변경하지 않았다. 기존 반출 API2D5B/Panel6AC014 지문은 별도 보호 대상이다. 새0053은 기존0050 점유에 따른 비의미 번호 재배치이며 실제 적용되지 않았다.

## 3. 최종 동작과 변경 전후

기존에는 새 보호참조 command가 공개 enum에 없고 GET4와 UI14 소비선이 없었다. 기존 명시 정책/승인 reader에서도 새op2가 누락됐다. 이후 다음 범위를 연결했다.

- 서버: 기존 PROJECT/HUMAN/OWNER·control·명시 정책·기한을 보존하면서 새op2를 지원목록에 추가했다. 신규 전용 authenticated transaction은 trusted actor/client local GUC를 새 표 첫 조회·replay 전에 설정하고, 원문·정확 head·현재 정책·기한·실 공통 receipt/audit/승인 consume 경로를 결박한다. 기존 공통 raw replay 조기반환을 새op2의 보호 조회 우회로 쓰지 않는다.
- 저장/조회: RETENTION 신규→불변v1 고정조회→동일kind 개정v2/previousRef→과거v1 회수event1을 저장한다. 회수가 본문head v2를 바꾸지 않는다. 회수 payload exactref와 외피/승인 scope의 현재 body head fullref를 구분한다. 같은 원명령 replay는 추가 event/승인 소비0이며 다른 body·stale head·중복 회수는 명확히 거절한다.
- 무결성: canonical 원문/hash에 더해 원command 외피·payload를 복원해 request_hash를 대조한다. 권한 scope_digest와 감사의 동일 scope/policy/client/source_kind·target·operation·단일행·시각을 함께 검사한다. coherent 원문/ref 재hash만으로 명령 귀속을 바꾸지 못하게 했다.
- 조회 권한: GET4는 현재 OWNER와 민감 접근·세션을 검사하고 control을 요구하지 않는다. VIEWER/HANDOFF_ELIGIBLE/archived/회원부재는 비노출404, 무인증401이다. 고정 버전 GET에는 임의 query를 받지 않고 cursor는 project/actor/client/kind/limit/order/expiry에 결박한다. no-store를 유지한다.
- SQL.pending: 복합 project/previous FK·명시 NOT NULL·head CAS·불변 version/event·최소 권한/RLS/FORCE RLS·receipt/audit/승인 완결과 deferred 현재성 guard를 source로 작성했다. 이전 guard는 wrapper로 위임하여 기존 지원을 보존한다. receipt trigger는 실제0011의 scope_kind/scope_id를 명시 분기한다. 원command 불변과 현재 transaction xmin/시각의 보조 결박은 source 검수 범위이며 실제 PG/subtransaction/xid wrap 효력은 미실증이다.
- UI: 기존 정책 행동29개·순서/default DENY를 유지하고 새op2만 명시 선택하게 했다. UI14는 설치 공급자 미구성, 목록/고정 버전, 새 metadata/개정/정확 과거 버전 회수, 준비 POST0·별도 전송을 제공한다. 실패409/412/503·결과 미확인·현재 접근 상실을 성공/빈목록으로 덮지 않는다.
- App/UI08: 프로젝트/actor/client/API/transport/CSRF와 exact old buffer CAS를 소비하고 dirty·원명령/body·UNKNOWN을 App에 보존한다. 명확 APPROVAL_REQUIRED 뒤에만 일회 승인 요청을 작성하며 UI08 결정→원명령 명시 복귀→현재 head/정책/기한/승인 조회→명시 결박→별도 전송이다. 승인 hash로 원문을 복원하거나 결정 즉시 metadata를 저장하지 않는다.

현재 인터페이스의 원문/hash는 metadata와 해당 명령 귀속을 뜻한다. 실제 key 보호·백업 복구·실행 권한 보장을 뜻하지 않는다. CSS·패키지·설정·일반 구조는 변경하지 않았다.

## 4. Main의 독립 검증과 실제 범위

| 증거 | 실제 결과 | 해석 |
|---|---|---|
| c28ceb 입력 최초 |12=8PASS/4FAIL,445.1887ms|새op 정책/공유 승인목록 부재 RED. import 수집 오류 아님|
| d7fec9 입력 연결·FN17 인접 |44PASS|초기 입력 지원 연결 확인|
| 3b04b0 store 최초 |12=2PASS/10FAIL,1485.0644ms|공개 command enum400 등 실제 저장 소비 부재 RED|
| 46a2a3 routes 최초 |7=1PASS/6FAIL,1898.3607ms|GET 미등록·인증 미도달·공급자412 대신enum400; 중복JSON만 기존 PASS|
| 8a189a OWNER 보강 필터 |3=0PASS/3FAIL|미등록404를 인증된 권한거절로 오인하지 않도록 도달 반례 RED|
| 9351d6 서버 최초 동결 묶음 |64PASS|당시 source의 합성 범위; 후속 finding을 소급 해소한 결과 아님|
| 9f1c43 서버 보완 후 |changed store16+routes8=24PASS, type exit0|receipt/schema/previous 경계 보완 수용. 실PG 제외|
| 94f38e UIunit 최초 |7=3PASS/4FAIL,173ms|실 정책 선택지·승인 GET parser newop 누락 RED|
| 02593f 실제App 최초 |1FAIL,새region 5초 timeout|기존 반출 region은 visible, 신규 보호참조 region 부재. fixture/import 실패 아님|
| 9295b7 build |exit0|최초 App RED용 bundle; 기존 chunk warning은 자동 최적화하지 않음|
| 5c7232 최종 UIunit/type |9PASS/type exit0|기존7+coherent ref 혼동 반례2. 정확 수집·실행 범위만 의미함|
| 599384 실제App 4case |4PASS,7.6초, build exit0|등록/개정/과거회수·승인 명시복귀·유실 재확인·409/503·기존반출 보존|
| d7ff45 신규 프로젝트 ABA |별도1PASS,2.9초|동일 제품에서 POST 응답 보류→A/B/A→기존UNKNOWN/body보존·자동POST0·명시 동일명령 정산|

실제App은 기존 entry/CSS를 포함한 bundle과 Edge headless에서 same-origin 자산/API route.fulfill을 사용했다. 별도 HTTP listener·실 TLS endpoint·실 DB/권한/공급자를 호출하지 않았다. 실제App4와 추가ABA1은 **분리 실행 총5**이며 최종 단일 명령5PASS라고 쓰지 않는다. Main screenshot view에서는 고정v1 회수와 headv2 보존을 확인했다. 정밀 시안 대조·반응형 전수·정식 served/사용자 인수 PASS가 아니다.

마지막 ABA 검증은 프로젝트 전환과 보류 POST 응답 범위다. actor/client/API 교체 전체 matrix·별도 JSON 파싱 지연 전체·제품 내부 hash/finally 완결 barrier 계측까지 검증했다고 확대하지 않는다. transport/body 완료·현재 DOM과 별도 명시 재확인 정산을 관측했다.

## 5. 정확 명령 기록

모든 상대 경로 명령의 cwd는 등록 source 기준이다. 내부 실행 workspace의 절대 경로는 노출하지 않는다.

서버 초기 동결 64개(작성자56bda5와 Main9351d6의 대상):

```text
node --test --test-reporter=spec tests/unit/FN16/backup-reference-input.test.ts tests/unit/FN16/backup-reference-store.test.ts tests/unit/FN16/backup-reference-routes.test.ts tests/unit/FN17/approval-notification-reader-operations.test.ts tests/unit/FN17/approval-notification-request-transaction.test.ts
```

보완 후 changed 서버 대상과 UIunit/type:

```text
node --test --test-reporter=spec tests/unit/FN16/backup-reference-store.test.ts tests/unit/FN16/backup-reference-routes.test.ts
node --test --test-reporter=spec tests/unit/UI14/backup-reference-api.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
```

Main 실제 bundle/4case:

```text
node node_modules/vite/bin/vite.js build --config apps/web/vite.config.ts --outDir D:/Project/Anvil/.av3-data/ui14-protected-reference-20261028-01/bundle --emptyOutDir
node node_modules/@playwright/test/cli.js test --config D:/Project/Anvil/.av3-data/ui14-protected-reference-20261028-01/qa.config.cjs --output D:/Project/Anvil/.av3-data/ui14-protected-reference-20261028-01/results-green-01 UI14/backup-reference.spec.ts
```

Main 신규 ABA만 별도 선택:

```text
node node_modules/@playwright/test/cli.js test --config D:/Project/Anvil/.av3-data/ui14-protected-reference-20261028-01/qa.config.cjs --output D:/Project/Anvil/.av3-data/ui14-protected-reference-20261028-01/results-aba --grep "보류 POST 응답의 프로젝트" UI14/backup-reference.spec.ts
```

childenv TEMP/TMP=등록root/temp, ANVIL_UI14_BACKUP_REFERENCE_QA_DIST=등록root/bundle. Main 임시 config의 testDir는 등록source/tests/browser, testMatch=UI14/backup-reference.spec.ts, workers1/retries0/forbidOnlytrue/timeout15000/reporterline. use=baseURL https://localhost:3830,chromium/msedge/headless,ignoreHTTPSErrors=false,serviceWorkers=block,trace=off,screenshot=only-on-failure다. 기존 config를 범용 환경 fallback으로 바꾸지 않았다.

## 6. 원 실패·finding·fixture·도구 오류 이력

성공 결과로 원 실패를 소급 변경하지 않는다. 다음은 서로 다른 원인/범위이며 정식 동일 근본 실패3회로 합산하지 않는다.

1. 최초 source 준비의 pending과0050 점유는 직접 승인/비의미0053 재배치로 해소했다. 기존 후보 원문은 보존했다.
2. 작성자 최초 서버6efc11은32=25PASS/7FAIL,1742.3276ms였다. 제품의 REQUIRE_APPROVAL/null 선거절이 없어서 APPROVAL_REFERENCE_INVALID422가 나온 문제를 APPROVAL_REQUIRED412로 보완했다. 신규runtime 반환 타입 TS2739 1건은 명시 타입으로 교정했다.
3. store fake 오류1: 원6215의 column matcher가 id를 project_id suffix에서도 매칭해 저장 후 GET404/개정409/list0을 만들었다. B738에서 column boundary1곳과 id/project_id 분리 자체assert를 보강했다. 기존 기대를 바꾸거나 제품을 fake에 맞추지 않았다.
4. 다음21306a는store/routes20=14PASS/6FAIL,2398.7615ms/type0이었다. fake 오류2는 audit INSERT args[5]를 server command로 오해한 것이다. 실제 공통 SQL은 command=$5=args[4], operation=$6=args[5]다. 9DFA에서 해당 관측을 교정하고 두 귀속 assert를 추가했다. 이후 d8a591 store12PASS/1627.9166ms였다. 두 fixture 오류는 서로 다른 원인이며 원 출력은 남는다.
5. 작성자56bda5 서버64PASS/1852.9393ms/type9c1d19=0 이후 독립 finding을 받았다. TS에서는 ar.scope_digest 미사용·감사 exact scope/policy/client/source 및 원command hash 복원 누락을 확인했다. SQL에서는 receipt 행에 project_id가 없는데 complete가 공통 접근하는 문제를 실제0011과 대조했다. 추가3 반례는33dedf에서0PASS/3FAIL,1234.4998ms(단독digest/coherent본문은200!==503, receipt분기 부재)로 실제 RED였다.
6. SQL I2의 개정 previous NULL/FK MATCH SIMPLE 우회는 a8c9b0 정적1=0PASS/1FAIL,658.9541ms였다. v>1 previous_version/hash 명시 NOT NULL과 실제 version-1 행/fullref/hash 대조를 추가했다. 보완 후57ace1 store전체16PASS/2445.4229ms, typea3f1c9=0이며 Main9f1c43도 직접 확인했다. 정적 SQL 반례는 실제 PG compile/제약 실행의 증명이 아니다.
7. UIunit 최초7의4RED는 기존 policyEditor/승인 parser 부재였다. 작성자c1d274=7PASS/183.2364ms, 연결 뒤d6d99e=7PASS/255.0946ms로 구분한다.
8. UIquality의 coherent 다른id/version 고정조회와 개정 응답 계열 혼동 **두 반례는 수정 전에 실제 RED를 실행했다.** 작성자95c417에서0PASS/2FAIL,342.0401ms, 둘 다 Missing expected rejection이었다. 요청 id/version과 개정 c.targetId/headRef.id를 결박한 후 b330ad UI전체9PASS/209.3247ms, type141210=0이다. 이 사실을 source 수정 뒤 시험을 붙인 사후 양성으로 기록하지 않는다.
9. UI 최초 typef9fbe4의2건은 검증된 resource 반환 타입과 target scope callback 매개변수 타입 명시 누락이었다. 기대/동작 변경 없이 교정했다. 회수 버튼의 RETENTION 제한은 NEW/REVISE에만 적용해 정확 회수의 kind 독립성을 보존했다.
10. browser fixture의 초기 E8B8은 항상 REQUIRE_APPROVAL 정책을 반환하면서 NORMAL/LOST null승인을 허용하는 I1과 요청 payload 자기일치 I2가 있었다. C216/314B에서 정상·유실은 명시 AUTO, 승인 case만 REQUIRE_APPROVAL로 정확 policyRef/hash/gate를 일치시키고 각 POST 외피/payload를 독립 expected로 대조했다. 실제 강화4case 실행 전에 교정했으며 원89FF 최소UI RED와 섞지 않는다. 기존4 기대는 ABA 추가 후에도 유지했다.
11. 직접 esbuild require의9edc7f MODULE_NOT_FOUND는 환경/도구 선택 오류이며 제품 FAIL이 아니다. 설치된 Vite를 configFile=false, 실제 config와 같은 root/build, write=false로 메모리 검사한159739는 JS/CSS/HTML 출력 메모리 성공·파일 생성0이었다.
12. 읽기 조사 오류는 source 변경과 분리한다. 부가 검토본을 work_packages 아래로 잘못 지정한 원 준비 오류, contracts/command.ts 미존재, 0052_approval_request_notifications.sql.pending 추정명칭 오류는 실제 rg 목록/import 경로로 정정했다. 정확0052는0052_approval_in_app_notifications.sql.pending다. PowerShell literalglob0001*/0002*의 rg123도 읽기 오류이며 파일 영향0/제품실패0이다. 이후 실제 확인 경로를 사용했다. 해당 오류로 기존문서/SQL/환경을 수정하지 않았다.

합성 승인 시험은 실 공통 persistProjectReceipt 경로에서 authorize/consume stub의 정확 command/주체 귀속·도달·rollback을 관측한 범위다. 실제 FN11 권한 DB 판단이나 실제 승인 소비/RLS 집행이 통과했다고 주장하지 않는다. FN17 직접 인접의 cap10000/동일tx rollback/replay0도 fakeDB·원본 guard source 검수와 실제 DB 경합을 구분한다.

## 7. QA 생성·회수와 현존 증거

Main 전용 root는 D:/Project/Anvil/.av3-data/ui14-protected-reference-20261028-01이다. 생성시각2026-10-28T05:45:29.744Z, 최대30분/회수 상한06:15:29.744Z였다. author는 QA 생성·build/browser·정리·프로세스 조작을 수행하지 않았다.

Main954b76은2026-10-28T06:07:42.8415698Z에 정확 root의 소유자/nonlink/realpath/process0을 검사한 뒤59files/15dirs/3532477bytes를 정상 회수했다. 독립24a1b8은06:07:53.832105Z root=false/process0을 확인했다. 기한 내 정리됐으며 다음 QA에서 이 root를 존재 확인 없이 재사용하지 않는다.

정상 case의 backup-reference-verified.png는 Main이 view로 확인한 임시 QA 증거다. root 정리로 파일은 현존하지 않는다. 이미지가 현재 저장돼 있다고 주장하거나 사용자 배포 artifact로 링크하지 않는다. tool 실행 기록과 Main 현황 증거로 결과를 보존한다.

## 8. 미검증·잔여·다음 조치

- NOT_RUN: 실제 PG15 compile/DML/제약·GRANT·FORCE RLS·COMMIT·실경합·xmin wrap/subtransaction, 실제 DB 적용/rollback. 0053은 적용 manifest 미등록 pending source다.
- 미구현/제외: 실제 설치 resource descriptor·키/보호증거 provider, 키 enroll/unlock/recovery-kit·Secret, 실제 VERIFICATION 공급자, saveBackupPolicy/createBackup/수집/암호화·job/backup/restore·운영 전환·서비스·Agent·외부 비용.
- NOT_RUN: 정식 served/staging/운영 서비스·실 TLS접속·실 사용자 인수, actor/client/API/transport 교체 및 JSON 지연 전체 matrix, 전기기/반응형·시안 정밀 대조. 실제App의 이번 필수 경로만 확인했다.
- 보호 기존4/untracked8·이전 반출 완료코드·기존 SQL/시험/적용 manifest·Main 소유 현황을 보존했다. 미채택 계약과 P03 실제 실행 권한을 FN16 코드 승인으로 임의 확장하지 않는다.

Main이 최종 diff/allowlist/보호/독립 증거를 대조한 뒤 source checkpoint·통합과 WORK_PLAN/WORK_STATUS를 기록한다. 작성자는 이 결과 외 추가 작업·commit/push0으로 동결한다. 전체 FN16 잔여 계약/실제 공급자·DB 검증은 정확 후속 승인/계획과 별도 업무로 다룬다.

rollback은 Main이 이 source 단위의 정확20경로 diff를 선택적으로 복구하고0053을 적용하지 않는 것이다. 원 승인·후보·보고 이력을 삭제하지 않으며 실제 키·사본·원장·DB 행 삭제/실제 정책회수로 해석하지 않는다.

## 9. 최종 지문

아래는 결과 작성 직전 등록 source를 읽기 전용으로 확인한 지문이다. 기존 raw와 LF가 다른 파일은 EOL을 보존한 것이며 역사 baseline과 구분한다.

| 경로 | raw SHA256 |
|---|---|
| apps/server/modules/access/project-command.ts | 64BAE209E62FB5F624EBDA9E3C3746AB670F4B1A40E2AE7222A3898D33D8B8BD |
| apps/server/modules/projects/routes.ts | BA82A9CE6A040ACACF8C236F0196D588528FFDA6ADB7B143657C4A42A89A3C6C |
| apps/server/modules/approvals/approval-input.ts | D266C058E7163C2310251BFDBAF7F99B38FB13503DE45DC480EEED6B58DDE3AB |
| apps/server/modules/approvals/project-approvals.ts | E5B30B5FFDC9934700BADBC28DB1E8C8E1E8B4D3202C86DD01F33B72418CEA6D |
| apps/web/src/features/connections/policy-editor-profile.ts | B0AD1FCAA0E8FDC0D0803FF7ED73AFAEFC818803527F5747F34CD88F8DA5457C |
| apps/web/src/features/decisions/api.ts | 465726146D76AB97EB983007107B47AFC2119557C3AB1AA52F3B13DE60E9FDCC |
| apps/web/src/features/decisions/ApprovalsPage.tsx | 36E862501BDF9B3899723E019035CA8A8101E72625861F9CAFF7A0A7029096F8 |
| apps/web/src/App.tsx | 0C7D86F845262A14FEFB7F8F18C0C194AD6BC10666F05D1D03304120F65F3FD2 |
| contracts/runtime/backup-references-v1.ts | 9ABA88F85C313DFAA088F943B1E4AC16D6B66465DFF5C11DDCC13DF8CA406ACE |
| apps/server/modules/backups/backup-resource-provider.ts | A40B32DE3162E312DE6410207C4F190371CAEE7B1100D5B57EDC38BEDDF00189 |
| apps/server/modules/backups/backup-reference-store.ts | 7C532543F9A26573D98180FEFF9B17E7DB0196FC6EB65346B7F8F1E8066622EB |
| apps/server/modules/backups/backup-reference-routes.ts | 070C49C5BC48E0BF2BF97B4B6CF1A8EDA0E602892C6EB16A881B1D6C1D875E10 |
| apps/web/src/features/backups/backup-reference-api.ts | 0FF1B1426D750DF04C08C2F2251950A4FE3AB737371E87514FE85E47B3C15BD8 |
| apps/web/src/features/backups/BackupReferencePanel.tsx | F3297027E7244925DE70E2A1CA2F8B17A684017B23035B3A0043C8A8BC615ACF |
| db/migrations/0053_backup_references.sql.pending | 570031EA7B666F1AC82F65D7C804E3A217611453ED61D30BA2A27D706588D0FE |
| tests/unit/FN16/backup-reference-input.test.ts | 1C157382C29E94D40F36E811E89967DE550C58DE1711579952DAAC64157A40A5 |
| tests/unit/FN16/backup-reference-store.test.ts | 8552F87362F865C55380852210F3763BC011ECD4E024907A4B5B554B660B74AE |
| tests/unit/FN16/backup-reference-routes.test.ts | 0C31F942529FDF69CCB051B4CD0B6535CB20A3BA0B68CBD51697569DA06F4D08 |
| tests/unit/UI14/backup-reference-api.test.ts | B108A39BAC9FFA6C65ECB10D3060CA13714D70D057859E4BDB1A6F6CB21C1560 |
| tests/browser/UI14/backup-reference.spec.ts | 0107236DA0B489A26D7C6013D01F5FFDC92C9DE8E6422945BC14D57A05B78A04 |

raw=LF인 나머지 파일의 LF 지문은 위와 같다. EOL 차이가 있는3개 LF 지문:

- apps/web/src/features/decisions/api.ts: 42A416CC73253C7B79682444B5A4AB36621859506331D93CFCBE6E3651C86A88
- apps/web/src/features/decisions/ApprovalsPage.tsx: A52D262CCCBC1970DB988D7E5B140E2284164E71594C01DB2AAA6560B6893592
- apps/web/src/App.tsx: 14561BF6F35ABFB9BBB7E62AB9CCF206EEBF69D57124C36973E4EB2FC6E61C86

결과서 자체 SHA는 파일 저장 후 Main에게 별도로 보고하며 자기참조 hash를 본문에 넣지 않는다.
