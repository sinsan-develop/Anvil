# IX01 실제 여정 J3 단발 실행 후보 — 2026-11-04

판정: NOT_APPROVED / 실제 실행 0. 새 직접 승인 전 실행·승인시각·비밀·자원을 생성하지 않는다. 소진된 J2 실제 실행·별도 정리 승인과 보존 원장을 재사용하지 않는다. R9의 정의 설치 증거도 별도 보존한다. 이 후보는 전체 IX01 완료나 실행 결과가 아니다.

## 1. 고정 기준

개발 branch는 codex/av3-stage-b, 승인된 private 저장소는 git@github-sinsan-develop:sinsan-develop/Anvil.git이다. WSL에서는 같은 저장소의 기존 검증된 SSH 연결만 사용하고 key·credential·SSH 설정을 변경하지 않는다.

실행 code `9e4f142a1fa09afdc51bc806c3968d44ecd40579`, instance `9e4f142a1fa09afdc51bc806c3968d44`(앞32자리). SQL 기준 `a3a12bd3e4fbf430d997c8d1c764c4de30b27ffb`. 후행 문서 commit을 실행 code로 대체하지 않는다. 아래는 현재 code의 Git blob 원바이트 SHA256이며 Windows 줄바꿈 변환본을 사용하지 않는다.

| 최소 필수 source 9개 | bytes | Git raw SHA256 |
|---|---:|---|
| `scripts/qa-ix01-actual-journey.sh` | 44886 | `b757da3679de7e11eb9eba1572f273055aab0609abe95ceafe111789f6392b6d` |
| `scripts/qa-ix01-schema-closure.sh` | 35588 | `b7b730518bf917f0462ee48fbc2569444f50d141d1b28b49c94bec1680daf733` |
| `docs/04_test_reports/AV3/IX01/ACTUAL_JOURNEY_SQL_ALLOWLIST_20261104.tsv` | 15807 | `0da3c8558445d7984731863d45261192a11c37337b93e3dd99941b00133745dd` |
| `tests/integration/IX01/methodology-design-plan-knowledge-source.test.ts` | 35067 | `31ef540312f4741253205ade066d634942659ee40d47a56646a00d6f50e638f4` |
| `tests/integration/IX01/journey-context-lifecycle.ts` | 694 | `90d4107fd6e7c15545333afcb0ebab2d06c44660605166233d1198dae91736c9` |
| `tests/integration/IX01/journey-ledger-projection.ts` | 1018 | `24ba5578602e9b2826ecaab0f8cf28bd76f8e9ca4df9b1945861dc018209e5ef` |
| `contracts/canonical.ts` | 2986 | `5be93c5b92a3bda99baa9bc561e6b535c9c1ab80196601e561903a0b6f74e143` |
| `package.json` | 943 | `e61265b7bf4e9e31445be12048f574e0cb7940c5888922e7f087603e8b10eede` |
| `package-lock.json` | 76254 | `ca586e2dd02c11c41da55a64aa4f07d3848936fe44dca1897f8586ac4fb0f1d6` |

최소9개는 전체 런타임 의존 closure 증명이 아니다. 새 clone의 full Git 9e4f142a1fa09afdc51bc806c3968d44ecd40579·최초 전체 tracked clean·SQL 기준 object 존재도 함께 검사한다. 기존 파일·환경·node_modules를 복사하지 않는다. package/lock의 별도 지문을 plan에 넣고 npm 전후 검사한다.

## 2. 실제 영향과 고정 자원

새 전용 clone에서 npm 설치, 새 PG·내부 network·artifact에 한정한 SQL 정의/원장·합성 seed·DML/RLS·보호 저장조회를 수행한다. API 범위는 Fastify app.inject가 실제 handler/pg.Pool/artifact 경로를 소비하는 시험 한 건이다. Web/HTTPS listener·브라우저·개발 서비스 교체는 없다. 합성 auth key는 원 test 메모리에서만 생성한다. 기존 DB·권한·키·서비스·Agent·P03 R3는 제외한다.

재접속은 같은 test process 안에서 app/Pool을 확정 종료·재생성하고 동일 auth 메모리 설정·원 token/ref/본문을 조회하는 범위다. OS process restart나 실화면 인수가 아니다. 성공해도 IX01의 3방법론·3생성경로·화면·process 재시작 기준은 미충족이다.

| 자원 | 고정값 |
|---|---|
| source | `/home/daon/anvil-ix01-journey-20261104-j3-qa` |
| receipt | `/home/daon/.local/share/anvil-v3-qa-receipts/ix01-journey-20261104-j3` |
| artifact | `/tmp/anvil-v3-ix01-journey-20261104-j3/artifacts` |
| PG | `anvil-ix01-journey-pg-20261104-j3-a1` |
| network | `anvil-ix01-journey-net-20261104-j3-a1` |
| DB | `anvil_v3_ix01_20261104_j3_a1` |
| owner | `IX01_JOURNEY_20261104_J3` |
| daemon | `e3349f1d-dbfc-478a-96d9-295bf6c6839e` |
| image | `sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f` |

WSL-server daon/UID1000/SINSAN만 사용하고 모든 새 이름·경로 부재를 확인한다. Node `/usr/local/bin/node` realpath는 `/opt/node-v24.22.1-linux-x64/bin/node`, root:root/0755/126879696B, SHA `e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb`이다. 자동설치·fallback은 없다.

npm은 같은 설치의 `lib/node_modules/npm/bin/npm-cli.js`, root/0755/54B, SHA `8e5f6f3429f8cdbe693cdc29904e9d5a7b127a494bd15c804bd54c7403bfcbe7`; 공개 `lib/node_modules/npm/package.json`은 root/0644/6597B, SHA `f6478d5600180a23f73e4217610c7709a71cedb4ae13f6c3e15ecb457f5d4fd6`, 버전 정확11.19.1이다. 두 지문은 npm 전체 코드 closure 증명이 아니다.

PG는 초기 network none/host publish·bind·volume0, readonly root/UID999/cap ALL drop/no-new-privileges/log-driver none/pids64/512MiB/CPU1, tmpfs data/socket/tmp 256/16/16MiB이다. HostConfig.Tmpfs의 정확3경로·옵션을 권위로 검산하고 별개 Mounts는 빈 배열을 허용하되 존재 entry는 등록 tmpfs/RWtrue/외부Source없음/중복0이어야 한다. 추가 Binds/Mounts/VolumesFrom 선언은 거절한다. 뒤에 새 internal bridge만 연결하고 정확 fullID·label·단일 PG·IP를 검산한다. 기존 자원 인수는 없다.

## 3. 입력·환경·단발

부모 plan exact15키: `schemaVersion,purpose,approvalId,executionHead,sqlHead,instance,uid,issuedAt,expiresAt,manifestHash,packageHash,lockHash,npmCliHash,nodeHash,sourceFiles`. schema1/purpose `IX01_ACTUAL_JOURNEY_PREPARER`/UID1000, JSON64KiB·중복키 거절·원문hash를 결박한다. 새 직접 승인을 Main이 최초 관측한 UTC를 issuedAt으로 기록하고 expiresAt=issuedAt+30분으로 고정한다. clone/npm 등 준비와 실제 실행·정리를 이 기한 안에 포함하며 연장·자동 재시도하지 않는다.

부모 Bash는 env-i/--noprofile/--norc·umask077로 시작한다. Node에는 안전 PATH/locale 및 공개 `ANVIL_IX01_JOURNEY_OPT_IN`, `ANVIL_IX01_JOURNEY_PLAN`, `ANVIL_IX01_JOURNEY_PLAN_SHA256`만 전달한다. 실제 호출은 script --run 한 번/opt-in `EXACT_PLAN_APPROVED`/원문 plan hash이다. 비밀을 argv나 출력에 넣지 않는다.

receipt owner exact9키: `schemaVersion,purpose,uid,executionHead,instance,approvalId,issuedAt,expiresAt,planHash`, purpose `IX01_JOURNEY_RECEIPT_OWNER`. intent exact6키: `schemaVersion,purpose,planHash,executionHead,approvalId,instance`, purpose `IX01_JOURNEY_INTENT`. owner.json/slot-a1.intent.json/slot-a1.result.json은 신규 exclusive0600, directory0700·소유·비link·부모 체인을 검산한다. claim 시도 뒤 소진 불명은 INTENT_UNKNOWN으로 보존하며 기존 파일 채택·덮어쓰기·자동 재시도는 없다.

Docker config와 npm user/global config·cache는 receipt 아래 신규 docker-config, npm-user.conf, npm-global.conf, npm-cache 네 경로다. 이 네 임시 대상만 정상 결과 뒤 Main의 exact owner/nonlink/process0 검산으로 정리하고 owner/intent/result 감사는 보존한다. 정상 정리 metadata cleanup.json은 동일 receipt 안 새0600·비밀 없이 보존할 수 있다. 사용자 rc/preload·project .npmrc·기존 node_modules를 거절하고 Git include/replace/fsmonitor 등 외부 소비를 차단한다. 고정 Node의 npm ci --ignore-scripts --no-audit --no-fund, 전용 설정/cache·lock resolved/integrity를 검사한다. registry.npmjs.org 다운로드는 이번 새 실제 승인 대상 영향이다. npm run/test 대신 고정 Node argv로 원 integration을 호출한다.

## 4. SQL·역할·실제 여정

manifest의 명시105 전체를 원순서로 선택한다. 총2376141B, 순서 hash `09d2e7d5cd8715a0ff02540d4397db2d4cb8dcf818d808ce328423d7583f24ef`. 파일번호 정렬로 대체하지 않는다. 성공 SQL 정착 뒤에만 실제 schema_migrations INSERT, 최종 exact집합을 검산한다. 별도 순차 receipt의 id/path/checksum/sql/ledger로 원장 공백·불명을 보존한다.

고정 R9 script의 bootstrap/metadata/revoke producer를 사용하고 adaptedBootstrap에서 원 R9 DB literal 두 곳만 J3 DB로 치환한다. 0037 exact hash/path 원문은 single-transaction이다. provider NOLOGIN/NOINHERIT owner·임시 migrator ADMIN membership, 0066/0073 reader 설치/자체 회수와 마지막 membership0·migrator CREATEROLE false·systemHash 불변을 검사한다. 기존 SQL/ACL/guard는 변경하지 않는다.

PG 생성부터 절대10분, 전체30분, child90초를 별도 적용한다. 모든 await 앞뒤 최소기한·정리 여유60초를 보존한다. 최종 PID1 postgres와 bounded pg_isready 뒤 pristine 역할 읽기 한 번을 수행하고 SQL 재시도는 없다. 새 임시 password3개는 실제 승인 후에만 각64hex 메모리 생성한다. bootstrap은 값 없는 Docker env 인자+정제 client env, app/migrator는 psql stdin만 사용한다. host SCRAM 검산 뒤 internal network를 연결한다.

child plan exact14키: `schemaVersion,purpose,sourceHead,cwd,uid,host,database,artifactRoot,issuedAt,expiresAt,sourceFiles,migrations,migrationPlanHash,ownerMarker`, purpose `IX01_ACTUAL_JOURNEY_EXECUTION_PLAN`. sourceFiles는 기존 prefix/확장자로 엄격 변환해 root package/lock을 제외한다. artifact owner exact7키: `schemaVersion,purpose,sourceHead,artifactRoot,uid,issuedAt,expiresAt`, purpose `IX01_ACTUAL_JOURNEY_OWNER`. 신규 parent/root0700·owner.json0600/nlink1/hash를 검산한다.

## 5. 결과·진단·정리·한계

child exit0/완전 TAP tests1/pass1·fail/cancel/skip/todo0·90초·출력64KiB·소유·최종 역할 검산까지 확인해야 성공이다. result 공통15키: `schemaVersion,status,journey,code,stage,planHash,instance,containerId,networkId,completed,receipts,roleEvidence,audit,sourceCleanup,npmCleanup`; 거절/UNKNOWN에는 sqlState가 추가된다. 감사64KiB 이내, 원 SQL·stderr·토큰·DSN·비밀번호 반환0이다.

고정 test hash의 실행 전 bounds와 캡처 TAP만 사용해 audit.childDiagnostic에 `{line,column,code}` 또는 null을 남긴다. ERR_ASSERTION 및 source의 유한 SQLSTATE만 허용하며 모호·중복·위조·범위초과·잘림·timeout은 null이다. 힌트는 실제 PG 원인 확정이나 성공 증거가 아니다. UNKNOWN 뒤 파일 재조회·DB query·mutation·자동삭제·재실행0이다. 원 test 내부 finally의 소유 정착과 준비기 후속 행동은 구분한다.

확정 성공만 fullID/label 재검산→stop/정착→rm→빈 소유 network 제거→부재→원marker/자식소유 검산→artifact 및 빈 parent 제거를 수행한다. source/npm 잔여는 Main이 별도 process0·소유를 검산해 정리하며 감사는 보존한다. UNKNOWN이면 기한 뒤에도 자원이 남을 수 있어 무조건10분 내 삭제를 보장하지 않는다. 추가 정리는 별도 직접 결정 대상이다.

R9는 정의 설치 성공이며 실제 기능 여정 PASS가 아니다. J1은 최초 OWNER/UNKNOWN 뒤 새 정리 승인으로 실행자원 잔여0/감사4를 확인했고 원 결과는 보존했다. source의 tmpfs 표현 보완은 Main30PASS/skip0/735.0005ms·기존타입/Bash0·실제29.1.3 metadata 순수 replay로 검수했다. 원 J2는 namespace7만 변경/역치환부모raw동일·원30시험prefix보존, 신규집중Main1PASS/skip0/154.852ms다. 같은 controller 전수검사를 불필요하게 반복하지 않았다. 이번 J3 후보의 실제 시험·접속·시각·키·자원 생성0, 새 실제 실행은 NOT_RUN이다.

Main 보완: /tmp root sticky1777만 부모 체인 예외이며 하위는 UID1000 보호 소유다. 정상 정리까지 확정 성공인 때만 별도 최종 잔여 조회를 한다. 정리 자체가 불명이면 추가 조회/삭제하지 않고 보존한다. 기존 사용자 자료/백업 대상 조사·운영/Oracle/ysna·기존 공유 network/volume/인증서 변경은 포함하지 않는다.

## J1과 이번 새 결정의 구분

[보존된 J1 실제 결과](../04_test_reports/AV3/IX01_ACTUAL_JOURNEY_J1_RESULT_20261104.md)와 [표현 보완 결과](../04_test_reports/AV3/IX01_TMPFS_INSPECT_PROJECTION_SOURCE_RESULT_20261104.md)는 역사 증거다. 이번 J3는 그 소진 grant/receipt를 이동·삭제하거나 계속 사용하는 재실행이 아니라 새 직접 결정이 필요한 별도 단1회다. 새 J3 승인 전에는 경로 부재 확인을 포함한 WSL/QA 접근·생성·발급0을 유지한다. 기능·DB/권한 검증은 여전히 미완료이며 전체계획 완료를 주장하지 않는다.


## J3 추가 동결 근거와 원 J2 결과 보존
이번J3 code9e4f142a/privateexact·trackedclean/보호3·main불변 확인79f474. 원J2 code6490은105개SQL/개별원장SETTLED뒤최종집합검산LEDGER_UNKNOWN/기능미도달이었고새별도정리승인으로06:06:37.589Z실행자원잔여0/감사4보존확인했다. 원/정리승인은소진됐으며J3에사용하지않는다. J2결과서는 IX01_ACTUAL_JOURNEY_J2_RESULT_20261104.md다.

source5 보완은DB collation과Node정렬의순서가정만제거하고exact105·유일ID·exact2키·정확checksum집합·누락추가중복변조거절을보존한다. 원SQL조회/105적용순서/receipt/권한·비밀/시간/UNKNOWN효과0은불변이다. 실제J2반환집합/DB collation은조회하지않았으므로직접원인확정0이다. 신규helper필수source9와35067B/31EF의고정시험bounds·1018B/24BA의고정helper검산을부모→child로결박했다. 누락/오염·구시험원문은거절한다. Main3b70cd fresh46PASS/skip0/912.1963ms·PrimarynoEmit/Bash/diff0·역차분정확·독립C0/I0다. 이소스검사는새실제J3실행/기능PASS가아니다.

이문서의J1검수/cleanup내용은역사증거이며현재J3영향범위나승인을대신하지않는다. 모든새J3source/receipt/PG/network/DB/artifact·합성인증/임시권한은아직생성0이며새직접승인후최초관측clock부터30분/PG10분/test90초/단1회다. UNKNOWN이면추가조회·재실행·자동삭제없이보존한다. 기존DB·권한·키·서비스·Agent·P03R3는변경0이다.

독립검토C0/I0/M2 보완: 위 원 J2 namespace/30prefix/1PASS 수치는 역사 증거이며 현재 J3 검수는 추가 동결 근거의 source5/Main46PASS다. 외부 부모 SSH/exec 출력이나 종료 결과가 미수거·유실·잘림이면 결과 UNKNOWN으로 보존하고 원 handle만 수거하며, 확인을 위한 새 QA 조회·재실행은 하지 않는다. 이미 확보한 정상 종료와 로컬 캡처를 잃은 것은 구분하고 실제 효과를 추측하지 않는다.
