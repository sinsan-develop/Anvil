# P02 A안 파일 책임·검증 지도

## A-3 최신 후보 책임 — 한정 실측·잔여 분리

checksum한정후속 actualf7bafbcb는 생성응답확보실패·자동정리실패/검사미도달FAIL이었다(A3_SQL_CHECKSUM_ONLY_QA_01_RESULT). 독립신원대조뒤수동exact정리·이름/ID/5548잔여0·기존PG동일을확인했다. source-read-protocol-qa-guard.ts는생성응답유실의fixed이름/fullID/이번난수/소유재식별과비밀없는Docker진단을담당하고runner는회수후기존image/mount/port/network검사만으로정리한다. 이보완은로컬14PASS/한정읽기C0I0M1일뿐새actual/원생성원인해소·checksumPASS가아니며과거권한소진을유지한다.

2026-10-18 최신 대조: exact423032bc protocol 단1회는 서비스↔실PG8범주·26벡터/새4표0과 exact정리·독립잔여0을 확인했다(A3_PROTOCOL_QA_01_RESULT). 하지만 app full46checksum 비교는 ID만조회하는 코드누락으로 미실행이므로 승인검수전체PASS가 아니다. 아래 이전미실행/준비 문장은 당시이력으로 보존한다. source-read-sql-vectors.ts는이후 SELECT id,checksum/정확46map/중복거절·검증수marker로보완했고신규source-read-sql-manifest.test.ts가해당음성을검사한다. qa-source-read-protocol.ts의새SQL-checksum-only모드는서비스8범주를반복하지않고새별도결정전actual0이며 A3_SQL_CHECKSUM_ONLY_QA_DECISION을따른다. 정식DB·HTTP/TLS/browser·OS/Agent·전체수용은미완료다.

서비스후속준비: qa-source-read-protocol.ts/source-read-protocol-qa-guard.ts는별도새bridge·loopback5548의46schema/26벡터→source-read-protocol-flow8범주를호출하는미승인후보이다. flow의정확snapshotINSERT후fault·횟수1/유효재서명409·미소비회수는시험책임이며제품코드/권한계약을바꾸지않는다. source-read-flow-fault/unit·protocol-qa-entry/guard는합성만확인했고실DB/8범주PASS는없다. 네트워크/합성인증/유한1회자원결정은 A3_ISOLATED_PROTOCOL_QA_DECISION을따른다.

2026-10-18 한정 actual: exact86bae1e7의 새 빈 internal PG/psql은46schema COMMIT·별도appREADONLY full46checksum/동일26벡터/새4표0행 PASS·exact정리/독립잔여0이다(A3_PSQL_SQL_QA_01_RESULT). 제품의 실제API/credential·보고원자성/rollback·Nodepg/served/TLS/OS·전체기능연동은 여전히 미완료이며 아래 과거미실행문구를 이한정결과나전체기능PASS로혼용하지않는다.

SQL 후속 준비: qa-source-read-psql.ts/source-read-psql-guard.ts/source-read-psql-batches.ts는 새 internal network·host publish0·컨테이너 내부 TCP psql에서 고정46 SQL과 공통26벡터를 검증하는 후보만 담당한다. 기존 source-read-sql-vectors.ts의 입력·기대값26개는 Node/psql이 공유하며 원커밋과 메모리 EXACT 대조했다. 새 실제 실행은 별도 결정 전0이다. 원 qa-source-read-sql.ts actual FAIL/정리0·단1회소진은 FN08/A3_SQL_QA_01_RESULT.md에 보존, 새 준비 검사를 원FAIL/실PG/전체기능 PASS로 승격하지 않는다.

N2의 source-read-protocol.ts·source-read-routes.ts는 별도 교환/permit/보고·HUMAN 조회만, source-read-records.ts는 검증된 nullable snapshotRef와 보관 OWNER/VIEWER projection을 담당한다. SQL0008_source_read_observation은 신규4표/guard/고정 Unicode17 매핑 초안이며 source-read-migration.ts는 독립 격리 준비 helper로만 분리했다. 기존45 SQL/정식 runner 변경0이다. tests/integration/FN08/source-read-sql-vectors.ts는 준비됐으나 실제PG 미실행·전체 API/COMMIT/실패 rollback 시험 경로는 미완료다. N3 SourceReadGrantsPanel.tsx/source-read-api.ts·SourceRootsPanel/App은 사용자/client/project별 보존 입력과 명시 요청/회수·보관 조회를 연결한다. 작성자 로컬/합성 browser와 한정 독립 읽기 검수만 확인됐으며 Minor hostLabel 표시/실PG·served·native·OS·실source·Agent는 남아 있다. 아래 '예정/아직 없음' 문구는 이전 단계 기록이고 최신 상태는 이 문단·WORK_STATUS를 따른다.

### 이전 후보 작성 이력

N2 부분 작성: connections/source-read-input.ts(별도 op/엄격 이유·한정query), source-read-records.ts(고정scope/receipt·원 선언 hash 무결성/OWNER·VIEWER 조회), project-source-read-grants.ts(현재 HUMAN 정책/소스/등록·명시 요청/회수/같은명령 재확인)와 tests/unit/FN08/source-read-{input,records,grants}.test.ts다. access/project-command.ts에는 승인된 새2op whitelist만 추가했다. route/SQL4표·basis함수/교환·permit·보고/UI 연결은 아직 없으며 실제 저장·권한/OS·기능 사용가능 증거가 아니다. AV3-PMO-A3-LOCAL-IMPLEMENTATION의 제한 코드/SQL초안·로컬합성 검증 승인만 적용하며 기존45SQL·정식DB/실credential/서비스는 불변이다.

N1 작성 범위: contracts/runtime/source-read-observation-v1.ts(요청/scope/permit·bounded wire/별도 proof payload), source-read-report-v1.ts(report·시각/uint64/서명bytes), apps/server/modules/connections/source-read-proof.ts(새 purpose의 public-key 검증)와 tests/unit/FN08/source-read-{fixtures,contracts.test,proof.test}.ts다. source-scope-v1.ts의 export alias만 공유하며 기존 parser 의미는 불변이다. 이 파일들은 작성자 단위/타입·한정 읽기 검수만 받았으며 아래 서버/SQL/UI/native 경로 전체가 구현됐다는 뜻이 아니다. 실제 경계/증거는 WORK_STATUS를 따른다.

별도 source-read-protocol/proof 소비자는 r2 /permit 보호 전달과 정확 scope/path hash, source-read-records는 주장/서버 시각 관계도 책임진다. 이는 기존 OWNER source-root 조회·HostProofPayload·상태token parser의 권한 확장이 아니다. 후속 작업 승인 전 아래 예정 파일·SQL/native는 생성하지 않는다.

아래는 최초 설계의 전체 예정 책임 지도다. 현재 작성된 N1/N2 부분은 위 문단과 WORK_STATUS로 구분하며 아래 모든 경로의 존재/전체 완료를 뜻하지 않는다.
- contracts/runtime/source-read-observation-v1.ts: 별도 READ_ATTRIBUTES scope/report 자료형·정확 wire. 기존 source-scope-v1.ts/HostProofPayload를 확장하지 않음.
- apps/server/modules/connections/{source-read-input.ts,project-source-read-grants.ts,source-read-protocol.ts,source-read-proof.ts,source-read-records.ts}: HUMAN 요청·정확현재성/별도교환·보고검증/조회. 기존 projects/routes.ts·project-command.ts 최소연결은 후속 승인 대상.
- db/migrations/0008_source_read_observation.sql·scripts/{source-read-migration.ts,qa-source-read-observation.ts,apply-source-read-development.ts}: 제안46번째·기존45manifest/신규4표·격리COMMIT/정식schema-only 분리. 현재 생성/적용0.
- apps/web/src/features/connections/SourceReadGrantsPanel.tsx: 별도 명시 요청/회수·원문/metadata 분리·미확인 상태. 기존 선언 폼을 실제 접근 허가처럼 재명명하지 않음.
- apps/connector/runtime/{source-read-https.ts,source-read-observer.ts}와 native/SourceReadObserver.cs: 예정 별도 소비자/metadata native. 실제 native·키·실경로는 추가승인/실측 전 사용0.
- tests/unit/FN08/source-read-*.test.ts, tests/integration/FN08/source-read-observation.ts, tests/browser/UI11/source-read-grants.spec.ts: 후속 정상/음성·실제PG/합성UI/native 구별. 현재 PASS 증거가 아님.

## A-2R 소스 위치 등록부 진입점
- QA의 실측 Docker tmpfs/최초오류·정리오류 분리·비밀 없는 SQLSTATE 진단은 scripts/source-root-qa-guard.ts, 직접 회귀는 tests/unit/FN08/source-root-qa-guard.test.ts가 소유한다. 제품 실행기나 범용 자원관리 계층이 아니며 등록 QA runner만 소비한다.
- 서버: connections/source-root-input.ts(정확입력/snapshot), project-source-roots.ts(3명령·원본/메타조회), projects/routes.ts·access/project-command.ts의새op 연결. 기존승인소비 whitelist는 늘리지 않는다.
- DB: db/migrations/0008_source_root_registry.sql의새2표/해시/가드만. scripts/source-root-migration.ts 고정44manifest+새1; migrate-development.ts SOURCE_ROOT_REGISTRY_ONLY 모드, apply-source-root-development.ts의 --plan/--apply-schema-only는exactcommit/기한/hash·보호migrator 경로와old/newbaseline 대조다.
- QA: qa-source-root-registry.ts --plan/--run, integration/FN08/source-root-registry.ts는새전용PG actualCOMMIT/GET·거절/rollback/immutable guards. exact소유container/net/tmpfs만폐기;기존데이터행삭제/guard해제0.
- UI: connections/source-roots-api.ts·SourceRootsPanel.tsx·App.tsx의 주체/client/project별buffer. 정확명령/hash를확인하고결과불명·화면이동후동일명령재확인, 조회와명시개정/철회분리·자동실행0.
- 직접unit tests/unit/FN08/source-root-input.test.ts/source-root-routes.test.ts/source-root-migration.test.ts/source-roots-web.test.ts, 후보browser tests/browser/UI11/source-roots.spec.ts(ANVIL_A2R_WEB_DIST 필수). 후보/격리PG/정식schema/servedbrowser/Agent 검증을분리하며 결과/오류·자원정리는WORK_STATUS에기록한다.


## FN08-CONTRACT-A1 정확 코드·검증 진입점

- 계약: contracts/runtime/validation-v1.ts(공통 strict shape/순수 ref), source-scope-v1.ts(유한 상대경로 문법), dispatch-envelope-v1.ts(3연산·ref·hash·시각), dispatch-receipt-v1.ts(정확 key/hash·고정 실행false). 기존 common VersionRef/canonical 규칙을 유지한다.
- runtime: apps/connector/runtime/receipt-inbox.ts의 receiveUnverifiedEnvelope. 파일 수신기록만이며 dispatch.ts·adapter/서버·nativehelper에는 연결하지 않는다. 실제 실행 entry/계정·서비스·DB/migration 파일은 이번에 추가하지 않는다.
- 직접 시험: tests/unit/FN08/runtime-contracts.test.ts, tests/integration/FN08/receipt-inbox.test.ts. 후자는 기본 unit glob과 분리하고 사전등록한 **빈** D:\tmp\anvil-v3-stage-b\fn08-scope-journal-01을 ANVIL_FN08_QA_ROOT로 명시한 단일 시험 실행만 사용한다. normal/duplicate/tamper/quota/partial/concurrent/restart/failure/sync-failure 합성 하위와 windowsHide Node 자식만, 재실행 전 Main이 소유/목록/부재를 확인해 시험root를 정확 정리·재생성해야 한다. 기존 root 자료를 시험이 자동 초기화하지 않는다.
- 검증: node --test tests/unit/FN08/runtime-contracts.test.ts; env 지정 후 node --test tests/integration/FN08/receipt-inbox.test.ts; 직접 인접 FN08 dispatch/기존 canonical·reference unit; tsc --noEmit -p tsconfig.base.json. UI/서버 소비 변경이 없어 실제 browser/PG/Agent/compiler 재검증을 대신 실행하지 않는다. 실제 결과·실패·정리·미검증은 WORK_STATUS에 기록한다. sync 실패는 FileHandle.sync 의존성 EIO 합성 주입이며 실제 디스크 고장을 일으키지 않는다. 완전 JSON이 남아도 불명 lock·UNKNOWN을 보존한다.


9fb5fe19 compile-only1회는 csc PID54156/status1/118ms에서 실패했고 stdout153byte digest와 stderr0·정규화진단0의 safe receipt만 반환했다. 신규root binding/result2파일·3dir를 정확정리/독립잔여0, 코드3파일/C#source39111ada/compiler46809206 불변이다. 이번 결과기록은 직접4문서만 추가하고 compiler 실패 이유를 추측수정하지 않는다.

FN06 compile 진단 준비의 변경은 기존 handshake-qa.ts(own data 유한 receipt/checkCompileOnlyRunBinding/CompileOnlyAttempt), 직접 unit(기존11+신규5), 기존 integration의 별도 compile-only 분기와 원 compile catch, 직접4문서뿐이다. C# source39111ada/기존 codec/vendor/의존성/서비스는 불변이다. compile-only는 신규 등록root의 compile1 결과만 기록·정리하고 성공해도 원 handshake 분기로 복귀하지 않는다. 준비 중 통합/컴파일 실행0이며 직접16 순수 PASS·타입0와 구분한다.

A 최초 integration1회는 compile 호출 단계 QA_COMPILE_FAILED로 끝났다. 현 harness의 compile catch가 원예외의 exit/signal/timeout/진단을 버려 직접원인은 미확정이다. 소스/harness는 변경하지 않았고 새 실제실행0; 승인된root/binding만 정리했다. 오류기록 보완은 후속 PMO지시 대상이며 이번한번의 실패를 뒤의 성공으로 소급하지 않는다.

A 한정 보정의 HandshakeHostFrames는 handshake-qa.ts 안에서 helper NDJSON의 transport 병합/분할과 개별8192·총512KiB/256프레임·부분EOF를 소비한다. integration은 이 직접 검증된 framer를 사용한다. C# finally는 raw StopExact를 Job조회와 독립 보호블록으로 두며 rawCleanupAttempted/Failed/jobObservationFailed와 최신 Job0을 별도 보고한다. 실제 OS 검증은 아직0이다. 소스4+직접문서4 외 기존파일은 변경하지 않았다.

A 남은2파일 준비: `apps/connector/native/CodexHandshakeHost.cs`는 고정 native/hash·private Job/stdio3·초기 JOB_LIST/비상속·raw소유/단1회 종료 관측을 담당한다. `tests/integration/FN06/codex-handshake-0161.test.ts`는 exact SHA/sourcehash와 PMO 한시 입력·보존 선검사→새 QA root/csc1→host/native1→gate→관측/정리용이며 아직 실행하지 않았다. 새 모듈의 checkHandshakeRunBinding은 로컬 후보/창 입력 대조이지 PMO 권한 자체의 증명이 아니다. 준비 전용 검증은 직접 순수unit/type/diff와 C# 정적검수에 한정한다.

FN06-HANDSHAKE-0161-01 부분 준비의 실제2파일: `apps/connector/adapters/primary/handshake-qa.ts`는 고정 QA2메시지와 기존 codec/유한 입력·단계시각·EOF/exit 입력을 순수 메모리 action으로 비교한다. `tests/unit/FN06/codex-handshake-qa.test.ts`는 직접8건이며 OS/stdio를 모의한다. normal adapter·권한 verifier/launcher에 연결하지 않았다. 승인된 CodexHandshakeHost.cs와 tests/integration/FN06/codex-handshake-0161.test.ts는 아직 작성 전이며 root·C# compile·Job/native 실행0이다. 기존 codec/vendor/OwnershipHost·Windows-host/서버/DB·패키지는 변경하지 않는다.

UI10 정정 표시 비교: `features/knowledge/correction-diff.ts`가 기존 순수 documentTextDiff를 변경 없이 소비하며 본문65,536 UTF-16 단위/2,000줄 초과는 상세 제한으로 구분한다. `KnowledgeCorrectionDiff.tsx`는 현재 props의 제목/판단 이유/본문을 text로 비교하고 기존 KnowledgeCorrectionForm의 저장/주체 guard를 변경하지 않는다. 직접 단위는 `tests/unit/FN05/knowledge-correction-diff.test.ts`, 합성 브라우저는 기존 `tests/browser/UI10/knowledge-correction.spec.ts`다. 후자는 ANVIL_UI10_FIXTURE_DIST 지정 시 그 후보 asset만 응답하고 기본값은 기존 apps/web/dist이며 모든 API는 fixture로 차단한다. live dist를 덮지 않는 후보 build는 `vite build --config apps/web/vite.config.ts --outDir <사전등록 QA 경로>/dist`로 실행한다. API/DB 계약·원문/출처·pending 명령과 기존 저장 경로는 불변이다.

FN06-CODEX-CODEC-01 오프라인 실제 파일: `apps/connector/adapters/primary/schemas.ts`는 고정 vendor JSON의 필요한 분기/응답을 기존 Ajv strict/local refs로 검증하고, `codec.ts`는 유한 UTF8 프레임·송신 복제 전 바이트 선검사·메모리 응답/선도착 미결박 상관·수명 id 재사용 금지·안전 digest 관측만 담당한다. `tests/unit/FN06/codex-codec.test.ts`는 입력/한도/중복·맥락/EOF·비밀 비반사/승인 wire0의 순수 집중23건이다. transport/실제 Agent adapter 세션·서버허가/영속receipt·spool/OS/파일 통제는 미구현이며 vendor 원본은 수정하지 않는다.

FN08 내부 준비2파일: `apps/connector/runtime/dispatch.ts`의 inspectDispatchPreconditions는 기존 AdapterContext/VersionRef의 구조·기대 snapshot 불일치와 미연결 차단만 보고한다. `tests/unit/FN08/dispatch.test.ts` 집중4건이 위장/누락/비밀비반사·실행불가를 확인한다. 실제 dispatch 함수/영속 중복/서버검증/소스경로·spool/Agent는 아직 없으며 새 wire/API/DB 파일을 생성하지 않는다. 소유/등록·native helper 검증과 별개의 내부 준비 코드다.

QA-02 실행 source bbb239dd는 같은 범위의 native/worker compile·fixed IPC/harness에서 합성 소유/명시회수·PREPARED취소/EOF/idle/sticky UNKNOWN 실제1 PASS/71523.4163ms를 확인했다. source/native/binary fullhash·exact ref·정리0과 미검증은 WORK_STATUS의 한정 결과를 참조한다. 코드 파일 존재/단일 합성시험을 전체 FN08 실행기·spool/ACK·Agent adapter 완료로 읽지 않는다. ProtectedStore/서버/Web/DB/TLS/runtime 변경0·schema-export 미실행이다.

QA-02 준비의 동일6코드 경로: windows-host.ts는 고정16KiB UTF8 codec/응답검사·새 run/서비스 binding, OwnershipHost.cs는 bounded byte input/output·정상EOF/부분프레임 구분·중복 QA key와 sticky 상태, OwnedWorker.cs는 새 절대창 상속, 기존 build script는 r2 exact root만, tooling unit과 integration은 순수/실제용 시나리오를 각각 담당한다. QA 전용 transport는 tests/integration/FN08 안에만 두며 제품 API·Agent에 fault 명령을 추가하지 않는다. actual 승인 전 compile/helper/root0이고 Ref 이전 주입은 미구현이다. 기존 FN06/ProtectedStore·DB/서버/Web 불변.

FN08 단일 검수 C0/I3/M2 REWORK 후 동일5코드 경로만 Main 보완: runtime의 원 프로세스/승인 gate·취소결과/sticky UNKNOWN 순수 정책, harness의 생성 전/각 launch 전/종료 후 실제 원 Node/relay·3830 확인, native의 Ref 이전 생성 소유·미resume 취소/종결 확인, fixture의 최초 절대기한·자식 종료점 상속. M2 Main Important 재분류, M1 line buffer 상한 잔여. 순수7/unit197/type0은 native 컴파일/OS/Agent 지원 증거가 아니다. 보완후 실제 검수·schema-export는 미실행이며 ProtectedStore/기존 HTTPS/DB·Web은 변경하지 않았다.

FN08 승인A 후보: `apps/connector/native/OwnershipHost.cs`는 고정 합성worker 프로필·suspended/Job attach·정확ref/PID/시각/구성원·협력/명시불응합성회수·UNKNOWN 진단만 담당하며 `runtime/windows-host.ts`의 기존 보호저장 호출과 별도 typed 소유 IPC를 사용한다. `tests/fixtures/FN08/OwnedWorker.cs`와 `tests/unit/FN08/windows-host.test.ts`/`tests/integration/FN08/windows-ownership.test.ts`가 직접검수, 기존build script는 exact 신규FN08root만 추가한다. 원3FAIL/conhost진단·DETACHED합성전용 보정·추가actual/exporter미실행/보존UNVERIFIED는 WORK_STATUS와 구별한다. vendor schema/실제Agent adapter·grant/서버실행·DB/계정 변경0이며 파일 존재는 지원PASS가 아니다.

HTTPS-QA 단일 독립검수 C0/I2/M0 뒤 Main 보완은 `fn06-https-qa-server.ts`/`https-qa-lease.test.ts` 두 파일뿐이다. server active 시작에 최초global deadline을 고정하고 stage전 종료 lifecycle·메모리 소유 부분정리를 연결했다. 순수집중7/전체unit190/typecheck PASS와 이전 e073 실제1PASS를 구분하며 수정 후 actual·OS 종료/부분쓰기 실패 재현·독립 재검수는 미실행이다. 제품 native transport/Windows cleanup·Web/API/DB44는 불변이다.

FN06 HTTPS-QA 제한 연결: `apps/connector/runtime/trust-https.ts`는 기존 enroll/proof/exchange/status 고정 경로·명시 CA/hostname TLS·Origin/무redirect/16KiB·10초/무retry·유한 비밀없는 오류만 담당한다. `tests/support/fn06-https-qa-server.ts`는 한시 SSH stdin stage/기존 API HTTPS·본인 합성 UUID·회수/정리, `fn06-windows-qa-resources.ts`는 exact r1 owner/nonlink/lease·실소유Edge PID세대·정확 보조파일/Hidden한정 정상삭제를 담당한다. 직접 시험은 `tests/integration/FN06/windows-https-{registration,resources}.test.ts`와 `tests/unit/FN06/{trust-https,https-qa-lease,windows-qa-auxiliary}.test.ts`; helper build는 exact 새QAroot만 추가 허용한다. e07312d3 실제1PASS·정리0/앞선2FAIL과 순수·합성 집중 검수는 WORK_STATUS에 구별하며 제품 launcher/서버 계약·SQL44·C# source 변경0이다.

UI11 신뢰관리의 새 `apps/server/modules/connections/project-registration-reads.ts`/기존 projects/routes는 현재 HUMAN 허가·원 생성receipt/DB scope/ref/hash 무결성·고정projection/기한결박 cursor만 읽는다. Web `features/connections/trust-api.ts`/`TrustPanel.tsx`와 App 주체별버퍼는 현재상태 재조회/명시3명령·원command/별도승인·최초code local state를 담당한다. 기존 decisions/api.ts는 승인된3연산만 추가 검증하며 과거 후보 흐름/서버write/SQL은 보존한다. 직접 검수는 unit/FN06/trust-read·unit/UI11/trust-api, integration/UI11/trust-read, browser/UI11/trust이고 code 없는 증거는 docs/04_test_reports/AV3/UI11/TRUST_FIXTURE_1920.png다. 후보/UI08 인접14 외 무관한 성공검사는 반복하지 않았으며 아직 마지막 제한 독립검수 전이다.

FN06 Minor1 보완: `db/migrations/0006_host_trust_challenge_protocol_fix.sql`(44)과 기존 `scripts/migrate-development.ts` 명시 순서만 교정했다. 적용43 함수와 선언/숫자1 조건1개 외 동일성을 대조했다. 직접 회귀 `tests/integration/FN06/challenge-payload.test.ts`는 ba5c96fd actual RED→dba582b6/44 actual GREEN1(2132ms), 입력6종/app DB6종 거절·숫자1 정상과 최소 등록/일회 발급/회수를 확인한다. 기존 Windows/native/서명/인접3 diff0으로 재검사0. 원 독립C0/I0/M1은 보존하고 Main 수정 검증을 연결한다. 이하 미승인44/미수정은 후속 PMO 허용 전 이력이다.

FN06 마지막 독립 읽기 전용 검수(daf88829..0282713e)는C0/I0/M1·제한 scope 수용 가능이다. Minor1의 정확 위치는 `db/migrations/0006_host_trust_registrations.sql:170`이며 적용본은 불변으로 보존한다. 공개 HTTP `registration-proof.ts`의 정확8필드/숫자1 검사와 구별한 DB 방어층 보완 후보이며 후속 forward는 PMO의 정확 지시 전 작성하지 않는다. 실제 PG SELECT 비교 이외 새 시험/제품 수정0이고 전체 FN06/Stage 검수 완료가 아니다.

FN06 한정 신뢰 검수의 마지막 실행은0282713e 신뢰 actual1/18831ms와4ecb2e39 신뢰·기존3개 인접 actual4/18685ms다. 제품/43·native/서명 불변을 확인해 같은 성공 검사를 반복하지 않았다. 실제 코드/계약은 read-only 독립 검수 대상이며 미구현 UI11 신뢰 관리/실제 Agent·Windows→WSL HTTPS는 여전히 별도다.

FN06 서버 부분은8a7cb985의 신규43 적용/등록 actual과 d8ec41e6 시도5회·등록 실제 만료·HUMAN3연산 별도 일회 승인 소비 actual을 확인했다. 후속 실제 시험만 보강 중이며 제품/43은 불변이다. 아래 착수/미적용 문구는 당시 이력으로 WORK_STATUS의 최신 증거/미검증을 따른다. 실제 Agent/영구 PC/Windows→WSL HTTPS 완료가 아니다.

FN06 서버 후속 후보: `connections/project-registrations.ts`는 현재 HUMAN 등록/정확 비교/회수·동일 command/단독 제어/정책·기한/receipt를, `registration-protocol.ts`는 host proof·유한 challenge/실패 횟수·새 nonce·상태조회전용 일회 발급/회수·COMMIT 뒤 실패 반환을, `registration-routes.ts`와 `http/connector-auth.ts`는 제한된 HTTP/Origin/strict JSON·기존 API credential 차단을 소유한다. `contracts/connector.schema.json`·직접 catalog/생성 타입, 신규43 `db/migrations/0006_host_trust_registrations.sql`·명시 runner와 기존 승인 소비3연산의 정확 대상/ref 확장만 연결한다. 직접 실제 시험 `tests/integration/FN06/trust-registration.test.ts`의 첫6377a8fb RED와 이후 후보/미적용43을 구별한다. 아직 실제 등록 GREEN/전체 Agent 실행 완료가 아니다.

FN06 제한 신뢰 등록 부분: `apps/server/modules/connections/registration-proof.ts`가 고정 SPKI/P-256·정확8필드 canonical/P1363·현재 challenge 대조를, `trust-registration-input.ts`가 기존7필드와 분리한 trust-only/명시 HUMAN 비교 입력을 담당한다. `apps/connector/native/ProtectedStore.cs`는 고정 연산 CNG/CurrentUser DPAPI·private/token stdout 금지, `security/secret-store.ts`/`runtime/windows-host.ts`는 typed 호출·비링크/바이너리 hash·stdin·bounded child를 담당한다. `scripts/build-windows-helper.ps1`는 기존 컴파일러로 승인 일회 QA root만 빌드하며 덮기0이다. 직접 시험은 `tests/unit/FN06/{registration-proof,trust-registration-input}.test.ts`와 `tests/integration/FN06/windows-protected-store.test.ts`다. Windows 보호저장 실제 부분과 서버 등록/WSL/Agent 미구현은 WORK_STATUS에 분리한다. 새43·서버 저장/routes/승인3연산 소비는 후속이며 이 파일 존재만으로 활성화하지 않는다.

UI08 실제 후속은 `tests/browser/UI08/candidate-approval.spec.ts`(요청/결정/결박/별도 소비·변경 scope·유실)와 `tests/integration/UI08/approval-client.test.ts`(같은 Web 함수/API·PG 실제 소비/경합·만료·회수/정리)다. 검증 코드36fa3e51 이후 조회 listSequence만 화면 내부에서 보정하고 client/서버/DB 경계는 유지했다. 합성 캡처는 docs/04_test_reports/AV3/UI08/APPROVAL_FIXTURE_1920.png다. 기존 아래 착수/미실행 문구는 당시 이력이며 최신 결과는 WORK_STATUS를 따른다.

UI08 승인 소비 착수: `apps/web/src/features/decisions/api.ts`는 기존 요청/결정·목록/상세·정확 scope/ref/hash·현재 서버 APPROVE 재조회/원 후보 결박을 담당하고, `ApprovalsPage.tsx`와 기존 App은 주체/client/project별 요청/결정 입력·원 command를 보존한다. UI11의 `candidateAccess`는 기본 승인 차단을 유지하면서 명시 요청 준비용 관측만 구별하고, 검증된 approvalCommandHash의 일회 ref를 동일 후보 명령에 추가한다. 시험은 tests/unit/UI08/approval-api.test.ts 및 tests/browser/UI08/approvals.spec.ts; 전체 요청→후보 소비/same-client actual은 WORK_STATUS의 미실행 범위다. backend·정책/DB/실제 Agent는 변경하지 않았다.

UI11 후보 소비: `apps/web/src/features/connections/api.ts`는 같은 후보 명령/입력 snapshot·사용자/client/project/제어 세대·정확 정책/버전 hash·NOT_READY/6UNVERIFIED의 검사/단절 재확인/조회만 소유한다. `ConnectionsPage.tsx`와 `connections.css`는 후보 작성/목록/정확 버전/개정·미구현 차단/반응형을, 기존 App은 사용자/client/project별 버퍼를 보존한다. 시험은 `tests/unit/UI11/candidate-api.test.ts`, `tests/browser/UI11/candidates.spec.ts`, `tests/integration/UI11/candidate-client.test.ts`; 합성 캡처는 docs/04_test_reports/AV3/UI11에 둔다. backend 공개 계약/schema 변경은 없고 실제 연결·신뢰 발급·정책 생성/승인 결정 UI는 포함하지 않는다.

FN06 승인 후 후보 구현: `connections/candidate-input.ts`가 kind별 입력/누락·빈 값/6능력 UNVERIFIED를, `connections/project-candidates.ts`가 현재 권한·정확 버전/정책/CAS·영속/불변 조회를 담당한다. 기존 `projects/routes.ts`, `access/project-command.ts`, `approvals/project-approvals.ts`의 승인된 후보2연산/조회만 연결했다. 새 SQL `db/migrations/0006_connection_candidates.sql`(41), `0006_connection_candidate_guard_alias_fix.sql`(42)와 명시 runner를 사용한다. 시험은 `tests/unit/FN06/{registration-input,candidate-input}.test.ts`, `tests/integration/FN06/connection-candidates.test.ts` 및 기존 FN03 문서/FN11 정책 인접이다. 350b2e30의 내부·신규 HTTP actual과 사용자 browser/실제 연결 미검증을 구분한다. 아래 승인 전 문구는 당시 준비 이력이다.

FN06 승인 전 입력 준비: `apps/server/modules/connections/registration-input.ts`와 `tests/unit/FN06/registration-input.test.ts`는 등록 후보의 구조·정확 참조·유한 기한·의심 비밀 거절/복제만 담당한다. API/DB/신뢰/host 증명·credential/Agent 호출에는 아직 연결하지 않는다. 실제 저장 계약·forward41은 사용자 승인 전 미구현이다. 입력 검사 통과를 실제 연결/배정 준비로 해석하지 않는다.

FN03 단계 연결: 서버 `modules/documents/document-stage.ts`가 실제 적용 snapshot/graph hash·노드·정확 양식을 검증하고 project-documents.ts/routes.ts가 저장·과거 조회·stage-options 읽기를 연결한다. forward40 `db/migrations/0003_document_stage_bindings.sql`과 기존 runner만 추가했으며 적용 SQL/원문 이력은 보존한다. UI06 DocumentStageSelector.tsx/stage-api.ts가 수동 단계 조회/선택을, editor-api/api/conflict-api/proposal-api와 기존 편집/조회 화면이 pending·hash·재조회·제안/충돌에서 참조 보존을 담당한다. 직접 시험은 unit/FN03/document-stage.test.ts·unit/UI06/editor-api/conflict-api/proposal-api·browser/UI06/document-edit.spec.ts·integration/FN03/document-stages.test.ts다. 실제 사용자 브라우저 DB 인수와 합성 화면/실제 API·PG 증거는 WORK_STATUS에서 구분한다.

FN01 기존 소스 선언은 projects/source-declaration.ts가 정확 입력/유한 길이·알려진 비밀 검사를, source-declaration-records.ts가 선언 ref/hash·버전/command receipt 불변 대조를, repository.ts가 owned draft 원자 저장·정확 생성 귀속/소유 범위 조회를 소유한다. forward38은 기존 identity를 보존하고 불변 버전/귀속과 현재 owned command guard를 추가한다. UI02 api.ts가 USER_DECLARED/UNVERIFIED·정확 draft/version/hash를 확인하고 기존 root 생성 버퍼로 입력/동일 명령을 보존한다. pathHint는 보호 DB 자료일 뿐 파일 접근/실관측·기준선 VERIFIED가 아니다. 실제/fixture와 미검증 증거는 WORK_STATUS를 따른다.

FN05 헌법 적용은 knowledge-state.ts의 명시 입력/현재 사용 가능 판정, constitution-records.ts의 현재 pointer·불변 snapshot/명령 receipt/hash 대조, project-constitutions.ts의 별도 정책/정확 확정·최신 검토/CAS 적용·유한 이력 GET이 소유한다. forward37은 기존36 불변 아래 append-only 적용 이력과 guarded pointer만 추가한다. UI10은 constitution-proof/api.ts로 적용 proof/현재 상태를 대조하고 ProjectConstitutionPanel의 명시 조회, 기존 root KnowledgeDecisionBuffer의 APPLY로 입력·확인·동일 명령/단절 상태를 보존한다. same-client actual7cf8c005·fixture13 결과와 실제 사용자 runtime 미교체/Agent 미연결은 WORK_STATUS에 구분한다.

FN11 유한 목록은 835b9a50 exact actual1 PASS/12553ms에서 만료/소비/회수·필터/서명 페이지·타인 격리를 확인했다. 단위131·type/diff0 및 DB31종/QA 경로 잔여0, 실제 UI08/다른 행위의 승인 소비와 구분한다.

FN11 승인 목록은 approvals/approval-input.ts의 유한 query 검사와 ProjectApprovals.list, routes의 APPROVALS 전용 서명 cursor를 소비한다. 현재 회원 검사 뒤 metadata만 읽고 현재 관측 시각에 기한/정책·제어·소유자 유효성을 표시한다. 본문/완전 이력 검사는 기존 상세 read가 소유한다. SQL36/자료·정책 쓰기와 분리된 GET이며 실제 증거는 WORK_STATUS를 따른다.

FN11 요청/결정/원문 업로드 소비는 eb4f1d97 exact actual2 PASS/13084ms로 확인했다. 기존 프로젝트 정책 실제 회귀와 소비2건/멱등·만료·회수·감사 및 QA31종/원문 정리0은 WORK_STATUS에 분리한다. 코드는 생성됐으나 미실행인 UI08/다른 연산/Agent 승인이나 전체44업무 완료로 승격하지 않는다.

FN11 소비 후속: ProjectApprovals.authorize/consume/read가 정확 후보·이력/현재 정책·기한·멱등 소비 대조를, project-command의 공통 receipt가 실제 command/승인 소비/감사를, project-files가 수신 전/저장 전 같은 허가와 실제 바이트 검사를 소유한다. approve input은 정확3필드 참조만 받는다. forward36은 기존 요청/결정 보호를 보존한 현재 소비 guard·상태 전이를 소유한다. 기존 AUTO/null 승인 경로는 보존하며 UI08/다른 연산/Agent/기준 적용은 후속이다.

FN11 승인 요청: approvals/approval-input.ts는 상세 범위·위험/복구·정확 후보/주체 검사, project-approvals.ts는 서버 시계/현재 후보 정책·기한·요청 불변 저장/무결성 재조회·실효 상태를 소유한다. project-command의 inspectPending은 요청 준비에서 현재 후보가 승인 필요인지 확인하는 내부 읽기 옵션일 뿐 실행 허가가 아니다(기본 false 유지). routes의 명시 requestApproval/GET만 연결하고 forward34는 현재 명령/정책/control/OWNER/영수증 guard와 아직 미연결 결정·소비 INSERT 거절을 소유한다. 최초 실제 지원은 uploadArtifact 후보 한 건이며 Agent 실행/정책 자동 부여0이다.

실제 저장 보정은 새 forward31(포함 비교식 괄호)/33(출처 kind 변수명)만 소유하며 적용30/32는 수정하지 않는다. 현재 요청4종 출처·사람 영향/이력 보호 actual df2f81ff 1 PASS/9215ms와 독립 QA 정리0은 WORK_STATUS에 있다. UI07/기준 적용/업무 재개는 이 함수·파일 존재만으로 구현 완료로 보지 않는다.

FN04 출처 후속: traceability/design-change-sources.ts는 기존4종 SourceRef의 유한 형식을, design-changes.ts는 실제 프로젝트·문서/보호 원문·대화 종류/hash를 저장/조회 양쪽에서 대조한다. 새 forward32 design_change_sources는 기존 요청 guard의 빈 배열 제한만 정확 출처 metadata 검사로 바꾸며 나머지 authorization/확정 설계/미선택 제안/receipt 조건은 보존한다. SQL29~31·기존 자료를 고치지 않으며 기준 적용/Agent 전달은 없다.

사람 영향 검토: traceability/impact-review.ts는 모든 대상/공백·명시 근거 형식/이유를 검사한다. design-changes.ts는 근거 문서의 실제 프로젝트/원문 hash·부모/최신 버전과 현재 주체를 확인하고 새 불변 검토 버전을 기록하며 유한 이력을 조회한다. forward30은 부모 composite FK·사람 검토 전용 guard만 추가하고 SQL29를 수정하지 않는다. 형식/실제 참조 확인과 의미 판단 정답·설계 적용을 구분한다.

FN04 변경 초기 저장: traceability/design-impact.ts가 exact 참조/의존 전파·UNKNOWN/공백의 순수 계산을, design-changes.ts가 실제 확정 원문/수정 제안·현재 계획/인덱스 조회·초기 요청/영향 저장·불변 조회를 소유한다. forward29는 새 append-only 두 테이블/정확 guard만 추가한다. UI07·사람 영향 검토 버전·기준 활성화는 아직 미구현이며 이 파일 존재를 전체 기능 완료로 판정하지 않는다.

`WorkPlanLibrary.tsx`는 저장 snapshot(DRAFT)과 별도 검토/확정 이력·현재 유효성을 읽기 전용 조회로 분리한다. 상태 조회는 제어권/쓰기 준비를 요구하지 않으며 GET decision 검증·멤버 권한은 서버에서 확인한다. 검토/확정 작성은 기존 WorkPlanEditor의 별도 버퍼에서만 준비한다.

UI06 계획 결정 연결: `work-plan-decision-api.ts`는 실제 계획 decision GET 검증·현재 사용자/client/세대/대상·별도 확인·같은 명령만 전송한다. `WorkPlanDecisionEditor.tsx`는 원문/카드 검토5기준의 개별 판단과 별도 사용자 확정을 분리하고 root WorkPlanBuffer.decision에 입력/명령/실패·미확인을 보존한다. 추적 writer와 동시 준비하지 않으며 단절 후 뒤늦은 거절도 새 명령/자동 닫기로 바꾸지 않는다. 화면 fixture와 실제 DB 증거는 WORK_STATUS에서 구분한다.

FN04 계획 결정: `apps/server/modules/traceability/work-plan-reviews.ts`는 계획 전용5기준·exact 검토/영수증·최신 선택을, `work-plans.ts`는 원문·카드의 현재 준비상태 재검사/별도 확정·결정 조회를 소유한다. forward28 `db/migrations/0004_work_plan_confirmation.sql`은 append-only 확정과 confirmed pointer만 허가한다. 이전 초안/원문/검토 계약은 유지하며 실행/기준 활성화는 없다. 실제 결과와 미연결 화면은 WORK_STATUS를 따른다.

FN04 화면 검토 선택: `features/design-trace/work-plan-screen-reviews.ts`가 연결된 화면의 정확 AF03 원문/양식/최신 검토를 읽고 기존 screenReviewRefs의 명시 선택/해제만 준비한다. WorkPlanEditor가 검토 목록·적합/미적합·현재 선택을 표시하며 자동 선택/확정을 만들지 않는다. 새 SQL/API0, 실제 저장은 기존 saveWorkPlanDraft/guard를 소비한다. 최신 검토와 과거 계획의 불변 선택 이력은 구분한다. unit113·계획 fixture5·실제 결과는 WORK_STATUS를 따른다.

격리 UI 후속: mutation-result의 documentFailure/isConfirmedArtifactQuarantine과 `QuarantinedOriginalNotice.tsx`가 검증된 upload receipt의 원문 ID만 버퍼/화면에 보존한다. 지식/대화/정정·문서/가져오기/제안 writer는 후속 쓰기 전에 중단하며, 단절 뒤 검증된 격리 응답만 현재 불확실성을 해소한다. 일반 거절/형식 오류는 원래 불확실성을 지우지 않는다. UI10 fixture11·UI06 직접 영향8·단위111, 실제 DB 여정은 WORK_STATUS를 따른다.

승인된 원문 격리: `apps/server/storage/sensitive-inspection.ts`가 원시 바이트의 알려진 표식/검사 한계를 소유하고 project-files는 새 업로드 보존/격리 receipt·일반 다운로드 차단·재확인을, project-documents의 공통 artifact resolver는 문서/가져오기/지식 원문 소비 차단을 적용한다. 기존 제안 diff guard를 보존한 새 `0005_artifact_quarantine.sql`/명시 runner만 변경하며 postDocumentCommand는 격리 receipt를 사용 가능으로 승격하지 않는다. 기존 실제 SQL26 불변, 합성/실제·UI 최종 표시는 WORK_STATUS로 구별한다.

UI10 원문 재개/선택: KnowledgePage는 기존 readKnowledge의 정확 supersedesRef를 명시로만 열고 과거 버전 쓰기를 비활성화한다. ConversationPanel의 명시 선택→`newKnowledgeFromConversation`은 기존 readConversationMessage로 물리 원문/hash를 다시 확인해 사용자 발언/지시 SourceRef를 작성 초안에 보존한다. KnowledgePending은 sourceRefs까지 고정해 단절 뒤 변경/누락 전송을 거절한다. 새 API/schema·자동 판단/저장/전달0. 단위107·UI10 fixture10과 실제 같은 client 검증은 WORK_STATUS를 따른다.

UI10 검토·확정: `features/knowledge/review-view.ts`가 사건/최신 검토·현재 유효성 응답을 검증하고 `decision-api.ts`/`KnowledgeDecisionForm.tsx`가 원문/항목별 근거·별도 확인/정확 명령을 유지한다. App의 프로젝트/현재 주체별 판단 버퍼는 이동/단절/뒤403에서 명령을 버리지 않는다. 확정 후 correction/exclusion은 기존 버퍼를 쓰며 새 버전·별도 사건만 요청한다. 단위105·UI10 fixture9와 실제 같은 Web 검증은 WORK_STATUS를 대조한다.

FN05 검토·확정 후속: 기존 `knowledge/knowledge-reviews.ts`가 KNOWLEDGE의 고정5항목 검토 입력/실제 HUMAN 기록·receipt 대조를, `knowledge.ts`/`knowledge-state.ts`가 최신 검토·별도 확정·과거 사건/현재 유효성·상태 검색을 소유한다. 기존 프로젝트 recordContentReview와 예약된 confirmKnowledge에만 연결하며 새 forward26 `0005_knowledge_confirmation.sql`은 기존 다른 대상 guard를 보존한다. 사용자 UI10 검토/확정 연결은 아직 후속이며 실제 적용/시험은 WORK_STATUS를 따른다.

지식 정정 쓰기 UI: `features/knowledge/correction-api.ts`/`KnowledgeCorrectionForm.tsx`와 App의 별도 주체/프로젝트별 버퍼는 정확 최신 PROPOSED 버전의 원문/이유·새 입력·별도 정정 사유를 결박한다. 기존 원문 source와 실제 지시/문서 출처를 보존한 새 artifact/불변 버전만 요청하며 중단/미확인 command를 유지한다. 단위97·UI10 fixture7과 같은 Web actual은 WORK_STATUS로 구분한다. 종류 변경/제외본 복원·별도 확정/헌법·Agent 전달을 합치지 않는다.

지식 제외 쓰기 UI: `features/knowledge/exclusion-api.ts`/`KnowledgeExclusionForm.tsx`와 App의 별도 소유자/프로젝트별 요청 버퍼가 조회한 원문/버전·사유·단절/거절 명령을 보존한다. 기존 validateKnowledgeView를 순수 검증 경로로 재사용하고 same-origin excludeKnowledge만 전송한다. UI10 fixture6·단위95와 같은 Web actual은 WORK_STATUS로 대조하며 정정 쓰기/확정/헌법은 미완료다.

지식 변경: `knowledge/knowledge-state.ts`는 실제 버전/head·사건열과 원 명령 receipt의 이유/주체/출처/버전을 대조한다. `knowledge.ts`의 correct/exclude/read/search·exact routes와 승인 forward25가 대응한다. Web knowledge/api·KnowledgePage는 제안/과거/제외를 구분하고 명시 제외 목록만 조회한다. 정정/제외 쓰기 UI·확정/헌법 적용은 후속이다. 실제 서버2 PASS/6012ms와 Web 상태/변조 실제 후속은 WORK_STATUS로 구별한다.

UI10 대화 후속: `features/knowledge/conversation-api.ts`/`ConversationPanel.tsx`와 App의 project/owner/client별 버퍼는 원문 업로드→명시 append·정확 source/순번/hash 확인·불변 발언 조회/목록·앞 지시 정정을 소비한다. KnowledgePage에서 원문 대화와 구조화 지식의 두 저장 경로를 구분한다. 단위90·UI10/인접8 fixture와 실제 같은 Web 저장 결과는 WORK_STATUS로 나눈다. Agent 전달/실행·자동 승인·공유0, SQL24 불변이다.

FN05 대화 후속 후보 `knowledge/conversation-input.ts`/`conversations.ts`는 현재 HUMAN의 공통 프로젝트 발언·실제 원문·독립 순번/정정 참조·GET을 소유한다. exact project-command/routes와 새 forward24 `0005_conversations.sql`·runner에만 연결하며 이전 SQL23 불변이다. 별도 역할/Agent·첨부/일반 sourceRefs·목록/화면/전달은 아직 미구현으로 남긴다.

UI10 exact579ce2dc의 동일 Web new/prepare/send/read/search는 실제 FN03 확장1 PASS/5569ms·독립 DB23종/시험root0으로 확인했다. fixture3·인접4 PASS와 별도 증거이며 실제 사용자 browser↔DB·헌법/대화/정정/확정/제외/Agent 미완료는 유지한다.

UI10 후속 `features/knowledge/api.ts`/`KnowledgePage.tsx`와 App의 프로젝트별 root 버퍼는 별도 지식 원문 업로드/PROPOSED 쓰기·목록/본문/이유·출처 조회, 단절/정책 거절 뒤 동일 명령 보존을 담당한다. DocumentWrite의 연산 union만 추가하고 기존 문서 쓰기 동작/서버 권한을 바꾸지 않는다. 단위85·화면 fixture3/인접4, 같은 client의 실제 DB 증거는 WORK_STATUS로 구분한다. 새 작업 생성·Agent 호출/자동 확정·헌법 적용0.

FN05 초기 구현 후보: `knowledge/knowledge-entry.ts`는 엄격 입력·출처 형식/미지원·알려진 비밀 표식 차단, `knowledge/knowledge.ts`는 보호 원문 resolver·PROPOSED 저장/GET·현재 회원의 제목/이유 검색을 소유한다. 기존 project-command/routes와 exact runner의 새 `0005_knowledge_drafts.sql`이 대응한다. FN05 단위·기존 FN03 actual의 신규 지식 경로로 확인하며 사용자 UI·전체 격리/정정/헌법 적용·Agent 전달은 미완료다.

추적 서버 후속: `traceability/traces.ts`는 실제 원문/고정 plan/task의 종류별 resolver·명시 linkTrace·양방향 같은 edge 조회/별도 traversal·누락/미연결을 담당한다. 적용 forward22 `db/migrations/0004_trace_links.sql`의 receipt/현재 권한 guard·불변 관계가 대응하며 기존21 SQL 불변이다. 실제 `cca08990` FN03/FN04+FN11 2 PASS/4532ms·독립 DB20종 정리 확인. Web link/view는 다음 구현이며 전체 FN04 완료가 아니다.

보관 계획 후속: server work-plans.list는 기존 ProjectListCodec의 별도 WORK_PLANS 서명과 membership·문서 필터·유한 페이지를 소비한다. Web WorkPlanLibrary/listWorkPlans/readWorkPlan/prepareStoredWorkPlan은 조회와 사용자 명시 개정 준비를 분리하고 과거 명령을 재생성하지 않는다. 같은 client 실제 원문/기준/제어 재확인→새 버전 저장은 `c4694579` actual1 PASS/3683ms, plan fixture3/단위77은 별도다. 기존21 SQL 변경0.

UI06 계획 작성 후속: `features/design-trace/work-plan-api.ts`는 현재 사용자/문서/제어·동일 명령·정확 payload/receipt/snapshot hash와 제한된 DRAFT wire 계약을 담당한다. `WorkPlanEditor.tsx`·DocumentsPage·상위 DocumentBuffer.workPlanState는 업무별 화면/기능/연결/준비·범위/시험/두 선행/복구와 실제 D/S 선택을 담당한다. 미확인 명령/입력을 보존하고 다른 문서 writer를 막는다. 단위76·UI06 fixture34와 exact `cefa3fb9`의 동일 client actual1 PASS는 별개 증거다. 보관 계획 목록/개정·화면 검토 선택/확정·trace 변경·actual browser DB는 남아 있다.

FN04 작업계획 후속: `traceability/work-plan-card.ts`는 상세 업무/두 선행 분석, `work-plans.ts`는 정확 AF04/AF02/D/S·명시 정책·초안 버전/관계 저장과 GET을 담당한다. 적용 forward21 `db/migrations/0004_work_plan_drafts.sql`은 기존20 SQL을 보존한다. 실제 API/DB2 PASS·독립 DB19종 정리는 WORK_STATUS에 기록했다. `features/design-trace/work-plan-api.ts`와 작성 화면은 후속 연결 중이다. 확정/trace edge/변경·실행 증거는 미완료다.

FN04 최초 후속: `apps/server/modules/traceability/plan-dependencies.ts`는 START/ACCEPTANCE 형식 분리·순환 검사, `design-index.ts`는 exact AF02/AF03 원문 위치 등록/GET을 소유한다. 기존 documents/project-documents의 보호 originalText·projects/routes·access/project-command를 소비한다. 적용 forward20 `db/migrations/0004_design_index.sql`과 runner20은 기존 SQL을 수정하지 않는다. `features/design-trace/design-index-api.ts`/`DesignIndexViewer.tsx`·DocumentsPage의 명시 읽기가 대응하며 FN04 단위4/조회 단위2·UI06 fixture29·actual은 WORK_STATUS와 대조한다. 등록 UI·작업계획/trace edge는 아직 미연결이다.

## 2026-10-16 FN11·FN03/UI06 실제 연결 범위

복합 충돌/대상 교체 후속: 기존 conflict-api/DocumentEditor는 명시 LATEST_METADATA 수동 초안과 거절 snapshot을 보존한다. review-api/confirmation-api·대응 편집기·DocumentsPage 및 작은 mutation-result helper는 명확한 거절의 명시 보관과 새 대상 초기화를 담당한다. 단절/손상 뒤의 4xx는 uncertain을 해소하지 않는다. unit65/UI06 fixture27, actual exactae2c3fd5 1 PASS/3017ms가 대응하며 SQL19 불변이다. 과거 미연결 문구는 이력이며 실제 source/단계·browser DB/체크포인트 영속 보관은 후속이다.

보관 목록/재개 후속: server `documents/material-list.ts`와 projects routes가 현재 회원·상태/대상·유한 cursor 목록을 제공한다. Web `MaterialLibrary.tsx`/`materials-api.ts`와 `forms-api.getPinnedForm`, `proposal-api.readStoredProposal/resumeStoredProposal`이 상세 원문 재검증·명시 준비를 연결한다. 기존 후보는 재생성하지 않고 원본 첨부와 새 초안 명령만 만든다. 저장 제안은 과거 upload/propose를 합성하지 않는 읽기 binding과 새 apply 명령으로 구분한다. fixture22개(20+추가2), 동일 Web client actual1/2712ms는 아래 이전 미연결 기록을 대체한다. 소스 드리프트·전체 browser DB 여정은 미완료다.

제안 후속: server `documents/document-diff.ts`가 손실 없는 앞/뒤 동일 줄을 제외한 유한 변경 구간을 만들고 `project-proposals.ts`/기존 project-documents/routes가 제안/GET/명시 새 초안 선택을 집행한다. `0003_document_proposals.sql`은 forward19로 불변 제안/선택과 기존 artifact의 서버 diff1개만 추가 허용하며 기존18은 수정하지 않는다. Web `proposal-api.ts`·기존 DocumentEditor/상위 DocumentBuffer는 upload/propose와 apply를 별도 명령으로 보존하고 기준/제안/diff의 바이트/hash와 첨부·목차를 비교한다. `tests/unit/document-diff.test.ts`, `tests/unit/UI06/proposal-api.test.ts`, 기존 document-edit fixture와 actual FN03이 대응한다. 저장한 후보/제안 목록 재개·소스 드리프트·전체 browser↔DB는 미완료다.

가져오기 후속: server `documents/project-imports.ts`는 후보 저장/GET·선택 조건, `text-import.ts`는 유한 UTF-8 무변환 파서, 기존 project-documents/routes는 importDocument와 saveDocumentDraft(importCandidateRef)를 소비한다. 새 `db/migrations/0003_document_imports.sql`은 명시 runner의18번째이며 기존17 수정0. Web `features/design-trace/import-api.ts`/`DocumentImport.tsx`는 App 상위 DocumentBuffer에 원본/동일 명령을 보존하고 명시 후보 생성→원문 확인→선택→기존 편집기의 별도 초안 저장을 연결한다. 기존 editor-api의 같은 제한된 명령 전송 함수를 공유하되 import/초안 연산의 각 입력 검사는 유지한다. `tests/unit/document-import.test.ts`, `tests/browser/UI06/document-import.spec.ts`, 기존 FN03 actual 시험이 각각 파서 실패·화면/단절·현재 권한/실제 DB/FS와 선택 이력을 검증한다. 수정 제안·서버 diff·후보 목록 재개·실제 browser↔DB 여정은 아직 미완료다.

확정 후속: server `document-validation.ts`(실제 필수 본문/반복 필드 검사)·`project-confirmation.ts`(정확 head/hash/양식 준비/최신 검토·별도 허가)·`project-documents.ts`/projects routes와 forward17 `0003_document_confirmations.sql`/명시 migration runner를 연결한다. Web `confirmation-api.ts`/`DocumentConfirmation.tsx`와 App 상위 요청 버퍼는 사용자 별도 확인·정확 receipt·단절/인증 경계를 담당한다. `conflict-api.ts`/DocumentEditor는 명확한 저장409만 유한 최신본 읽기→비교→별도 선택으로 새 초안을 준비한다. 양식/첨부/형식 변화·미확인 명령을 자동 대체하지 않는다. unit FN03/UI06·UI06 fixture14·동일 클라이언트 actual FN03/FN11 2 PASS가 대응하며 전체 browser↔DB·FN04/FN05는 미검증/미구현이다. 아래 미연결 문구는 이전 checkpoint의 이력이다.

UI06 내용검토 작성 후속: `features/design-trace/DocumentReviewEditor.tsx`/`review-api.ts`와 App 상위 검토 버퍼는 실제 양식별 기준/판단/근거·종합 판단을 exact 문서 version/hash에 결박하고 기존 PROJECT recordContentReview를 소비한다. 다른 사용자 입력 숨김, 단절/409의 동일 명령만 명시 재확인, 중단 화면 요청0, 편집/검토 진입 분리를 구현했다. `tests/unit/UI06/review-api.test.ts`·`tests/browser/UI06/document-review.spec.ts`와 FN03 actual의 동일 클라이언트 검토/replay/기록1·미확정 유지가 대응한다. 새 SQL/서버 연산/실행 권한은 추가하지 않았다. 아래의 이전 검토 작성 미연결 문구는 후속 전 이력이고 현재 별도 confirmDocument·충돌 조정/추적은 여전히 미구현이다.

UI06 후속: `features/design-trace/DocumentEditor.tsx`/`editor-api.ts`는 기존 문서의 제목/본문/목차 위치·이유를 새 불변 초안으로 저장하며 원래 텍스트 형식/첨부·고정 양식 ref를 유지한다. `NewDocumentForm.tsx`는 현재 공식/본인 양식의 exact version을 선택해 빈 새 문서 초안을 연다. App 상위 버퍼가 사용자/프로젝트별 입력과 미확인 upload/save 명령을 탭 안에 보존하고 다른 로그인 사용자에게 숨긴다. 기존 API/DB/SQL16만 소비, 새 server write route/권한 없음. `tests/unit/UI06/editor-api.test.ts`, `tests/browser/UI06/document-edit.spec.ts`, 기존 FN03 actual 시험이 각각 중단/hash/형식·화면/인증 경계·동일 클라이언트 실제 저장을 나눠 검증한다. 충돌 조정·확정/추적은 남아 있다.

후속 `apps/server/modules/documents/project-content-review.ts`는 고정 양식 기준의 사람 recordContentReview·검토 이력 조회를 처리한다. `0003_project_document_reviews.sql`은16번째 forward, 기존 DRAFT/공통 보호를 유지하고 PROJECT DOCUMENT만 현재 권한/명령/receipt에 결박한다. 같은 FN03 integration 시험에 명시 권한·옛 버전/위조·판정 음성과 미확정 유지가 추가됐으며 UI06은 검토 이력/같은 작성자 표시를 조회한다. 편집/검토 작성 화면·사용자 별도 확정은 여전히 후속이다.

- `apps/server/modules/access/project-command.ts`: 현재 OWNER/client/control 세대·명시 자료 정책/불변 개정·거절 감사·replay 전 재허가. `0011_project_policy_control.sql`은13번째 forward다.
- `apps/server/storage/artifact-store.ts`, `modules/documents/project-files.ts`: 승인 root의 프로젝트별 원문 byte/hash·20MiB 상한·10GiB 프로젝트 용량·exact 파일 응답. `0003_project_artifacts.sql`14번째, 자동 GC·실제 서비스 설정 변경 없음.
- `apps/server/modules/documents/project-documents.ts`: 원문+양식 exact ref의 불변 초안 버전·구버전·현재 목록/서명 cursor. `0003_project_documents.sql`15번째. 내용검토/확정·파서/제안/소스 연결은 후속 미구현이다.
- `apps/web/src/features/design-trace/api.ts`/`DocumentsPage.tsx`: UI06 문서/버전 목록과 bounded bytes/hash 검증 후 escaped 텍스트·검사/이력 조회. App은 사용자/프로젝트 변경 시 component key로 조회 상태를 분리한다. 실제 편집·작성/확정/추적 화면은 남아 있다.
- 검증: `tests/integration/FN03/document-storage.test.ts`, `tests/integration/FN11/project-policy.test.ts`는 WSL actual, `tests/browser/UI06/document-read.spec.ts`는 모든 API를 차단·대체하는 화면 fixture다. 전자는 API/DB/파일, 후자는 클릭/구버전/스크립트 비실행·변조 차단만 증명한다.

## P03 초기 실제 생성 범위

공통 단일 package/lock와 `.gitattributes`로 시작한다. 별도 app별 dependency 복제를 만들지 않으며 서버 `config.ts`·`main.ts/app.ts`, 웹 index/main·vite/tsconfig, 공통 `canonical/catalog/generated-types/references`·refs schema와 타입 생성 script를 먼저 구현했다. 로그인·업무 UI/Agent는 해당 FN/UI에서 추가한다. 시험은 `tests/unit/P03/{config,database-config,health,web,resource-guards}.test.ts`·기존 공통 계약 시험·`tests/integration/P03/storage.test.ts`다.

자원 준비의 정확 소유 파일은 `scripts/{prepare-dev-https.ps1,provision-development.ts,development-resource-guards.ts,migrate-development.ts}`, `apps/server/storage/development-config.ts`, `db/migrations/0000_environment.sql`, `db/qa/fixtures.json`이다. 0000은 migration 이력·분리된 합성 QA 자료 저장만 하며 실제 사용자/프로젝트 schema를 대체하지 않는다. P03 setup/test와 FN01 실제 제품 저장을 혼동하지 않는다.

Windows의 새 app DB 보호 참조·소유 runtime 준비는 `scripts/link-development-db.ts`와 `scripts/start-development.ps1`, 승인 CA·엄격한 TLS의 단일 health 읽기는 `scripts/check-development-https.ts`에 둔다. 기존 Secret/사용자 프로필/공유 process를 다루지 않고 새 app 역할·포트3830/5546만 소비한다. receipt와 키/연결 설정은 Git 제외 `.av3-data` 안에서만 관리한다.

상태: **승인 A안의 상세 명세 / 제품 파일 미생성**. 2026-10-15 Main 어울. TD-01 승인 범위에서 TypeScript·React/Node/Fastify·Electron·PostgreSQL/파일의 책임을 고정한다. 이 문서는 파일 생성·설치·DB 변경·실제 Agent 호출 승인이 아니다. P03의 기준선/명령/환경 수용 후 해당 업무 시작 패킷에 정확한 파일을 열거한다.

## 1. 경로와 단일 writer

2026-10-16 구현 관측: Stage A/P03 source는 main PR41로 통합했다. Stage B/UI00은 §1의 App/shell/api/styles·시험을 작성 중이며 `apps/web/src/vite-env.d.ts`는 Vite CSS 타입 진입점, `tests/unit/UI00/routes.test.ts`는 경로 거절/프로젝트 유지 검수로 추가한다. FN01 access `service.ts`는 native Node Argon2id/세션 판정을 먼저 구현하며 실제 routes/repository·DB 연결 전에는 부분 구현이다. 아래 ‘파일 미생성’의 초기 상태를 현재 전체 사실로 해석하지 않는다.

동일 Stage B의 `scripts/start-development.ps1`은 실제 branch·LOCAL_UNCOMMITTED/COMMITTED_SOURCE를 receipt에 기록하도록 메타데이터를 보완한다. 기존 Stage A branch 상수는 Stage B 시작 시 틀린 값이 실제 출력됐고, 로컬 dirty Web build를 exact commit 검증으로 오인하지 않도록 하는 변경이다. 공통 port·CA·권한·DB 연결은 그대로다.

FN01 추가 관측: access `routes.ts/repository.ts/service.ts`와 0001의 실제 인증 저장을 연결 중이다. `tests/unit/FN01/auth-http.test.ts`는 DB 이전 Origin/무인증/추가필드 거절, 기존 auth-postgres는 실제 저장·cookie/CSRF·회수를 대조한다. 초기 적용 migration은 수정하지 않으며 후속 변경은 새 migration으로 한다. 실제 운영 계정/기존 인증 서버는 제외한다.

FN01 조회 연결의 정확 파일은 `apps/server/modules/projects/{routes,repository,service}.ts`, `tests/unit/FN01/project-list.test.ts`, `tests/integration/FN01/project-read.test.ts`다. 공통 인증 gate는 access repository의 서버 내부 `authenticated`를 사용하고 raw credential을 내보내지 않는다. 목록 cursor는 같은 보호 key의 용도 구분 HMAC만 소비하며 키를 새로 만들지 않는다. FN01 생성/방법론·기준선 연결 완료를 대신하지 않는다.

FN01 중간 저장의 실제 생성/중복·다른 client·stale·별도 연결 재조회 검사는 `tests/integration/FN01/draft-storage.test.ts`다. WSL의 기존 app 참조와 별도 기존 migrator 참조(`ANVIL_QA_CLEANUP_CONFIG`)를 읽되 비밀을 출력/복사하지 않는다. 이번 무작위 QA 소유자 삽입 성공을 추적한 뒤 그 초안/명령/감사만 정확 정리한다. 제품 app 감사 변경 금지와 실제 사용자/원본 보존은 유지한다.

UI00 실제 인증 연결의 추가 정확 파일은 `apps/web/src/shell/AuthForm.tsx`, `tests/browser/FN01/auth-live.spec.ts`다. 같은 auth route/storage·승인 CA·전용 개발 DB를 소비하는 실제 초기 등록/로그인 브라우저 검수이며 예시 화면 fixture와 구분한다.

공식 프로젝트 root는 `D:\Project\Anvil`이다. 아래는 그 상대 경로이며 경로 이동/변경은 영향 업무와 함께 기록한다. `{a,b}` 표기는 열거한 정확한 두 파일을 뜻하며 glob·하위 폴더 전체 권한이 아니다. 등록되지 않은 파일이 필요하면 Main이 이유/소유/소비자를 갱신한다. Backup·기존 자료·Secret·Git 메타데이터는 제품 writer 범위가 아니다.

| 공통 파일 | 소유·소비 |
|---|---|
| `package.json`, `package-lock.json`, `tsconfig.base.json`, `.gitignore` | P03 초기 설정. 이후 변경 업무의 명시 허가로만 수정 |
| `apps/web/{package.json,tsconfig.json,vite.config.ts,index.html}` | P03 최소 실행, UI00 이후 공통 변경 조율 |
| `apps/web/src/{main.tsx,App.tsx}`, `apps/web/src/shell/{AppShell.tsx,routes.ts,StatusView.tsx}`, `apps/web/src/styles/{tokens.css,app.css}`, `apps/web/src/api/{client.ts,errors.ts}` | UI00. 다른 화면은 호출/사용만 하고 임의 수정하지 않음 |
| `apps/server/{package.json,tsconfig.json,app.ts,main.ts}`, `apps/server/http/{errors.ts,context.ts,register-routes.ts}` | P03 최소 실행, FN01/FN11이 실제 인증/권한 연결. health와 기능 성공 구별 |
| `contracts/common/{command.schema.json,event.schema.json,error.schema.json,page.schema.json,refs.schema.json}` | P02 명세, P03 코드 형태 확정 뒤 공통 계약 소유자만 수정 |
| `contracts/{catalog.ts,generated-types.ts}`, `scripts/generate-contract-types.ts` | P03의 schema 단일 원본→타입 생성·검증. generated-types는 수동 수정 금지. 생성 도구/버전은 lockfile과 COMMAND_MAP에 고정 |
| `db/migrations/README.md`, `apps/server/storage/{postgres.ts,blobs.ts,transactions.ts}` | FN01 초기 저장 연결, FN03 파일 저장·FN11 원자성 소비. 실제 migration/영속 자원은 별도 승인 대조 |
| `apps/connector/{package.json,tsconfig.json,main.ts}`, `apps/connector/transport/{client.ts,protocol.ts}` | P03 실행 틀만, FN06/08 실제 연결. 인증 등록 전 listener/Agent 시작 없음 |
| `apps/desktop/{package.json,tsconfig.json,main.ts,preload.ts,forge.config.ts}` | FN18. renderer는 web 공통 소스 사용, 별도 프로젝트 데이터 없음 |

JSON schema는 제품 개발자가 검토한 신뢰 계약만 등록한다. 사용자 방법론/문서 양식을 이 schema compiler의 실행 코드로 받지 않는다. 타입 생성 자체를 위한 별도 대형 도구는 만들지 않으며 P03에서 최소 도구를 선정한다.

## 2. 화면별 정확 파일

각 row의 page 파일과 `api.ts`는 해당 기능 폴더 안의 정확한 두 파일이다. 스타일 추가는 같은 폴더의 `style.css`를 명시한 경우만 허용한다. 공유 동작/계약을 복제하지 않는다.

| 업무 | 파일 | 소유 시험 파일 |
|---|---|---|
| UI00 | §1 shell·api·styles 파일 | `tests/browser/UI00/shell.spec.ts`, `tests/unit/UI00/api-client.test.ts` |
| UI01 | `apps/web/src/features/projects/{ProjectsPage.tsx,api.ts}` | `tests/browser/UI01/projects.spec.ts` |
| UI02 | `apps/web/src/features/project-create/{ProjectCreatePage.tsx,api.ts}` | `tests/browser/UI02/project-create.spec.ts` |
| UI03 | `apps/web/src/features/methodology-editor/{MethodologyEditorPage.tsx,api.ts}` | `tests/browser/UI03/methodology-editor.spec.ts` |
| UI03 프로젝트 전용 후속 | 기존 디렉터리 `ProjectMethodologyPage.tsx`, `project-api.ts`·CommonMethodEditor/MethodReviewPanel의 명시 gateway·App 프로젝트별 버퍼 | `tests/browser/UI03/project-methodology.spec.ts`, `tests/unit/FN02/project-method-web.test.ts`·실제 연결은 FN02 project-methodology.test.ts. 확정/개정·과거 원문 조회와 실제 적용 전환 미완료를 분리 |
| UI04 | `apps/web/src/features/workspace/{WorkspacePage.tsx,api.ts}` | `tests/browser/UI04/workspace.spec.ts` |
| UI05 | `apps/web/src/features/session-detail/{SessionDetailPage.tsx,api.ts}` | `tests/browser/UI05/session-detail.spec.ts` |
| UI06 | `apps/web/src/features/design-trace/{DesignTracePage.tsx,api.ts}` | `tests/browser/UI06/design-trace.spec.ts` |
| UI07 | `apps/web/src/features/design-change/{DesignChangePage.tsx,api.ts}` | `tests/browser/UI07/design-change.spec.ts` |
| UI08 | `apps/web/src/features/decisions/{DecisionsPage.tsx,api.ts}` | `tests/browser/UI08/decisions.spec.ts` |
| UI09 | `apps/web/src/features/transfers/{TransfersPage.tsx,api.ts}` | `tests/browser/UI09/transfers.spec.ts` |
| UI10 | `apps/web/src/features/knowledge/{KnowledgePage.tsx,api.ts}` | `tests/browser/UI10/knowledge.spec.ts` |
| UI11 | `apps/web/src/features/connections/{ConnectionsPage.tsx,api.ts}` | `tests/browser/UI11/connections.spec.ts` |
| UI12 | `apps/web/src/features/control-handoff/{ControlHandoffPage.tsx,api.ts}` | `tests/browser/UI12/control-handoff.spec.ts` |
| UI13 | `apps/web/src/features/mobile/{MobileWorkspace.tsx,MobileTabs.tsx}` | `tests/browser/UI13/mobile.spec.ts` |
| UI14 | `apps/web/src/features/settings/{SettingsPage.tsx,api.ts}`, `apps/web/src/features/overview/OverviewPage.tsx` | `tests/browser/UI14/settings.spec.ts` |

UI13 소비 UI04/UI08의 반응형 조정, UI14 소비 scheduler·backup API처럼 다른 소유 파일의 실제 수정은 시작 패킷에 함께 열거한다. 위 표만으로 다른 업무 파일의 쓰기 권한을 얻지 않는다.

## 3. 기능별 서버·계약·시험 파일

UI02 초기 중간 저장은 기존 `features/project-create/{ProjectCreatePage.tsx,api.ts}`·`tests/browser/UI02/project-create.spec.ts`와 추가 `tests/unit/UI02/draft-api.test.ts`로 연결한다. App은 탭의 입력·미확인 command만 보존하고 실제 세션/권한은 서버에서 재확인한다. 완료된 UI00/01의 공유 App·새 프로젝트 진입·CSS 수정 이유는 중간 입력을 버리지 않고 같은 저장을 명시 재확인하기 위한 것이며 범위를 해당 소비부로 한정했다.

아래 ‘서버 모듈’의 정확한 공통 파일은 `apps/server/modules/<명칭>/{routes.ts,service.ts,repository.ts}`다. 행당 지정한 모듈만 해당하며 사용하지 않는 빈 repository/빈 함수를 형식상 만들지 않는다. 쿼리·명령의 타입/필수값·응답/오류 원본은 `contracts/<명칭>.schema.json`이며 함수명/실제 연산은 INTERFACES에 연결한다.

| 업무 | 서버 모듈·공통 schema 명칭 | 추가 정확 파일 | 소유 시험 파일 |
|---|---|---|---|
| FN01 | projects, access | `db/migrations/0001_projects_access.sql` | `tests/unit/FN01/projects.test.ts`, `tests/integration/FN01/projects-postgres.test.ts` |
| FN02 | methodologies | `db/migrations/0002_methodologies.sql`, `apps/server/modules/methodologies/builtins.ts` | `tests/unit/FN02/graph.test.ts`, `tests/integration/FN02/versions.test.ts` |
| FN02 PROJECT 개정·검토·확정 | `apps/server/modules/methodologies/{project-input.ts,project-methodologies.ts}`, 기존 project-command/routes·새 forward `0002_project_methodology_revisions.sql`/명시 runner | `tests/unit/FN02/project-method-input.test.ts`, `tests/integration/FN02/project-methodology.test.ts`·기존 FN01 draft-create 회귀. USER_COMMON/초기 생성/적용 guard 보존·적용은 실행 상태 미확인412 |
| FN02 내장·구조 검사 | `contracts/methodologies.ts`·기존 `apps/server/modules/methodologies/service.ts` | 승인 원문·공식 양식 ref로7단계·사람 확인·자료형 조건·유한 동일 실패 재작업 제공. 실제 실행/승인 binding·JSON schema/DB/API 미완료 | `tests/unit/FN02/builtins.test.ts`, 기존 graph.test.ts |
| FN02 내장 저장/조회 | 기존 methodologies `repository.ts`/`routes.ts`·추가 `catalog-seed.ts`·`app.ts`/`scripts/migrate-development.ts` | 계획0002 버전/범위 분리, 공식 원문 출처만 seed·사람 검토/확정 자동 생성0. 직접 쓰기 API/적용·cursor 미완료 | `tests/unit/FN02/api-access.test.ts`, `tests/integration/FN02/versions.test.ts` |
| FN02/FN11 본인 공통 쓰기 | `apps/server/modules/methodologies/common-write.ts`, `db/migrations/0011_user_common_control.sql`·기존 app/runner | 직접 승인한 USER_COMMON 명령·receipt·감사·소유자 guard, 내장본 복사/좌표 포함 불변 개정. 확정·양식 쓰기는 아직 미구현 | `tests/integration/FN02/common-write.test.ts`, 기존 api-access.test.ts |
| FN03/FN11 공통 양식 쓰기 | `apps/server/modules/documents/{common-write.ts,form-validation.ts}`, `apps/server/modules/access/common-command.ts`, `db/migrations/0011_user_common_forms.sql`·기존 공통 명령 route/runner | 본인 양식 복사/불변 개정·공식 원본 쓰기 차단·저장 기준 exact 참조. 공통 receipt는 내부 저장만 재사용, 확정/검토는 후속 | `tests/unit/FN03/custom-form.test.ts`, `tests/integration/FN03/common-form-write.test.ts`, 기존 방법론 쓰기 시험 |
| FN03/FN11 공통 양식 내용검토/확정 | `apps/server/modules/documents/content-review.ts`, `db/migrations/0011_user_common_content_reviews.sql`·기존 공통 명령/양식 repository | 본인 공통 exact ref·고정5기준·실제 검토자/동일 작성 주체 여부·append-only 검토와 별도 확정. 현재 FORM만 지원, 다른 도메인/할당 Agent 검토/실행은 미구현 | `tests/integration/FN03/form-review.test.ts` |
| UI03 본인 공통본 작성 연결 | `apps/web/src/features/methodology-editor/{CommonMethodEditor.tsx,common-api.ts}`·기존 MethodologyEditorPage/App | 복사·직접 초안·단계 목적/좌표·조건 개정·저장/정확 재조회. 입력/미확인 명령은 탭 메모리에 보존, 실제 Agent 시작0·전체 흐름도 편집/확정 미완료 | `tests/unit/FN02/common-client.test.ts`, 기존 methodology-editor.spec.ts |
| UI03 공간형/단계·연결·문서 편집 | `apps/web/src/features/methodology-editor/{MethodGraphCanvas.tsx,NodeDefinitionFields.tsx,NodeDocumentFields.tsx,GraphRelationsEditor.tsx,ConditionEditor.tsx}`·기존 편집/App 상태·scoped CSS | SVG 선택/확대/좌표·기본/복합 판단 자료·입출력 양식 exact ref·사람/도구 역할/합류·유한 재작업 정의. Agent 실행·권한·정책 허가 아님 | 기존 methodology-editor.spec.ts·FN02 graph.test.ts/common-write.test.ts |
| UI03 본인 공통 양식 편집 | `apps/web/src/features/methodologies/{CommonFormEditor.tsx,form-editor-state.ts}`·기존 FormsCatalog/forms-api/App·공통 명령 client | 공식본 복사·새 양식·역할/목차/필수·반복 필드·작성/검토 기준 개정·초안 저장/정확 재조회. SYSTEM 읽기 기준은 유지·USER_COMMON 미완성 초안만 별도 조회 | 기존 forms.spec.ts·`tests/unit/FN03/form-draft-client.test.ts` |
| UI03 본인 양식 검토/확정 | `apps/web/src/features/methodologies/FormReviewPanel.tsx`·기존 FormBuffer/FormsCatalog/forms-api/공통 명령 client | 5개 기준의 사람 직접 판단/이유·별도 확정·정확 재조회, 작성 기록자 동일 여부 공개·입력/미확인 명령 보존. 실제 시험/독립 검수/실행 승인으로 승격0 | 기존 forms.spec.ts·form-draft-client.test.ts |
| FN02 계약15.3 정정 | `db/migrations/0002_builtin_condition_contract.sql`·기존 builtin/service/types/seed/runner | 구형 v1 원본은 보존하고 fieldRef/operator/value·all/any/not 조건의 v2 추가. 실제 v1 사용/확정이 있으면 head 변경 전 실패 | 기존 FN02 graph/builtins/versions 및 UI03 조회 시험 |
| FN03 | documents, imports | `db/migrations/0003_documents.sql`, `apps/server/modules/documents/forms.ts` | `tests/unit/FN03/forms-import.test.ts`, `tests/integration/FN03/documents.test.ts` |
| FN03 초기 catalog 연결 | `apps/server/modules/documents/{repository.ts,routes.ts,catalog-seed.ts}`·기존 `apps/server/app.ts`/`scripts/migrate-development.ts` | 승인 원문 기반8종/공통 작성 기준 고정 버전, 계획0003 catalog부터 forward-only 적용·후속 문서 저장은 별도 migration | `tests/unit/FN03/form-access.test.ts`, `tests/integration/FN03/forms-catalog.test.ts` |
| UI03 초기 catalog 연결 | `apps/web/src/features/methodologies/{FormsCatalog.tsx,forms-api.ts}`·기존 `App.tsx`/`styles/app.css` | 전역 방법론의 공식 양식 조회·원문/필수 항목·정확 ref 검증, 공유 변경은 경로 분기/읽기 스타일에 한정. 방법론/문서 작성 전체 완료 아님 | `tests/browser/UI03/forms.spec.ts` |
| FN04 | traceability, design_changes | `db/migrations/0004_trace_changes.sql` | `tests/unit/FN04/impact.test.ts`, `tests/integration/FN04/trace.test.ts` |
| FN05 | knowledge, constitution, context | `db/migrations/0005_knowledge.sql` | `tests/unit/FN05/context.test.ts`, `tests/integration/FN05/knowledge.test.ts` |
| FN06 | connections, environments | `apps/connector/adapters/{adapter.ts,codex.ts}`, `db/migrations/0006_connections.sql` | `tests/unit/FN06/adapter.test.ts`, `tests/integration/FN06/codex-live.test.ts` |
| FN07 | FN06 공통 schema 소비 | `apps/connector/adapters/claude.ts` | `tests/unit/FN07/adapter.test.ts`, `tests/integration/FN07/claude-live.test.ts` |
| FN08 | executions | `apps/connector/runtime/{dispatch.ts,ownership.ts}`, `apps/connector/spool/{store.ts,sync.ts}`, `apps/connector/observers/facts.ts`, `db/migrations/0008_executions.sql` | `tests/unit/FN08/spool.test.ts`, `tests/integration/FN08/dispatch-recovery.test.ts` |
| FN09 | assignments, coordinator, understanding | `db/migrations/0009_assignments.sql` | `tests/unit/FN09/assignment.test.ts`, `tests/integration/FN09/bindings.test.ts` |
| FN10 | scheduling, quotas | `db/migrations/0010_scheduling.sql` | `tests/unit/FN10/scheduler.test.ts`, `tests/integration/FN10/queue.test.ts` |
| FN11 | policies, approvals, command_authorization, audit | `db/migrations/0011_authorization.sql`, `apps/server/http/authorize.ts` | `tests/unit/FN11/policy.test.ts`, `tests/integration/FN11/approval-race.test.ts` |
| FN12 | results, verification, issues | `db/migrations/0012_results.sql` | `tests/unit/FN12/verification.test.ts`, `tests/integration/FN12/results.test.ts` |
| FN13 | recovery, checkpoints | `apps/connector/stopping/{stop.ts,reconcile.ts}`, `db/migrations/0013_checkpoints.sql` | `tests/unit/FN13/stopping.test.ts`, `tests/integration/FN13/recovery.test.ts` |
| FN14 | transfers, handoff_bundles | `db/migrations/0014_transfers.sql` | `tests/unit/FN14/transfer.test.ts`, `tests/integration/FN14/handoff.test.ts` |
| FN15 | control_handoffs, client_ownership | `db/migrations/0015_control.sql` | `tests/unit/FN15/control.test.ts`, `tests/integration/FN15/control-race.test.ts` |
| FN16 | backups, exports, restore_validation | `db/migrations/0016_backups.sql` | `tests/unit/FN16/manifest.test.ts`, `tests/integration/FN16/restore.test.ts` |
| FN17 | notifications | `apps/web/src/notifications/{support.ts,client.ts}`, `db/migrations/0017_notifications.sql` | `tests/unit/FN17/notifications.test.ts`, `tests/integration/FN17/delivery.test.ts` |
| FN18 | FN08/FN15/FN16 소비 | §1 desktop 파일, `apps/desktop/{security.ts,lifecycle.ts}` | `tests/desktop/lifecycle.spec.ts`, `tests/desktop/package.spec.ts` |

이름의 migration 번호는 파일 식별자이고 실행 순서/업무 순서가 아니다. Stage B에서 FN11을 먼저 개발하더라도 미구현 FN06~10 migration을 만들어 채우거나 번호순 개발을 강요하지 않는다. 실제 migration runner·schema 의존 DAG·checksum과 적용 순서는 P03/저장 업무에서 확정하며 이미 적용된 파일은 고치지 않는다. migration 내용/실제 적용은 승인된 데이터 계약과 별도 실행 경계를 대조한다.

첫/둘째 어댑터 파일명은 현 후보를 명시한다. 공급자 지원·인증 계약이 충족되지 않으면 허위 구현 대신 CAPABILITIES에 미확인을 남기고 대체 결정을 기록한다. Windows Job Objects·Secret 보호의 실제 binding/helper 파일은 검증 경로 선정 전 임의 추가하지 않는다. 정확 helper/bridge/검수 파일은 §9·TECH_DECISIONS §11에 추가했으며 실제 동작은 미검증이다.

## 4. 통합·산출물·검수 소유

IX01~IX08 각각 `tests/integration/<ID>/journey.test.ts`, `tests/browser/<ID>/journey.spec.ts`를 소유한다. IX06/FN18의 desktop 검사는 위 desktop 파일을 소비한다. 공통 `tests/helpers/{qa.ts,server.ts}`·최소 시험 설정은 P03 소유, 확장은 실제 소비 업무가 이유/영향을 기록한다. fixture/단위/실제 DB/실제 Agent/브라우저 검사를 분리하고 live 미연결을 통과로 바꾸지 않는다.

공식 결과 위치는 `docs/04_test_reports/AV3/<ID>/{RESULT.md,manifest.json}`다. 실제 코드/파일diff·명령/exit·QA ID·환경/버전·미실행·정리·rollback을 포함한다. 전체 진도는 WORK_STATUS 하나에 누적하고 업무별 보고와 링크한다. 문서 존재만으로 완료를 세지 않는다.

## 5. 미확정 경계

외부 검토 보완으로 FN01의 access 모듈이 사용자 인증·참여 권한·최초 client/control 저장을, FN11 audit 모듈이 공통 허가/거절·결정/소비 감사를 소유한다. FN15 client_ownership은 이 기반의 전환 연산을 소비하며 별도 초기 제어 저장소를 중복 생성하지 않는다. 구체 인증/키·실행기 등록 방식은 INTERFACES §11~12·TECH_DECISIONS §11~12에 연결했고 실제 사용자 설정은 아직 없다.

현재 제품 파일은 생성하지 않았다. 인증/등록·OS binding·DB/보존/단절의 상세 기준은 §6~10·연결 계약을 따르고, 실제 OS/DB/Agent 검증과 P03 경로/port·패키지 lock·명령표는 별도 수행한다. FILE_MAP이 존재한다고 P02/P03 완료로 판정하지 않는다. `routes/service/repository`가 필요 없는 계산 전용 모듈은 실제 시작 패킷에서 파일을 줄이고 이유를 남기며, 관련 없는 공통화/리팩토링을 추가하지 않는다.

## 6. P02 재개 — 초기 저장 흐름의 명세 소비 위치

2026-10-16. 완료한 P01/지원 조사를 반복하지 않고 INTERFACES §9·DATA_MODEL §6을 추가했다. 아래는 기존 파일 목록에 대한 상세 소비 위치이며 제품 파일 생성·SQL 적용은 하지 않았다. 인증/정책/등록·나머지 연산의 잔여를 해소한 뒤 배정한다.

| 소유 | 명세·후속 정확 파일 | 검수 책임 |
|---|---|---|
| FN01 | INTERFACES §9.1~2/§11·DATA_MODEL §6.1~2/§8, `contracts/projects.schema.json`, `contracts/access.schema.json`, `db/migrations/0001_projects_access.sql` | UI01/02 초안·생성·기준선·TD-02 전용 로그인 상세, 프로젝트/초안 격리·재시작 재조회. 실제 보안/DB 시험은 미실행 |
| FN02 | INTERFACES §9.3·DATA_MODEL §6.3, `contracts/methodologies.schema.json`, `db/migrations/0002_methodologies.sql`, 기존 builtins.ts | 승인 내장3종·사용자 공통/전용·복사·버전 고정·graph/좌표/문서·확정/적용 경계 |
| FN03 | INTERFACES §9.4·DATA_MODEL §6.4, `contracts/documents.schema.json`, `contracts/imports.schema.json`, `db/migrations/0003_documents.sql`, 기존 forms.ts·blobs.ts | 공식8종·헌법 별도 문서·사용자 양식·원본/추출·본문/제안/이전 버전. 파일/DB 실패·안전 렌더·타 프로젝트 참조 거절 |
| FN11 | INTERFACES §9.1·DATA_MODEL §6.5, `contracts/command_authorization.schema.json`, `db/migrations/0011_authorization.sql`, 기존 authorize.ts | 공통 command/버전/제어/권한 집행과 저장/감사 원자성. 이번 상세를 실제 구현/검수로 세지 않음 |

형태화된 schema와 SQL은 후속 구현 산출물이다. 현재 Markdown 명세를 기존 제품 schema가 존재하는 것으로 계산하지 않는다. `contracts/<명칭>.schema.json`이 schema의 실제 파일 명칭이고, 업무 카드의 `contracts/documents/` 같은 폴더 표현은 논리 책임 범위였음을 구별한다. 문서만으로 해당 폴더/파일을 일괄 생성하지 않는다.

## 7. P02 후속 코어 — 승인·계획/추적·원문/맥락

FN01 초안/프로젝트가 소비하는 FN11 저장 기반의 정확 신규 검사 파일은 `tests/integration/FN11/authorization-schema.test.ts`다. 실제 0011 테이블·append 감사 DML 제한을 검수하며 schema 존재만으로 권한/승인 집행이나 전체 FN11 완료로 표시하지 않는다.

INTERFACES §10·DATA_MODEL §7은 다음 기존 소유 모듈을 소비한다. FN04의 작업계획 저장/확정은 traceability 모듈의 `service.ts/repository.ts` 안의 별도 연산이고 범용 프로젝트 관리 subsystem을 새로 만들지 않는다. 추가된 공개 operation 명칭은 기존 요구의 누락 보완이며 실제 API 호환성 변경/배포가 아니다.

| 소유 | 실제 schema·migration 참조 | 실제 구현 뒤 필요한 검수 |
|---|---|---|
| FN11 | `contracts/{policies,approvals,command_authorization,audit}.schema.json`, `db/migrations/0011_authorization.sql`, `apps/server/http/authorize.ts` | 요청/결정/소비 분리·동시 결정/소비·현재 정책/권한/세대·본문 hash·한 명령·거절 부작용0, 감사 실패·권한 없는 변경 차단 |
| FN04 | `contracts/{traceability,design_changes}.schema.json`, `db/migrations/0004_trace_changes.sql`, traceability/design_changes 모듈3파일씩 | 설계/화면 위치↔업무/시험·AF04 card·두 선행·초안/확정·영향/UNKNOWN·승인/계획 적용·과거 근거/무관 작업 유지 |
| FN05 | `contracts/{knowledge,constitution,context}.schema.json`, `db/migrations/0005_knowledge.sql`, knowledge/constitution/context 모듈3파일씩 | 원문·가설/결정/이유·정정/사용제외/공유 승인·project 검색 격리·manifest·누락 공개·서버 조회/후속 전달·6항목 이해/검토 주체 |

시험 파일은 §3의 각 FN 소유 목록을 유지한다. FN05의 실제 외부 전달/이해와 FN04 변경 중 writer 안전은 FN09/14/FN08/13의 실제 연동 뒤 검수하며, 원문/계획 저장·재조회·권한/중복 기본 검수를 그때까지 미루지 않는다. 시작 패킷은 공통 schema/서버 HTTP/storage를 함께 수정해야 하는 경우 그 정확 파일·이유·writer 순서를 열거한다.

## 8. TD-02 전용 로그인 상세 소비

Stage B 정확 추가 파일: `apps/server/modules/access/config.ts`(실행 보호 참조 검증), `setup.ts`(독립 비밀·배타 파일 생성), `scripts/initialize-development-auth.ts`(직접 승인된 신규 개발 초기화만), `tests/unit/FN01/{auth-config,auth-initialization,auth-http}.test.ts`. 실제 초기화는 기존 보호 root·새 두 파일·초기화 행1을 대조하며 기존 자료 덮어쓰기·실제 소유자 자동 생성은 없다.

UI00 인증 후속은 `apps/web/src/shell/AccountSecurity.tsx`·기존 `AuthForm.tsx/App.tsx/api/client.ts`와 `tests/browser/UI00/auth-security.spec.ts`다. 설정 화면의 로그인 보안만 연결하며 UI14의 백업/한도 기능 완료를 뜻하지 않는다.

FN01의 기존 access 모듈 `routes.ts/service.ts/repository.ts`와 `contracts/access.schema.json`이 INTERFACES §11/DATA_MODEL §8을 소유한다. 암호/세션/CSRF·초기 claim 분리는 `apps/server/modules/access/{passwords.ts,sessions.ts,csrf.ts,setup.ts}`로 명시하며 범용 인증 서버를 추가하지 않는다. 공통 Context/authorize는 FN11과 단일 writer 순서로 결박한다. 실제 파일/라이브러리는 P03/업무 배정 뒤 생성한다.

추가 정확 시험 파일은 `tests/unit/FN01/auth.test.ts`, `tests/integration/FN01/auth-postgres.test.ts`다. UI00의 로그인/만료/재인증 표시는 기존 shell/StatusView 경계를 소비하고 보호/복구·초대의 실제 화면 위치는 P01 기준에 맞춘 상태/양식으로 상세 배정한다. 별도 OIDC·외부 발송 서비스·비용·실제 계정/키를 이번 선택으로 생성하지 않는다.

## 9. 연결·실행/회수 명세 소비

INTERFACES §12·DATA_MODEL §9는 FN06/07/08/13의 기존 modules/schema·Windows adapter/runtime/spool/observer/stopping 파일과 §3의 시험 파일을 소비한다. 서버 실행기 endpoint의 소유는 connections 모듈의 등록/credential 검사와 executions 모듈의 command/receipt/observation 집행으로 구별한다. 별도 공개 PC listener·원격 SSH 실행 subsystem을 만들지 않는다.

정확 추가 데이터 계약 파일은 `contracts/connector.schema.json`, `contracts/agent-adapter.schema.json`, `contracts/source-snapshot.schema.json`이며 FN06이 초기 소유하고 FN08/13이 Main 대조 후 확장한다. 서버측 credential 검사 helper는 `apps/server/http/connector-auth.ts`, 실행기 보호 저장소 인터페이스는 `apps/connector/security/secret-store.ts`다. OS 경로 상세안은 TECH_DECISIONS §11의 `apps/connector/native/{OwnershipHost.cs,ProtectedStore.cs}`, `apps/connector/runtime/windows-host.ts`, `scripts/build-windows-helper.ps1`다. FN08/13 소유/회수와 FN06 보호 저장이 단일 writer로 소비하며 `tests/unit/FN08/windows-host.test.ts`, `tests/integration/FN08/windows-ownership.test.ts`, `tests/unit/FN06/protected-store.test.ts`를 추가 검수한다. 아직 파일 생성/build/검증은 없으며 그 상태에서 변경 역할 READY를 허용하지 않는다.

등록/credential/범위·세대/ACK·관측의 제한된 계약 테스트는 기존 adapter/spool/dispatch-recovery 시험을 확장한다. 실제 도구의 승인·거부/한도·중지/회수·파일/exit·스풀 재연결은 FN06/07/08/13과 IX02~04의 실제 근거로만 판정한다. CAPABILITIES의 후보를 새 지원 확정/실측 기록으로 덮지 않는다.

## 10. 나머지 실행/이전·복구 계약과 공통 codec

INTERFACES §13~14·DATA_MODEL §10은 §3의 FN09~18 모듈·schema/migration/단위·통합/desktop 시험 목록에 그대로 배정한다. 부분 변경 보존/범위 복원은 recovery 모듈·실행기 stopping/runtime의 정확 허가 파일만 사용하고 범용 Git 조작 subsystem을 추가하지 않는다. task/기준/실행·검수/이전의 새 ID/상태는 같은 project 참조 resolver와 원자 command 집행을 소비한다.

공통 정규화/hash/참조 코드는 `contracts/{canonical.ts,references.ts}`와 `tests/unit/contracts/{canonical.test.ts,references.test.ts}`로 명시한다. JSON 객체 키를 정렬·배열 순서 유지·UTF-8/문자열 유효성·중복 키/비유한 수/지원 범위 밖 정수/unknown 필드를 거절하는 고정 wire 규칙을 서버가 적용한다. 비밀 auth 요청은 일반 codec 영속 경로에 넣지 않는다. helper는 서명할 canonical byte를 받으므로 다른 serializer가 조용히 다른 hash를 만들지 않게 벡터로 확인한다. 실제 코드/형식화된 schema는 아직 생성하지 않았다.

빠진 FN/UI 필드나 명칭을 과거 보관 코드에서 추측하지 않는다. 기존 schema 명칭 목록·새 정확 파일과 UI15/FN18 소비를 P02 종료 대조표에서 확인하고, 실제 검증 명령은 P03 COMMAND_MAP에 결박한다. OS helper/file store·형식별 parser/보호 렌더·라이브러리/lockfile 미확인은 해당 단계 전 해소하고 미검증을 숨기지 않는다.

생성 전 방법론 초안/검토는 projects/methodologies의 기존 routes/service/repository가 DRAFT scope를 명시해 처리하며 일반 프로젝트 dispatch를 노출하지 않는다. 공통 내용 검토의 데이터 계약 파일은 `contracts/content-review.schema.json`, 저장/감사는 기존 FN11 audit 모듈·0011 migration이다. 종류별 검토/확정 조건은 해당 domain service의 책임이며 새 범용 판정 엔진을 만들지 않는다. 생성/검토 누락 대조는 `tests/unit/FN02/draft-methodology.test.ts`, `tests/integration/FN01/draft-create.test.ts`, `tests/unit/FN11/content-review.test.ts`를 추가해 초안 stale·교차 소유·위조/자기 검토·원자 생성/원문 보존을 확인한다.

독립 P02 검토의 최초 소스 선언은 FN01 projects service/repository·0001·projects.schema, 문서 링크/관측 선택·구버전 제목/출처 보존은 FN03 documents service/repository·0003·documents.schema가 소유한다. 추가 시험 파일은 `tests/unit/FN01/source-declaration.test.ts`와 `tests/integration/FN03/source-links.test.ts`다. 초안 소유/귀속·실관측 없는 VERIFIED 거절, 링크 stale/경로 이탈·타 project 거절, 서버 유지/제안 수집/별도 분리·기존 확정본 불변, 제목/출처 개정 후 구버전 내용/hash 유지를 검수한다. 실제 소스 관측은 FN08 실행기 결과를 사용하고 문서·저장 시험의 fixture를 실제 호스트 검증으로 승격하지 않는다.

방법론 검토 구현: `apps/server/modules/methodologies/content-review.ts`, `db/migrations/0011_user_common_method_reviews.sql`, `apps/web/src/features/methodology-editor/MethodReviewPanel.tsx`, `tests/integration/FN02/method-review.test.ts`. 기존 FORM 보호의 forward 보완만 포함하며 기존 적용 migration 수정0.

방법론 읽기 페이지의 순수 필터/cursor는 `apps/server/modules/methodologies/list-page.ts`, 단위 증거는 `tests/unit/FN02/list-page.test.ts`, 실제 순회/격리는 기존 `tests/integration/FN02/versions.test.ts`에 둔다. 변경은 기존 목록 repository/routes와 UI03/생성 선택의 명시 읽기에 한정하며 schema/권한·새 도메인을 만들지 않는다.

프로젝트 초안 선택: `contracts/project-drafts.ts`의 자료형, `apps/server/modules/projects/draft-methodology.ts`의 owner/출처·확정/버전 검사, `apps/web/src/features/project-create/MethodologySelection.tsx`의 고정 버전 선택을 기존 초안 writer와 연결한다. 생성/초안 검토·확정은 아래 후속 연결을 따르며 파일 존재만을 전체 완료 근거로 쓰지 않는다.

프로젝트 전용 방법론 입력은 `apps/web/src/features/project-create/DraftMethodEditor.tsx`가 기존 UI03의 그래프/단계·입출력/조건 편집 부품을 소비하고 기존 초안 저장으로 보존한다. 공통본 writer를 호출하지 않는다. GET 기반 원본 복사는 같은 디렉터리 MethodologySelection이 정확 sourceRef를 남기며 명시 저장 전에는 서버를 쓰지 않는다.

2026-10-16 직접 승인 후속: `apps/server/modules/projects/draft-review.ts`가 현재 owner/client·exact draft ref의 recordContentReview/confirmDraftMethodology를, 기존 repository/routes가 최초 createProject를 처리한다. `db/migrations/0011_project_creation.sql`→`0011_draft_method_reviews.sql`은 기존10개 뒤의 forward DAG다. 첫 PROJECT 원본/고정 snapshot·owner/control1·명령/receipt/audit는 같은 transaction, 후속 PROJECT 개정·실행 허가는 별도다. UI는 `features/project-create/DraftReviewPanel.tsx`·기존 page/api·root buffer이며 `tests/integration/FN01/draft-create.test.ts`, `tests/browser/UI02/project-finalize.spec.ts`, `tests/unit/UI02/finalize-api.test.ts`가 실제/합성 경계를 나눠 확인한다. 문서 import/기존 소스/실제 UI DB/Agent는 이 연결의 완료 범위가 아니다.
