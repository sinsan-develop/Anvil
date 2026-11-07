# FN09 등록 정의 실행 준비·Options 보관 source-only 결과

2026-11-06 / Main 어울 / 단일 기존 Primary 구현·Main 독립 검수.

## 판정

승인된 source-only 범위의 코드·화면·미적용 SQL·합성 검증을 인수한다. 실제 기능 상태는 **구현했지만 동작 미확인**이다. 실제 DB/SQL 설치·권한·서비스/브라우저·Agent 여정은 실행하지 않았다. 전체 FN09·Stage·작업계획서 완료나 사용자 인수 판정이 아니다.

직접 승인 C82C16EB3AAE2035B8273392549130702167396ACD34095A4617E2D21B6A228B, 채택 r2 BA7FD5B34BDFF9CFF26D2CA23C74AAFF685E8850054A27CE711827FCDC66DAD3, WI r5 56F197EFEB4500FD87DA0090AFFFFDE153CC07FDBF434567FB1E5B20372EE57B에 결박한다. 검증 전 HEAD는837f316d8ff30ca7eb8847ca4d65eed8f2a04a70이며 기존 개발 branch에서 수행했다. 허용33 중 실제 변경은30경로(수정27·신규3), 나머지3은 불변이다. 보호 비추적3은 보존했다.

## 실제 source 연결

- 기존 실행 reader의 후보 exact11을 유지하고 준비 전용 등록 exact13과 snapshot10을 추가했다. 원 등록 definition/environment 보호 조회·fullref/current·불변 Options body/UTF-8 bytes/hash를 결박한다.
- 저장·replay·고정 GET·state/page/inventory의 body 반환 전 원 보호 조회를 유지한다. RR 읽기 관측과 시작/종료 RC 인증 검산을 구분한다.
- 원 PoolClient/actor/txid의 준비·승인 요청/결정 예약·정산과 단발 receipt ID를 연결했다. 요청 알림은 원 요청 생성 비용에 귀속한다. 0077.pending은 최소 고정점·U/H/O·원/역방향 deferred 완결과 정확 호출 ACL을 선언하지만 적용하지 않았다.
- Web은 실제 등록 source 선택→원 명령→별도 승인 요청/결정·명시 복귀→저장→고정 조회를 연결한다. POST0 명확 거절·POST 유실 UNKNOWN·POST 성공 receipt 뒤 GET 실패를 구분한다. 저장 확정 뒤 새 명령/승인을 만들지 않고 원 ref만 재조회한다.
- capabilityRef는 기존 제공 원 ref를 명시 선택한 미검증 입력이다. 제공자가 없으면 SOURCE_REQUIRED이며 가짜 UUID·다른 ref 전용·새 능력 공급자·실행 권위를 만들지 않는다. 기존 후보11/9의 보고 검사와 보호 기준은 유지한다.
- 모든 실행 권한 false·NOT_AUTHORIZED와 능력/예산/원문권한/호스트 미검증 조건을 보존한다. 실제 START 등록은 후속 FN08이며 아직 이 결과에 포함하지 않는다.

## Main 검증

| 검사 | 실제 결과 |
|---|---|
| 변경·직접영향15 unit 파일 최종 | e4361d:201PASS/fail0/skip0/6136.7871ms/exit0 |
| 타입 | 189e18:exit0 |
| Web build | 1612e3:513모듈·501ms/exit0, 기존 큰 chunk 경고 보존 |
| SQL 형상·원 guard 보존 | 212027:21PASS/fail0/skip0/175.2832ms/exit0. 최종201에 같은 파일 포함 |
| Node 승인/quota 부분 | c6816d:13PASS/fail0/skip0. 최종201의 부분 집합이며 합산하지 않음 |
| inventory 직접 부분 | 040276:21PASS/fail0/skip0. 최종201에 포함 |
| 최종33·WI·보호3·빈 index·diff | 검사 전후 지문 일치, 허용 밖 제품 변경0, diff exit0 |

최종 unit 명령:
```powershell
node --experimental-transform-types --disable-warning=ExperimentalWarning --test `
  'tests/unit/FN08/execution-preparation.test.ts' `
  'tests/unit/FN08/execution-preparation-qa.test.ts' `
  'tests/unit/FN08/execution-preparation-pages.test.ts' `
  'tests/unit/FN09/execution-preparation-approval.test.ts' `
  'tests/unit/FN13/project-storage-quota.test.ts' `
  'tests/unit/FN13/project-storage-quota-writers.test.ts' `
  'tests/unit/FN13/project-storage-quota-schema.test.ts' `
  'tests/unit/UI04/execution-preparation-api.test.ts' `
  'tests/unit/UI04/execution-preparation-approval.test.ts' `
  'tests/unit/UI04/responsible-session-approval-api.test.ts' `
  'tests/unit/UI08/execution-preparation-approval-api.test.ts' `
  'tests/unit/UI05/preparation-history-api.test.ts' `
  'tests/unit/FN16/context-preparation-inventory.test.ts' `
  'tests/unit/FN16/context-preparation-approval-inventory.test.ts' `
  'tests/unit/UI04/registered-preparation-options-flow.test.ts'
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
node node_modules/vite/bin/vite.js build --config apps/web/vite.config.ts
git diff --check -- <허용33>
```

독립 읽기는 Node 직접6, Options3, SQL cost/context/예약·정산·guard/ACL 및 최종 인터페이스, UI 불변4/최종5와 fixture 보완1에 한정 C0/I0/M0를 반환했다. 실제 PG/권한/COMMIT·전체 제품 인수로 승격하지 않는다. 기존 생성 시험의 전체 diff는 Main이 직접 대조했고 검토 담당자는 그 근거와 현재 본문을 교차 확인했다. 검토 담당자의 Git diff 직접 명령은 접근 오류로 미실행인 사실도 보존한다.

## 실패·보정 구분

첫 Main 최종 검사 f4caba는200중193PASS/7FAIL이었다. 불변 생성·첨부 fixture가 정상 COMMIT에 command 태그를 반환하지 않아 원 AccessRepository가 TRANSACTION_STATE_UNKNOWN으로 거절했다. 같은 HEAD 원 제품8모듈을 메모리 공급한 control57732a에서도 동일7이 재현됐다. 제품·support fixture·기존 기대값은 바꾸지 않고 허용 writer 시험의 생성 전용 정상 exact rows/rowCount 응답에만 태그를 보강했다. undefined·잘못된/명시 undefined 태그·raw 거절·유실을 정상화하지 않는 추가 음성1을 포함했고 최종201이 통과했다.

초기 새 코드의 재인증 과잉·요청 만료 전달 오류, receipt 미보존·저장 후 편집 노출·POST0 거절을 UNKNOWN으로 바꾸던 오류는 실제 class/API/DOM의 RED→GREEN으로 보정했다. fixture 공유 참조 오염은 독립 복사로 분리하고 기대값/guard를 유지했다.

도구의 줄바꿈/달러 replacement·가상 entry/비동기 정착·메타데이터 파싱 오류는 제품 실패와 구분했다. native CRLF 경고·큰 bundle 경고를 숨기거나 설정/기준을 바꾸지 않았다. 같은 달러 토큰 작성 오류 재발을 막기 위해 도구 literal 삽입은 반환 callback을 사용하도록 했다. Main 제품 작성0·임의 신규 agent/chat/branch/자동화0이다.

## 미실행·잔여

- 실제 PG 설치/SQL 문법·role/RLS/trigger 순서·COMMIT 원자성·경합/내구: NOT_RUN.
- 실제 서버/네트워크/served browser 시각·SDK/Agent/비용/실행/키: NOT_RUN.
- 기존 definition 저장의 작은 소수/최소 양수/지수/음수0 canonical 왕복: 미검증. 신규 Options helper는 원 canonical 문자열을 보존하며 입력 범위 축소·반올림을 하지 않았다.
- 실제 능력·예산 공급·executor 권위 및 FN08 START 등록·첫 Agent 실행: 미구현/별도 선행. 이 결과를 그 증거로 사용하지 않는다.
- 기존 DB·사용자/권한·Secret·서비스·J3/P03 R3·Oracle/운영은 변경하지 않았다. 새 실제 QA 자원 생성/회수0이며 합성 자료만 사용했다.
- private push·원격 동일성·PR/main·WSL 배포와 사용자 인수는 이 결과로 수행/주장하지 않는다.

## 최종 local raw 지문33

| 저장소 기준 경로 | bytes | SHA256 |
|---|---:|---|
| contracts/runtime/execution-intent-v1.ts | 2779 | 6CE04FA707920A86B1F67B62B1D85380CE3DA4DC51B333182B2B277E07483736 |
| apps/server/modules/executions/preparation-input.ts | 3233 | DD72F944E9F8C2CEA475C262024A385F9ECFE1C39ED8829DC60F6729F9C42FA3 |
| apps/server/modules/executions/project-execution-preparations.ts | 17053 | 6DB36788A633E0111BD33D5EC9607C79EE28A006E38220FA90AEA82F249D43B8 |
| apps/server/modules/approvals/execution-preparation-approval-candidate.ts | 5483 | B96803F04AEFA43AE1F1332833057FD2A7E5B949AFC73468EDC5B26E334A9445 |
| apps/server/modules/approvals/project-approvals.ts | 53103 | 8D9BFB36F2A3A85B2D834C1F57B4D32BD0485949E8EEA53039CA33B4A97531DC |
| apps/server/modules/projects/routes.ts | 86599 | 305969D2EF35D76A218BC3E1D4A8DADB85FEE7807DCB46C23484CEEBC123C8EB |
| apps/server/modules/projects/project-storage-quota.ts | 45942 | 0A3B2CC56648567D88347EFCFB300B3395C5FB09BB23D16F0094D2304F2A8E9A |
| apps/server/modules/access/project-command.ts | 40985 | DB1F40FDCE2617BC3173F1BA85088E94F3C20D362E57F4D35B692ED4908DBDCC |
| apps/web/src/features/workspace/execution-preparation-api.ts | 18155 | BF452223E280608B4478409905639FCA9F4751434BAAF1EB5CAF348643ECC11E |
| apps/web/src/features/workspace/execution-preparation-approval.ts | 4622 | 3B2A6D61F1A1111B1C5610E17FA97677904820E9E51456E5675259B6CF4CA7CB |
| apps/web/src/features/workspace/ExecutionPreparationEditor.tsx | 16951 | B2B02DE46B15A487B64F75F1CA043D2BC6042295021A811A7BE215223C20CA8D |
| apps/web/src/features/decisions/execution-preparation-approval-api.ts | 3960 | 6954A7A132D2D33E1BFC31A565066CCBBBE9C5AEAB0D070CBADF05A4500B1B5E |
| apps/web/src/features/session-detail/preparation-history-api.ts | 9831 | 1A9C0E30FD60F03D3868C236332A43CF635D093A914FE78D3604561D368A1855 |
| apps/web/src/features/session-detail/PreparationHistory.tsx | 11119 | FDA69A05219C9DDB59B8023E12EA26A39E46AF4F65C6B8AEB587FFFEB9DBEFE7 |
| apps/web/src/features/workspace/responsible-session-api.ts | 23159 | 2FA9E08B95E08125BAF1AC4A1002635EE01E2F1AB9F68AF16465A8881573DF12 |
| apps/server/modules/backups/context-preparation-inventory.ts | 46723 | 097F0140041B1C84932BB7BF543D70863232CF014A5C44D2E2B27F62FC1D22FE |
| tests/unit/FN08/execution-preparation.test.ts | 19321 | FCC4367BC88458241F4C595510F11642C13AF6630B10EC59774599877E3A5174 |
| tests/unit/FN08/execution-preparation-qa.test.ts | 5740 | 2A5C867703CDFEB2A62246E2777F0C7AEEAE3AB3E5A9820C2C8974C203A32E8A |
| tests/unit/FN08/execution-preparation-pages.test.ts | 8490 | B50804C8B7BB2277731C94E31088EF4218F64D6684C602F1C92927C60D9A1D6F |
| tests/unit/FN09/execution-preparation-approval.test.ts | 47017 | 53E2638E2347D738FD16E179BB884354D5A4C01D728A78CAF4175802F7525D51 |
| tests/unit/FN13/project-storage-quota.test.ts | 31293 | 1FE017AD0553F733FCD7546E0E032DFFB11501F4A306CA1DE80651112ABCF0EB |
| tests/unit/FN13/project-storage-quota-writers.test.ts | 66729 | 401A93A00B87D6DC202AF41EBDDBAB1F3F6DEDA51B3539404B1C0276729D4F25 |
| tests/unit/FN13/project-storage-quota-schema.test.ts | 19089 | 8E3B74044B7EC097896570B49EB909F86A10AB0B4C09D5371DF21A5E6C92FF5F |
| tests/unit/UI04/execution-preparation-api.test.ts | 13875 | D34FFEDEAB74C61D02242541CCFC88A576AA321129E5AAF7DFC4299D87884515 |
| tests/unit/UI04/execution-preparation-approval.test.ts | 8000 | 62FD5A9B0B9728A0F56FA25FC4799C57AD79551C14ECD9EFBE53F1F21DA6AE39 |
| tests/unit/UI04/responsible-session-approval-api.test.ts | 18730 | E8F74FAB782200D271099268E31D7EA373648A2EFA2F89019C801F6D1FB69132 |
| tests/unit/UI08/execution-preparation-approval-api.test.ts | 5259 | 26FC39AE6CE4AB3FCB5AFD14B09E2B4FBDC6BA5A4D8A30D7A8664893C76338DC |
| tests/unit/UI05/preparation-history-api.test.ts | 7241 | AB0AA84976D659E548D98DA0552ECCC2DBCF382E841EEBB362AA5B7564038C31 |
| tests/unit/FN16/context-preparation-inventory.test.ts | 40458 | 39DDE6201F02CFE99BBFC1249DF7566120C5071C57981F68748552548E2E3546 |
| tests/unit/FN16/context-preparation-approval-inventory.test.ts | 50368 | 940F794F67DF95C2B89E624E639BE8F193065BB82A2A85E4F7A94E574A38E4E2 |
| db/migrations/0077_registered_execution_preparation_options.sql.pending | 156908 | E14BC22ABDFA9BDB55D55D993F2AA439E05796613A2A301210630A977B1A0608 |
| tests/unit/UI04/registered-preparation-options-flow.test.ts | 15573 | A3CDD498133D0A7436B337A38A42B07A81EC2A91D4DAF17F6CB8EE191E8CC912 |
| tests/unit/UI04/registered-preparation-options-fixture.ts | 14800 | 51125876A4DBF050646FA7F0EC15F19385868F8F13C35E92119599A3F0CB6620 |

검사 후33은 모두 동결값과 같았다. Git 줄바꿈 정규화 후 blob/다른 환경 raw와의 동일성은 별도 대조 대상이며 위 값은 local raw 지문이다.

## 다음 조치·복구

Main의 source checkpoint로 통합하고 기존 단일 Primary에게 승인된 FN08 WI r2의 TEST_ONLY를 순차 전달한다. 완료된 FN09 부분 검사를 코드 불변 상태에서 반복하지 않는다. 실제 기능/Stage/전체 계획의 잔여 검증은 원 범위로 유지한다.

source rollback은 이 승인 delta의 정상 revert이며 보호 비추적/다른 변경을 손대지 않는다. 0077은 미적용이므로 실제 DB rollback은 없다. 실행/키·데이터·서비스 복구를 자동으로 수행하지 않는다.
