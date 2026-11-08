# IX01 현재 TC01 격리 실행 후보 — 2026-11-08

상태는 SOURCE_BOUND / PREFLIGHT_PENDING / ACTUAL_EXECUTION0이다. 작성 소유는 기존 Primary 한 명이며 Main이 독립 검수와 PMO 결정 요청을 맡는다. 이 문서는 실행용 plan/approval 파일이나 소진 intent를 발급하지 않는다.

## 1. 기존 승인 범위와 정확 실행 대상

이번 소스 재결박 기준은 실제 Git commit 4b266f616c8726386c2092639007468d04f85d35이며 작성 branch는 codex/av3-ix01-current113이다. 113개 보완의 실행 sourceHead는 실제 소스 commit d7a2c5542f8feca105ebd5dc4b686b3613b01704에 결박한다. 후보 문서를 게시하는 후속 commit과 실행 코드의 sourceHead를 구분한다. 실행기의 고정 리터럴은 이 실행 소스의 currentProfile을 따른다.

신규 전용 격리 PostgreSQL에서 현재 스키마113개를 설치하고 실제 App.inject·AccessRepository 로그인/재인증으로 TC01 한 번을 수행하는 후보이다. TC01은 내장 방법론 COPY→v1 검토→그래프 개정 v2→v2 검토→v1 검토로 v2 확정 거절→정확 v2 확정→CONFIRMED_REFERENCE로 프로젝트 생성→보호 적용본 조회→원본 v3 개정 후에도 v2 snapshot/출처 보존이다.

신산님의 ‘IX01 J3 횟수 상관없이 승인’ 직접 지시와 원 인간 승인시각은 그대로 보존한다. 소스 SHA나 스키마 개수 변경 자체를 새 권한이나 재승인 사유로 삼지 않는다. 현재113 소스·자식·신규 자원의 실제 효과가 기존 승인 범위인지 Main이 원문과 대조한다. 각 신규 실행에는 새 고유 approvalId/소진 기록과 실제 발급한 유한 외피 시각을 결박하며 만료된 과거 grant를 연장·재사용하지 않는다. 실제 실행은 현재 도구·자원·소스·독립 검수와 정확 외피를 확인하는 별도 Main 절차 전까지0이다. 과거 J3 및 UNKNOWN 자원은 조회·재사용·삭제하지 않는다.

## 2. 현재 확인과 실행 전 미확인

이번 작성에서는 로컬 Git blob14개와 SQL113개 원시 바이트·순서만 검산했다. SSH/WSL·Docker·PG·npm registry·실제 자식 호출 및 plan/approval/intent 발행은 0이다.

기준 WORK_STATUS 17829행의 지정 daon@SINSAN 읽기 접속은 banner exchange: Connection to UNKNOWN port -1: Connection refused, exit1이다. 17841행에는 PMO 회복 근거 미확인, 17932행에는 같은 접속 오류가 남는다. 이는 기존 기록의 인용이며 이번 재접속이나 복구 증거가 아니다.

| 선행 | 현재 | 필요한 다음 근거 |
| --- | --- | --- |
| WSL/SSH | 회복 미확인 | PMO의 정확 복구 근거·접근 수단 |
| source checkout | 원격 미준비 | 정확 신규 경로·sourceHead·clean Git·LF 원문 |
| gitHash/dockerHash | 미실측 | 지정 도구의 실제 SHA256·root 소유·nonlink·비쓰기 |
| Node/npm/daemon/image | 소스 기준값만 있음 | 현재 호스트 실제 일치 관측 |
| 신규 경로·PG/network | 부재/소유 미확인 | 고정 자원·부모·UID·링크·기존 충돌 대조 |
| approvalId/issuedAt/expiresAt | 미발급 | 사용자 결정과 정확 원문 해시·새 시간 창 결박 |
| 실제 TC01 | NOT_RUN | 기존 직접 지시의 실제 효과·새 Main 외피·현재 선행 검산 |

승인 JSON은 사용자 결정 원문을 조회하거나 전자서명으로 검증하지 않는다. Main이 직접 승인 원문과 새 approvalId·실제 planHash/approvalHash를 외부 감사 기록에 결박해야 한다. JSON 자체를 작성할 수 있다는 사실을 실행 승인으로 삼지 않는다.

## 3. requiredSources14 원시 지문

CurrentPlan.sourceFiles는 아래 순서의 정확14행이다. 각 행은 path/sha256 두 키만 가진다. bytes는 이 문서의 검수용 열이다. 아래 값은 실행 소스 d7a2c5542f8feca105ebd5dc4b686b3613b01704의 git cat-file blob 원시 바이트 SHA256이며 Windows CRLF checkout 지문과 구별한다. Main이 실제 소스 commit 뒤14행을 재산출했다. 이 결박만으로 실행 선행·자원·기한이 충족되거나 실제 실행이 승인 처리되는 것은 아니다.

| 순서 | 경로 | bytes | SHA256 |
| --- | --- | ---: | --- |
| 1 | scripts/qa-ix01-current-journey.ts | 42738 | c1efed7d51ffbfb820b3d458e241ef201fc3ce06e286aa8570e62e86f6616271 |
| 2 | tests/integration/IX01/current-methodology-journey.test.ts | 5956 | 3e4de3fe9a45cc092431bbf52160a46b76ff933f3232ab44817da46c0adcb9a0 |
| 3 | scripts/qa-ix01-schema-closure.sh | 35588 | b7b730518bf917f0462ee48fbc2569444f50d141d1b28b49c94bec1680daf733 |
| 4 | docs/04_test_reports/AV3/IX01/ACTUAL_JOURNEY_SQL_ALLOWLIST_20261104.tsv | 15807 | 0da3c8558445d7984731863d45261192a11c37337b93e3dd99941b00133745dd |
| 5 | docs/design/공식산출물_양식정의.md | 11130 | 622ffc6db4ccc26ae07c785c91b114467019b21571b728a71dea05d206816b13 |
| 6 | docs/design/문서작성_공통기준.md | 9067 | 85ec190976ce45af49b4f57fb5745d193b41640cfc62f5cbd19aa4711cb03f07 |
| 7 | docs/design/기본방법론_상세검토안.md | 8533 | 1373688f969e578da3a38c52f619b878d01fdf999b717fd516ebf638d8c897d1 |
| 8 | package.json | 943 | e61265b7bf4e9e31445be12048f574e0cb7940c5888922e7f087603e8b10eede |
| 9 | package-lock.json | 76254 | ca586e2dd02c11c41da55a64aa4f07d3848936fe44dca1897f8586ac4fb0f1d6 |
| 10 | tests/integration/IX01/current-schema-baseline.ts | 6478 | ae635f1f5cecc25d2adc120bd2e519c1d093a0b32b8e3a9f6c66293ba15da221 |
| 11 | tests/integration/IX01/current-schema-installation.ts | 3402 | 0dbd658f8b9d2b484b731b04342db33d2dec216ca9ed9ac0810c9c32323f3cc1 |
| 12 | tests/integration/IX01/methodology-copy-application-scenario.ts | 12887 | d27416d76b08a1e97eb8672c61615b36816a3ee43bb5fbd7642d946ae40fe3e7 |
| 13 | tests/integration/IX01/journey-context-lifecycle.ts | 694 | 90d4107fd6e7c15545333afcb0ebab2d06c44660605166233d1198dae91736c9 |
| 14 | tests/integration/FN12/result-qa-fence.ts | 1110 | 97308aeb2a45121be699c4ac2d07a6147efbe12534e3aacbcdc291bffa1f8224 |

명시 해시 목록은14개다. 전이 import 전체·설치 dependency의 재귀 바이트 검증을 뜻하지 않는다. 나머지 tracked 소스는 exact Git HEAD/clean·H 플래그 검산, dependency는 고정 lock/integrity 기반 npm ci 경계다. R9 원문은 고정 SHA를 검사하고 고정 stdin main 진입 한 줄을 제거한 소스 블록만 import한다. 역사 R9 실행/프로필은 호출하지 않는다.

## 4. 113 SQL의 정본과 설치 경계

readCurrentSchemaManifest는 §3의 LF TSV15,807B·SHA256을 먼저 검사한다. 역사105행의 순서를 보존하고 아래8행을 붙인다. verifyCurrentSchemaSources가 113개 각각의 id/path/size/hash와 순서를 모두 확인한다. 설치 helper는 TSV와 모든 SQL을 첫 await 전에 사본으로 고정한다.

전체113개는 3,494,304B다. 순서 검수 보조값 JSON.stringify(rows.map(r=>r.path))의 UTF-8 SHA256은 4cacf7fd28c8e69ecffd3f060c4a24b096ef1cc401ac453c5602c59fb0ef1db5이다. 이는 새 plan 필드가 아니다. currentLedgerHash는 canonical한 ordered id/checksum 투영으로 d689e5b783caea157e3e420a8ee201f29f84bceda5127fc514d4d67493433d03다.

| 순서 | 후속 경로 | bytes | SHA256 |
| --- | --- | ---: | --- |
| 106 | db/migrations/0075_user_common_setup_definitions.sql.pending | 64651 | f9dd6b1730da8d5428c6ccb66b3169758baa0c0a5ecc789f7c426559171f472c |
| 107 | db/migrations/0076_native_first_receive.sql.pending | 529020 | a8dc4ccdf2a603888dfb993f22712cf74677db59104fc59be80e0442c6ba1ba9 |
| 108 | db/migrations/0077_registered_execution_preparation_options.sql.pending | 156562 | e2a2451e693ebf50026595691b547af39a2410e0c4a217aaf0e0e8a7b70920a8 |
| 109 | db/migrations/0078_start_execution_material_registration.sql.pending | 27060 | 7a1b7ea71198e59b589a2df3356d8f6488fe0c4a9615daa4a135589d4a3d91fc |
| 110 | db/migrations/0079_material_credential_namespace_binding.sql.pending | 7776 | 4297c897e32c8141b03d6c9741c7217a4cdadbda6faf39abc521e9f551592deb |
| 111 | db/migrations/0080_node_decisions.sql.pending | 50319 | 4cf6922374cb640cc01fc6e56858eb6b17247acab720cfdadd76b70bc6d1ad74 |
| 112 | db/migrations/0081_execution_start_origins.sql.pending | 52536 | e642d2b48565dc17e5bbb35c1996a48abcaf0c1bbd988b15cde4a5c95c0f34de |
| 113 | db/migrations/0082_fn09_origin_reuse_synthetic_start.sql.pending | 230239 | 4cbca6ad03aa9b4ac8b7ce485ca1dc9e34df8692cd7dc6a0b5de716101fa84b2 |

0076은 마지막 바이트까지 전체529,020B를 전달한다. 파일을 문장/BEGIN/COMMIT 단위로 다시 나누지 않는다. R9 buildPsqlArgs의 0037 provider 파일 single-transaction 예외를 유지하며 나머지는 원문 transaction 경계 그대로다. SQL 뒤 원장 append는 별도 호출이다. 따라서 DDL 일부 적용·COMMIT 응답 유실·원장 미반영이 가능하다.

부모와 자식은 실제 전달된 원장의 exact id/checksum113행 집합을 각각 검사한다. 원장 집합만으로 적용 순서를 증명하지 않으며 부모의 SQL/원장별 진행 영수증을 함께 읽는다.

## 5. 신규 고정 프로필과 도구

| 항목 | literal |
| --- | --- |
| source | /home/daon/anvil-ix01-current-tc01-20261108-a1-qa |
| receipt | /home/daon/.local/share/anvil-v3-qa-receipts/ix01-current-tc01-20261108-a1 |
| artifact | /tmp/anvil-v3-ix01-current-tc01-20261108-a1 |
| container | anvil-ix01-current-tc01-pg-20261108-a1 |
| network | anvil-ix01-current-tc01-net-20261108-a1 |
| database | anvil_v3_ix01_current_tc01_20261108_a1 |
| owner | IX01_CURRENT_TC01_20261108_A1 |
| host UID / PG uid:gid | 1000 / 999:999 |
| daemon ID / name | e3349f1d-dbfc-478a-96d9-295bf6c6839e / SINSAN |
| image | sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f |
| Docker socket | unix:///var/run/docker.sock |
| Node | /opt/node-v24.22.1-linux-x64/bin/node |
| Node SHA256 | e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb |
| npm CLI | /opt/node-v24.22.1-linux-x64/lib/node_modules/npm/bin/npm-cli.js |
| npm CLI SHA256 | 8e5f6f3429f8cdbe693cdc29904e9d5a7b127a494bd15c804bd54c7403bfcbe7 |
| npm package | /opt/node-v24.22.1-linux-x64/lib/node_modules/npm/package.json |
| npm package SHA256 | f6478d5600180a23f73e4217610c7709a71cedb4ae13f6c3e15ecb457f5d4fd6 |
| npm version | 11.19.1 |
| Git / Docker CLI | /usr/bin/git / /usr/bin/docker |

gitHash/dockerHash는 미실측이다. 나머지 도구/daemon/image 리터럴 역시 이번 최신 호스트 관측이 아닌 소스의 비교 기준이다.

PG는 pull never/network none/read-only/cap-drop ALL/no-new-privileges/log none/64 pids/512MiB/1 CPU다. tmpfs data256MiB·socket16MiB·tmp16MiB에 noexec/nosuid/UID·GID999를 지정한다. host port publish·bind mount·외부 volume을 거절한다. label은 정확 owner/instance/plan 세 개며 instance는 sourceHead 앞32자다.

새 bootstrap/migrator/app와 migration이 정의하는 한정 reader/provider role을 사용한다. 초기 bootstrap superuser, 설치 중 migrator CREATEROLE과 한정 membership을 허용한다. 내부망 연결 전에 migrator NOCREATEROLE 및 임시 membership 회수를 실제 role 검산으로 확인한다. 기존 운영 역할·DB를 대상으로 삼지 않는다.

## 6. 실제 발급 전 외피와 호출 형식

CurrentPlan의 정확9키는 schemaVersion,purpose,profile,sourceHead,issuedAt,expiresAt,gitHash,dockerHash,sourceFiles다. schemaVersion1, purpose IX01_CURRENT_TC01, profile은 §5 owner, sourceHead는 실제 소스 commit d7a2c5542f8feca105ebd5dc4b686b3613b01704의 exact40자 SHA다. issuedAt/expiresAt은 안전한 정수 epoch milliseconds이고 issuedAt<=now<expiresAt, 양수 차이 최대1,800,000ms다. sourceFiles는 §3 exact14행이다. 현재 시각·새 도구값이 없으므로 유효 plan JSON은 아직 만들 수 없다.

승인 외피 exact9키는 schemaVersion,purpose,profile,decision,approvalId,planHash,sourceHead,issuedAt,expiresAt다. purpose IX01_CURRENT_TC01_RUN_APPROVAL, decision ALLOW_ONE_RUN, schemaVersion1이다. 새 UUID approvalId와 시각은 미발급이다. sourceHead·시각은 plan과 같고 planHash는 실제 plan UTF-8 원문 SHA256이다. approvalHash는 실제 approval UTF-8 원문 SHA256이다. 각 JSON 최대32KiB·중복키 거절을 유지한다. null/placeholder를 실행 JSON 값으로 채택하지 않는다.

고정 파일은 receipt 리터럴 뒤 -plan.json 및 -approval.json을 붙인 형제 파일이다. UID1000/0600/nonlink/nlink1/실경로를 검사한다. 실행 권한이 확정된 뒤 Main이 해당 파일 발급·원문/hash·사용자 승인 관계를 기록해야 한다.

예정 호출 외형은 env -i [고정 Node 절대경로] [고정 source/launcher 절대경로] --run [실제 planHash] [실제 approvalHash]다. 이는 현재 실행 명령이 아닌 인자 명세다. 부모 env 빈 집합·execArgv 빈 배열을 요구한다. NODE_OPTIONS/loader 최초 preload 금지는 외부 호출 선행이며 이미 로드된 코드가 소급 검증할 수 없다. env 도구의 경로/지문은 현재 script에 별도 고정돼 있지 않다.

## 7. 원래 실행 순서와 수명

1. source HEAD/clean·14개 원문·도구/부모/소켓 신원 및 SQL113를 검산한다.
2. receipt exclusive mkdir→intent.json wx/0600 생성→fsync/readback/부모 fsync한다. 기존 receipt면 ALREADY_CLAIMED다. mkdir/intent 불명도 재시작하지 않는다.
3. 전용 npm 설정/cache와 node_modules를 만든다. npm ci --ignore-scripts --no-audit --no-fund 및 고정 registry/lock/integrity를 사용한다. 실제 npm registry 접속은 새 외부효과 범위다. node_modules는 Git ignore 영역이며 전체 dependency 바이트를 sourceFiles14로 검사하지 않는다.
4. PG를 none 단독으로 생성/기동하고 최종 postgres/ready, DB 이름·owner·socket 접속과 role 상태를 검사한다.
5. SQL113와 개별 원장 append를 순서대로 호출하고 exact ledger를 확인한다.
6. 새 임시 암호를 SCRAM 설정하고 HBA readback/reload와 세 role 암호를 검사한다. 임시 권한 회수·REVOKED role을 검사한다.
7. 새 internal bridge full ID/name/driver/labels·빈 endpoint→PG none 단독→none 비강제 disconnect1회→PG endpoint0→bridge connect1회→양방향 단일 endpoint/이름/주소를 확인한다.
8. 원 plan/approval/sourceHead/ledgerHash/container/network/주소/기한의 exact handoff를 handoff.json과 artifact/owner.json에 저장한다.
9. 자식은 child-intent.json을 생성하고 두 실제 DB 접속의 DB/role/주소/port/비superuser/비bypass/NOCREATEROLE 등을 검사한다. ledger113·빈 사용자 원장 확인 후 공식 seed·새 합성 사용자/암호·임시 설치 인증키, 실제 로그인/재인증을 거쳐 TC01을 호출한다.
10. exact 자식 결과/TAP/기한·소유 확인 뒤에만 소유 PG stop/rm→network rm→부재 검산→최종 결과 기록을 한다.

전체 승인 창은 최대30분이다. PG 창은 생성 직전부터 최대10분이며 전체 종료와 min이다. child handoff는 그 잔여와90초의 min, 내부 node:test는80초다. 고정 자식 argv는 --test --test-isolation=none --test-reporter=tap 및 단일 절대 파일이다. 전용 subprocess에서 실행하며 NODE_TEST_CONTEXT 추가 환경을 허용하지 않는다.

일반 Git/Docker 관측10초·SQL 기본30초·npm ci 최대600초가 전체 잔여로 제한된다. 로컬 UTC와 performance.now 단조 경과의 보수적인 값을 유지한다. timeout에는 직접 시작한 로컬 Git/Docker/npm/Node 자식에 SIGKILL을 요청한다. 이것은 원격 SQL 정착/rollback·daemon 중단·간접 자식 전체 회수 증거가 아니다. 정상 확인 뒤 docker stop/rm과 CLI timeout 종료를 구분한다.

## 8. 판정·UNKNOWN·잔류

| 판정 | 근거와 처리 |
| --- | --- |
| CLEANED / TC01_PASSED | SQL113/원장·역할/SCRAM/회수·인계·자식 PASSED/TAP/기한·PG/network 부재와 최종 record 확인 |
| REJECTED | 원 승인/plan/사전 검산 부적합 또는 기존 소진, 새 런타임 효과 금지 |
| DDL_REJECTED | 기존 psql terminal 오류 분류, 이전/부분 적용 가능성과 자원 보존 |
| INSTALL_UNKNOWN / LEDGER_APPEND_UNKNOWN / LEDGER_READ_UNKNOWN / LEDGER_MISMATCH | 설치/원장 불확정, 후속 설치·망·child·cleanup0 |
| STOPPED_단계 / UNKNOWN | 소유·기한·CLI·인계·자식·정리·기록 실패, 자동 재실행·추가 진단·삭제0 |

자식 결과는 exact schemaVersion1/purpose IX01_CURRENT_TC01_CHILD_RESULT/원 handoffHash/ledgerCount113/status PASSED다. TAP의 ok 1 - IX01 TC01 현재 격리 저장 여정, tests1/pass1/fail0/cancelled0/skipped0/todo0, exit0/signal null/빈 stderr를 함께 검사한다. skip을 합격으로 세지 않는다.

감사는 receipt/intent.json,handoff.json,child-intent.json,child-result.json,result.json과 artifact/owner.json이다. 단계에 따라 일부 파일이 생성되지 않을 수 있다. PG 생성 또는 연결 불명은 부모 공개 결과에 ID가 아직 없을 수도 있다. claimed 후 실패 결과 기록은 한 번 시도하나 그 기록 자체도 불명일 수 있다. 최상위 실패는 고정 IX01_CURRENT_RUN_REJECTED로만 나와 세부 단계가 없을 수 있다.

CLEANED여도 source checkout/node_modules, receipt의 npm-cache·설정과 감사, 승인 형제 파일, artifact 원문은 남는다. 현재 cleanup은 PG/network만 제거한다. 전체 디스크 잔여0을 의미하지 않는다. 감사 수신 뒤 이 자료의 검산/반출/삭제는 별도 정확 QA 정리 범위다. UNKNOWN에 재조회·kill·삭제 권한이 자동으로 생기지 않는다.

## 9. 미검증과 실제 실행 전 확인

소스의 합성 controller/113검산/설치순서/type·로컬 무해 Node timeout 증거는 기존 WORK_STATUS 기록이다. 이번 113 소스 보완의 집중3파일 합성 시험은 24PASS/skip0이다. 실제 자식 시험을 실행한 결과가 아니다. 실제 runner/자식·SQL 설치/RLS/동시성·TC01·브라우저·서비스/Agent는 NOT_RUN이다.

현재 PostgreSQL/image에서113 SQL·role guard가 실제로 설치되는지는 미확인이다. 최초 source/node_modules/artifact 부재 조건과 source clean을 맞추기 위해 기존 자원을 삭제하거나 덮어쓰지 않는다. 실제 충돌이나 설치 거절은 원 증거를 반환한다.

Main은 기존 J3 횟수무제한 직접 지시와 이 후보의 실제 효과를 대조하고, 현재 호스트 실측·새 전용 자원 부재·정확 원문·유한 외피·소진 기록을 확인한 경우에만 해당 실행을 지시한다. 소스 SHA·개수 변경만으로 사용자에게 같은 승인을 다시 요구하지 않는다. 기존 승인 밖의 실제 효과가 확인되면 그 차이만 별도 결정받는다.

이 후보의 실제 효과는 신규 역할·스키마113/원장·SCRAM/임시 인증키/합성 계정·npm registry·PG/internal network 생성·확정 정리와 실패 보존이다. 실제 Agent/Provider/SDK·운영 DB/사용자자료·운영 배포·전체 IX01/작업계획 인수는 이 후보 밖이다. 회복·실측·발급·기존 승인 범위 대조와 정확 실행 결박이 갖춰지기 전 actual0을 유지한다.

최종 sourceHead 및 sourceFiles14행은 d7a2c5542f8feca105ebd5dc4b686b3613b01704의 실제 Git 지문으로 결박했다. 현재 gitHash/dockerHash 실측과 새 approvalId/issuedAt/expiresAt 발급은 미완료다. 원 인간 승인시각을 새 외피 시각으로 덮어쓰지 않으며, 전체30분/PG10분/자식90초 중 최소 기한과 UNKNOWN 후속0을 유지한다.
