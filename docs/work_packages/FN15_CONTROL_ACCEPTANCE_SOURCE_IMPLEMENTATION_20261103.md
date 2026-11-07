# FN15 제어권 수락 source 단위 작업지시서

- 상태: MAIN_APPROVED_SOURCE_IMPLEMENTATION / IMPLEMENTATION_GO1 / SYNTHETIC_VALIDATION_GO1 / EXECUTION_GO0(실효과). Main의 동일 Primary 명시 dispatch와 시작 preflight 뒤에만 허용 경로 source writer를 부여한다.
- 개정: r7. 부모 r6 SHA256 FFF64865E8DD2DD72FF84B23D3D00792DE8202237897D442963A9BB63429607A. 새0073 pending SQL의 exact byte checksum을 보존하는 Git LF 규칙 한 파일을 추가했다. 현재 source 적용은 §14~16이며 실효과 EXECUTION_GO0을 유지한다.
- 이번 위임은 단일 기존 Primary의 허용42경로 코드·화면·미적용 SQL·합성 시험 구현이다. Git·WORK_STATUS·다른 문서는 Main 소유이며 실제 효과는 계속 제외한다. 결과는 증거/미검증/변경지문을 갖춘 구조화 보고로 반환한다.
- 실제 DB/권한/GRANT/정책 적용·키·서비스·Agent·네트워크·OS·사용자/백업 실자료·실컴파일·QA 자원 생성0.
- 기준 프로젝트: D:/Project/Anvil, branch codex/av3-stage-b, HEAD 998994a5fecb312064d128f793e73db8d1945f98. 이번 r3 문서 보완의 기준 checkpoint이며 제품 writer0이다.
- 목표: 승인된 요청→안전 대기→정확 대상 수락→원자적 옛 grant 회수/새 제어 세대·grant 발급→기존 일반 변경/UI12 소비를 source-only 한 기능 단위로 완성한다.
- 구조: 같은 authenticated Tx의 실제 DB reader와 기존 보호 reader가 자료를 생산하고, 서버 내부 출처·coverage·현재성·미정착 검산 뒤만 수락 CAS를 수행한다. 현재 실 공급자 부재는 UNKNOWN/수락0이다. nullable port나 미사용 adapter만 추가하고 완료하지 않는다.
- 기술: 기존 Node/TypeScript/PostgreSQL pending SQL/React·기존 의존성만 사용한다. 새 framework/dep/키/서명 목적/실행 driver를 도입하지 않는다.
- 수행 방식: 이후 Main이 구현 GO하면 기존 단일 writer가 superpowers:executing-plans와 TDD를 적용한다. 새 agent/branch/worktree는 이 WI로 허가하지 않는다.

## 1. 기채택 근거와 현재 공백

1. docs/design/Anvil_설계서_v3_초안.md §9.3: 한 사용자/한 활성 client, 같은 사용자 PC→모바일도 인수, 미수락 자동 전환0, 실행 중지와 제어 화면 이전 구분.
2. docs/work_packages/FUNCTION_WORK.md FN15(186~197): requestControl/prepareControlHandoff/acceptControl/checkControl, 동일 사용자 기기 전환 시 프로젝트 재시작·실행 임의 재dispatch0, 동시 수락1·옛 탭 승인0.
3. docs/contracts/INTERFACES.md §13.6(1049~1055): acceptControl(requestRef,summaryVersion,reason), 정확 대상·현재 권한/상태/세대 재검산, 이전 grant 회수·generation 증가·새 grant/이력의 단일 Tx, 동시1.
4. 같은 문서 §15.2(1107): HANDOFF_ELIGIBLE은 실제 수락·단독 제어 후 변경 가능하다. 이는 OWNER 자동 승격이 아니다.
5. docs/contracts/DATA_MODEL.md:404: control_handoffs의 현재/대상 actor/client, summary ref/version, accepted_at/state 및 기존 project_control 원자 전환.
6. 기존 FN15_CONTROL_REQUEST_SOURCE_IMPLEMENTATION.md의 A는 요청·불변 WAITING/UNVERIFIED 요약만 구현한 앞 단위다. 그 당시 accept 제외를 전체 FN15 미승인으로 확대하지 않는다.

현재 routes exactBody와 0041 operation CHECK는 requestControl/prepareControlHandoff만 받는다. control-handoff-pg.ts:407 collect()는 null, summary.ts는 SYNTHETIC_ONLY·acceptanceEnabled=false만 생산한다. UI12 수락은 disabled다. 실제 수락 생산·저장·현재 grant 소비가 누락되어 있다.

구현자는 과거 성공한 request/summary/read/분류·pagination 기능을 다시 만들지 않는다. source-only 검증을 actual PG/실두기기/OS 안전성 인수로 승격하지 않는다.

## 2. 정확 허용 경로 42개

아래는 Main 검수용 초안 allowlist다. 지금의 제품 쓰기 권한이 아니다. r2 신규11은 당시 조사에서 부재였고 0073 접두 migration도 없었다. r4 control-grant.ts/시험은 새 후보이며 구현 GO 직전 신규 전체13의 부재를 다시 검산한다. 코드 GO 직전 다시 확인한다.

### 2.1 기존 제품·설정19 — 필요한 접점만
- .gitattributes
- apps/server/modules/control-handoff/control-handoff-pg.ts
- apps/server/modules/control-handoff/routes.ts
- apps/server/modules/access/project-command.ts
- apps/server/modules/knowledge/project-knowledge-share-requests.ts
- apps/server/modules/executions/project-writer-authority.ts
- apps/server/modules/approvals/project-approvals.ts
- apps/web/src/features/control-handoff/api.ts
- apps/web/src/features/control-handoff/state.ts
- apps/web/src/features/control-handoff/ControlAccessPage.tsx
- apps/server/modules/projects/repository.ts
- apps/server/modules/projects/project-storage-quota.ts
- apps/server/modules/documents/project-documents.ts
- apps/server/modules/documents/project-files.ts
- apps/server/modules/documents/project-source-links.ts
- apps/web/src/features/design-trace/editor-api.ts
- apps/server/modules/control-handoff/control-request-read.ts
- apps/server/modules/control-handoff/control-handoff-summary-store.ts
- apps/server/modules/control-handoff/control-discovery-read.ts

### 2.2 신규 제품5·forward1·시험7
- apps/server/modules/control-handoff/control-handoff-evidence-source.ts
- apps/server/modules/control-handoff/control-handoff-protected-summary.ts
- apps/server/modules/control-handoff/control-acceptance.ts
- apps/server/modules/control-handoff/control-handoff-storage.ts
- apps/server/modules/control-handoff/control-grant.ts
- db/migrations/0073_control_handoff_acceptance.sql.pending
- tests/unit/FN15/control-handoff-evidence-source.test.ts
- tests/unit/FN15/control-handoff-protected-summary.test.ts
- tests/unit/FN15/control-acceptance.test.ts
- tests/unit/FN15/control-handoff-storage.test.ts
- tests/unit/FN15/control-acceptance-schema.test.ts
- tests/unit/UI12/control-acceptance.test.ts
- tests/unit/FN15/control-grant.test.ts

### 2.3 기존 직접 인접시험10 — 필요한 새 반례만
- tests/unit/FN15/control-source-integration.test.ts
- tests/unit/UI12/control-api.test.ts
- tests/unit/UI06/editor-api.test.ts
- tests/unit/FN03/document-source-observation.test.ts
- tests/unit/FN13/project-storage-quota.test.ts
- tests/unit/FN11/approval-list.test.ts
- tests/unit/FN15/control-request-read.test.ts
- tests/unit/FN15/control-handoff-summary-store.test.ts
- tests/unit/FN15/control-discovery-read.test.ts
- tests/unit/UI00/control-access-page.test.ts

### 2.4 읽기 재사용·보호 경로
기존 request input·snapshot·store·cursor, v1 summary 원형, 0041 및 과거 SQL, AccessRepository, ProjectStageQueue, ProjectCheckpoints/CheckpointPreparation, writer/execution/stop/journal reader는 우선 읽기 재사용한다. writer/승인 두 경로의 §5.2 순수 검산과 r4 승인 일반 current 분리는 아래 목적 범위로만 수정한다. 기존 currentProjectController/public writer·native·등록/특수 승인 OWNER guard는 보존한다. 새 일반변경 guard와 FN15 grant 소비는 §8의 exact 경로/분기에만 연결한다. 그 밖 실제 reader export/수정이 필수면 정확 경로·필요 변화·호환성을 Main에 반환해 allowlist를 먼저 revision한다.

apps/server/app.ts의 기존 controlHandoff.enabled 기본 OFF·source 옵션과 App.tsx의 기존 ControlAccessPage/원 buffer 소유를 재사용한다. 새로운 앱/전역 상태 도입0. baseline-sources·참여자관리·지식공유 결정/승인 후보의 별도 OWNER 조건은 읽기 보호 대상으로 둔다. 그 본문 수정이 필요하면 확장 전 반환한다. 보호 untracked3·SDK·역사 fixture·다른 작업자 변경은 복구/삭제하지 않는다.

## 3. 호출선·공개 wire 초안

원 accept 의미를 구체화하는 후보이며 추가 허가 목적/정책 gate가 아니다. Main은 이 절의 정확 경로·버전 표기를 검수한 후 확정한다. 기존5 route와 v1 DTO를 바꾸지 않는다.

### 3.1 명령 봉투와 수락 결과
- accept 명령: {schemaVersion:1,operation:'acceptControl',commandId,projectId,clientId,payload:{requestRef,summaryVersion,reason}}. 기존 FN15의 여섯 envelope keys를 유지한다.
- requestRef는 기존 version1 fullref다. summaryVersion은 양의 안전정수이며 서버가 해당 protected summary 원문/hash·최신 head를 복원한다. 존재하지 않는 summaryRef/hash를 caller 선언으로 채우지 않는다.
- projectId/경로/request 관계·body clientId/인증 client 일치, 정확 대상 actor/client·활성 참여자/세션·현재 재인증·기한을 검사한다. reason은 원문 보존·기존 비밀 검사·1~20000 UTF16·명령 canonical2MiB를 유지한다.
- target은 원 요청에서만 얻는다. role/control/generation/승인자/SAFE/coverage/서버 시각/새 grant를 caller가 정하지 않는다.
- 결과 후보: {schemaVersion:1,purpose:'CONTROL_ACCEPTANCE_RESULT',commandId,projectId,acceptanceRef,requestRef,summaryRef,previousControl,nextControl,grantRef,receiptRef,auditRef,recordedAt,executionAuthorized:false,dispatchPerformed:false,controlTransferred:true}.
- ControlBasis={actorId,clientId,generation,version}. Grant snapshot은 project/request/summary/acceptance·정확 target·전후 basis·issuedAt에 결박한다. 자기 참조 hash 순환을 만들지 않는다. 결과의 제어 이전은 실행 권한/새 Agent dispatch가 아니다.
- 이후 회수된 과거 결과 replay를 현재 활성 grant로 표시하지 않는다. 현재 제어는 보호 checkControl 재조회에서 별도로 확인한다.

### 3.2 기존 route와 분리되는 후보
- POST /api/v1/projects/:projectId/control-requests/:requestId/versions/:requestVersion/protected-handoff-summaries
  - 기존 prepareControlHandoff 명령 봉투/payload:{requestRef}를 사용한다. 현재 유효 controller가 생성하며 기존 요약 생성의 재인증·기한 요구를 보존한다.
- GET 같은 경로/:summaryVersion, query requestHash/summaryHash: exact 보호 요약을 조회한다.
- POST /api/v1/projects/:projectId/control-requests/:requestId/versions/:requestVersion/acceptances: 위 acceptControl 봉투.
- GET 같은 acceptances/:commandId, query commandHash: 정확 보관 결과/불명 조정의 조회만. 새 grant/수락을 만들지 않는다.

새 route 이름은 기채택 논리 연산의 기술 매핑 제안이다. 기존 A route의 준비/응답 원형과 v1 고정 조회를 그대로 둔다. current controller와 정확 요청 대상만 원 범위에서 읽으며 다른 사람/전역 client 목록을 새로 노출하지 않는다. 실제 공개 활성화는 구현 source 검수/실행 승인과 별개다.

accept에 일반 authorizeMaterial/현재 controller 필수 조건을 편의상 붙이지 않는다. 대상은 아직 controller가 아니므로 기존 프로젝트 일반 쓰기 경로의 가짜 ProjectCommand로 허가하지 않는다. 별도 requestApproval/새 AUTO 정책/새 bearer를 추가하지 않는다. 수락 후 일반 변경은 원 operation의 정확 명시 정책·DENY·기한·일회승인을 다시 검사한다.

## 4. 새 보호 요약 원형과 v1 보존

기존 v1은 원 hash/metadata/false flags/고정 GET을 보존하며 수락 근거로 사용하지 않는다. 기존 table/codec에 SAFE enum 하나를 끼워 넣지 않는다.

새 보호 요약 후보:
- wrapper={ref,snapshot}.
- snapshot={schemaVersion:2,purpose:'CONTROL_HANDOFF_PROTECTED_SUMMARY',projectId,requestRef,summaryVersion,baseControl,targetActorRef,targetClientRef,observedAt,validUntil,collections,gaps,transferState,executionAuthorized:false,dispatchPerformed:false,controlTransferred:false}.
- collections exact4={activeExecutions,pendingCommands,pendingApprovals,sourceCheckpointRefs}.
- Collection={state,scope,observedAt,expiresAt,coverage,items,gaps}.
- scope={projectId,requestRef,baseControl}; state는 VERIFIED_CURRENT/WAITING/UNKNOWN.
- coverage={profile:'FN15_KNOWN_SOURCE_SET_V1',sources,scopeHash,watermarkHash}. sources는 §5의 고정 source kind/각 원장 범위·상한·끝 관측을 생산자가 계산한 목록이다. 임의 source명이나 caller coverage=true/count0는 받지 않는다.
- Item={kind,ref,observedAt,expiresAt,provenance,handoffDisposition,reasonCode}. provenance는 SERVER_LEDGER/REGISTERED_CURRENT_PROOF/HISTORICAL_CLAIM, disposition은 CONTINUE_CONFIRMED/PRESERVE_BLOCKED_INPUT/BLOCKED/UNKNOWN.
- ref는 실제 불변 저장물만 가리킨다. 없는 process/key/grant/원결과를 가짜 fullref로 합성하지 않는다. 목록 coverage의 빈 범위는 특정 행의 부재이지 합성 ref가 아니다.
- source kind/이유코드/필수 watermark의 닫힌 목록은 Main이 §5 실제 SQL/reader와 함께 최종 확정한다. 이 부분은 GO 전 미확정 U1이다.
- transferState는 READY/WAITING/UNKNOWN. 서버 private issuer가 실제 읽기·current·coverage·기한·정착·각 item disposition을 검산한 결과로만 계산한다. 이 JSON을 다시 넣어 출처를 얻는 공개 입력 API는 없다.
- 준비·수락의 매 await 뒤 source/함수·현재 인증·actor/client와 budget을 재검산한다. 제어 기준은 단계별로 분리한다. 준비/최초 수락의 CAS 전에는 원 baseControl, 성공 CAS 후에는 해당 수락이 만든 nextControl, 과거 결과 replay는 원 이력/현재 제어의 구분을 사용한다. CAS 후 old base-current를 다시 요구하지 않는다. Proxy/getter/함수 교체·다른 Tx/actor·폐기된 private 결과를 거절한다.

범주당 최대200refs를 유지하며 item 내부/중복 구조로 이를 우회하지 않는다. 전체 보호 요약 canonical2MiB 이내다. validUntil=min(관측+30초, 원 요청, 현재 session idle/absolute, 재인증, 각 실제 근거 기한)이며 min-only다. 준비 후의 기다린 시간을 새 기산점으로 만들지 않는다. max 외부 대기 숫자를 이 초안에서 임의로 추가하지 않으며, 이후 WI 최종본은 위 최소기한을 실제 timer·query lease에 일관되게 소비할 내부 budget을 명시한다.

## 5. 같은 auth Tx의 실제 생산자·coverage

DB reader는 별도 HTTP 호출/다른 pool·actor/가짜 controller를 거치지 않는다. authenticateInTransaction의 원 receiver/token/CSRF·세션/현재 identity를 보존한다. ProjectMember/정확 원 요청·현재 controller 검사는 생산 전후와 수락 직전 다시 한다. 읽기 자체로 승인 소비·중지·회수·grant 발급·metadata 변경을 시작하지 않는다.

| 범주 | 직접 실제 DB/reader 연결 | 인정 범위·UNKNOWN 조건 |
|---|---|---|
| activeExecutions | execution_grants/execution_grant_revocations, 실행 command·journal의 exact 관계; ProjectObservationJournal/ProjectStopRequestHistory의 검산; FN15 목적 제한 reader가 실제 base 소유를 결박한 writer head/tip·원 observation/현재 근거를 검산하는 §5.2의 신규 연결 후보 | 기존 SYNTHETIC_ONLY/PROVIDER_CLAIM_ONLY journal·STOP_REQUEST_STORED는 실행 중지·현재 소유 회수가 아니다. 기존 public writer.current를 수락자 Tx에서 호출하지 않는다. FN15 제한 SQL reader/현재 근거 공급자가 미작성·미등록이거나 local sequence/child/source fence·등록/기한을 입증하지 못하면 UNKNOWN |
| pendingCommands | 실제 commands/authorization_receipts/audit, delivery_outbox의 command 귀속·정확 상태, ProjectStageQueue.read의 WAITING 원장, 지시 예약/원 material/envelope 연결·원 quota IO_STARTED/held 상태 | StageQueue는 WAITING_ONLY·최대200이며 전체 command coverage가 아니다. APPLIED+HELD outbox·응답 불명·고아 예약/원행 누락·범위 초과를 숨기지 않는다. 실행/지시 store가 SYNTHETIC이면 해당 provenance를 유지 |
| pendingApprovals | ProjectApprovals.list/read의 원 request/decision/consumption/current policy·generation 검산 | 첫 page/필터 목록을 전체로 취급하지 않는다. 전체 대상 ID의 고정 상한+1 조회와 각 원문 검산, 최신 head·소비·기한·원 정책/제어 세대 복원을 같은 Tx에서 수행. 새 정책 부여·승인 소비0 |
| sourceCheckpointRefs | ProjectCheckpoints.list/read, ProjectCheckpointPreparation의 exact confirmed assignment·checkpoint chain·원 bytes/hash/receipt/audit 검산; 해당 writer source 범위 | 준비본은 저장 증거가 아니고 저장본도 HUMAN_RECORDED_CLAIMS_NOT_VERIFIED·currentFactsVerified/writerReleaseVerified=false다. 보관 claim만 표시하고 현재 source/회수·재개 안전으로 승격하지 않는다 |

구체 구현은 고정 source-set을 코드로 등록하고, 각 source의 실제 SQL upper watermark·대상 scope·종단 및 missing source를 수집한다. raw COUNT(*) 결과 하나로 COMPLETE를 만들지 않는다. reader의 전체 범위를 끝까지 검산하지 못하거나 200/2MiB를 넘으면 UNKNOWN/WAITING으로 수락0이며 값을 잘라 READY로 만들지 않는다. 빈 원장도 해당 reader의 범위·발급 가능 경로·미정착 여부가 검산됐을 때만 그 범위의 부재로 인정한다.

기존 writer signature/hash 검증은 등록키·purpose·scope·head/nonce·현재 expires를 그대로 사용한다. parser 통과나 SOURCE_ONLY_MODEL 표시는 실제 OS proof가 아니다. 새 실제 서명 목적·키 발급이 반드시 필요하다는 근거는 아직 없으며 만들지 않는다. 필요한 producer가 미등록이면 그 가지는 UNKNOWN이며 모델 정상 결과로 제품 READY를 만들지 않는다.

CONTINUE_CONFIRMED는 실제 계속 실행이 유지되면서 원 client 신규 지시/승인이 차단되고 해당 execution·grant·writer의 소유 정합성이 유지된다는 현재 근거가 있어야 한다. 무조건 activeExecutions=0/프로젝트 중지/새 실행 발급을 요구하는 새 정책은 만들지 않는다. 이를 입증 못하는 살아 있는 실행은 UNKNOWN이다. 미결 명령/승인은 삭제·자동 취소·재전송하지 않고 원 ref와 재허가 필요를 보존한다.

### 5.1 미정착 소유·시간
- collection Promise.race 종료는 raw DB query 정착이 아니다. facade는 active=false 뒤 새 query를 거절하고 in-flight 실제 promise를 끝까지 소유한다.
- timeout 뒤 rollback/release와 query가 겹치지 않게 actual settle를 기다린다. 늦은 결과는 폐기하며 새로운 관측/현재성을 열지 않는다.
- 같은 operation의 고정 wall 상한과 단조 남은시간을 함께 유지하고, session/reauth/요청/관측 expiry의 최소값으로 timer도 앞당긴다. 취소를 성공 정리로 표시하지 않는다.
- 이미 소비한 protected packet은 같은 Tx/command에서만 소비한다. 다른 요청·actor·source instance/폐기된 lease의 재사용0.

### 5.2 수락자 접근과 원 base 소유의 분리 — r2 I1 보완

**실제 source 차단 근거:** project-writer-authority.ts:180의 current→#human(:130)은 OWNER 및 현재 actor/client를 요구한다. #ports(:156)도 source.current에 실제 호출 actor를 넘기고 #human·기존 quota/current 검사를 다시 한다. #load(:150)→#proofs(:133~148)는 승인소비가 있으면 ProjectApprovals.verifyWriterAuthorityConsumption(:133~137)을 호출하며 이 메서드도 OWNER를 요구한다. 따라서 HANDOFF_ELIGIBLE 수락자는 물론 현재 controller가 아닌 OWNER의 다른 client도 이 public 경로를 그대로 소비할 수 없다. #load만 export해 해결됐다고 하지 않는다. 0070_project_writer_authority.sql.pending:166~167의 writer tables RLS도 USING(false)/WITH CHECK(false)이므로 단순 SQL SELECT가 실제 실행 가능한 연결이라는 주장도 금지한다.

수락자의 identity와 원 근거의 subject는 서로 다르다.
- 수락자: 원 authenticated Tx의 실제 사용자/client/세션/credentialGeneration이다. 같은 project의 활성 OWNER 또는 HANDOFF_ELIGIBLE이며 정확 불변 요청 target과 일치하고 요청·재인증·세션 기한이 살아 있어야 한다.
- 원 base 소유자: 잠긴 project_control의 원 actor/client/generation/version, 원 요청 baseControl, 원 writer event/command/authorization receipt/audit·승인소비/등록/키/observer의 실제 저장 subject다. 이 값은 수락자의 actor로 바꾸거나 로그인 세션을 합성할 자료가 아니다.
- 수락자의 접근 목적은 FN15의 정확 요청/요약/수락 검산뿐이다. 일반 writer current/승인 raw 원문 조회·writer 변경·일반 프로젝트 쓰기 권한을 주지 않는다.

신규 control-handoff-evidence-source.ts가 요청·target 접근/원 인증 Tx의 project·member·control 잠금과 head 읽기/수명 검산 뒤에만 module-private 읽기 capability를 발급하는 후보를 사용한다. capability는 원 db/Tx·실제 수락자 identity·project/request fullref·summary/command 식별·잠긴 baseControl·budget/단계에 결박한다. raw JSON·다른 source instance/Tx·폐기된 capability는 소비하지 못한다. 이 capability는 OS proof나 새 사용자 인증수단이 아니며 실제 reader를 호출할 수 없는 경우 UNKNOWN을 보존한다.

기존 두 파일의 최소 추출 후보는 다음과 같다. 함수명은 제안이며 현재 export가 존재한다고 주장하지 않는다.
1. project-writer-authority.ts: #event/#head의 typed 변환, checkWriterChain/verifyHistoricalHead 및 #proofs/#load의 저장 관계 검산을 현재 actor 권한 wrapper와 분리한 순수 검산 접점. 입력은 FN15 reader가 실제 읽은 head/events/원 command·receipt/audit·검산된 승인소비 원형이다. 원 command의 실제 actor/client/controlGeneration과 각 event.subject·scope·등록·nonce·ref/hash를 검산하고 다른 principal로 치환하지 않는다. public current/#human/#ports/기존 WriterPersistenceSource.current 호출의 의미와 권한은 그대로 둔다.
2. project-approvals.ts: verifyWriterAuthorityConsumption의 원 command/requestRef/decision/consumption·scopeDigest·policy·serverCommandId/원 actor 관계를 검사하는 순수 core를 분리하는 후보. 기존 public verifyWriterAuthorityConsumption은 먼저 기존 OWNER 검사를 수행하고 기존 검증된 history를 얻은 뒤 같은 core를 소비한다. FN15 전용 reader는 raw 승인 원문을 UI에 반환하지 않고, 실제 고정 원행의 schema/hash/receipt 관계까지 검증한 뒤 그 core에 공급해야 한다. 단순히 public OWNER 검사를 생략하는 새 generic read는 금지한다.

최소 반환자료는 project/request/baseControl, writer headRef/tipRef·phase/원 execution/lease/등록·scopeHash, 검산된 command/receipt/audit·승인소비의 refs, 관측/만료/coverage·gap/미정착 상태다. sourceScopes 원문·승인 reason/본문·원 session token·CA/SPKI·비밀은 FN15 HTTP/UI에 내보내지 않는다. 순수 검산 성공은 과거 저장 관계만 증명하며 현재 process/쓰기 fence·계속실행 proof를 생산하지 않는다.

### 5.2.1 Main 확정 U1 내부 reader — pending SQL/소스 구현 전 검토

신규0073은 FN15 전용 함수 소유역할을 NOLOGIN/NOINHERIT/NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS로 만들고, 필요한 최소 열 SELECT와 해당 역할 전용 SELECT RLS 정책만 정의한다. FN16 역할을 재사용하지 않는다. app 역할의 membership/SET ROLE/raw SELECT는 허용하지 않으며 기존 false 정책·DML 정책과 public OWNER guard는 그대로 둔다. FORCE RLS를 끄거나 우회하지 않는다. 역할·함수의 정확 이름과 signature는 구현 전 고정하며 현재 존재한다고 주장하지 않는다.

0066_export_locked_metadata_reader.sql.pending:4~41의 migrator 검산·동명 역할/함수 존재 시 전체 거절·임시 migrator membership·schema CREATE 회수·PUBLIC EXECUTE 회수·app의 고정 함수 EXECUTE·postflight를 재사용한다. 0066의 artifact 잠금용 UPDATE 권한은 복사하지 않는다. fixed static SECURITY DEFINER 함수는 search_path를 pg_catalog로 고정하고 관계/함수는 schema-qualified로 참조하며 동적 SQL·caller relation/column 선택을 받지 않는다. 소유역할의 최소 열/정책/EXECUTE·membership 부재·schema CREATE 부재·FORCE RLS·기존 false/DML 보존을 postflight로 검산한다. 실제 role/GRANT/SQL 실행은 제외다.

입력 후보는 project/request fullref, summary fullref(준비 단계는 부재), 원 accept command 식별/hash(준비 단계는 부재), 실제 session/actor/client, 닫힌 단계다. 이는 서버의 원 인증 Tx에서만 조립한다. SQL 함수는 session_user=anvil_v3_app와 fn01_active(session,actor,client)를 직접 검산하고, project 비보관·member 활성 OWNER/HANDOFF_ELIGIBLE·정확 request target·원 hash·기한·base 또는 이번 next/replay 관계를 실제 행에서 재구성한다. caller가 보낸 phase/base/command hash만으로 허가하지 않는다. 준비 단계는 원 current controller 및 정확 원 요청, 수락 전은 원 target+base, 수락 후는 같은 target+이번 수락의 next/불변 전후 이력, replay는 원 target+완전 stored 결과만 인정한다. 다른 요청·project·원 actor 위장·임의 과거 summary는 거절한다.

함수 자체의 source SELECT에는 FOR UPDATE/SHARE를 사용하지 않는다. project/member/control 및 명령·요청 잠금은 기존 인증 Tx/accept 조립이 소유하고 함수는 같은 Tx에서 읽는다. 단, 기존0042:87 fn01_active 자체는 users/auth_sessions/clients FOR UPDATE를 수행하므로 무잠금 함수라고 표현하지 않는다. 원 auth Tx가 소유한 동일 인증행 잠금의 재검산이며 FN15 reader 역할에 UPDATE 권한을 추가하는 근거가 아니다. 잠금 순서·재진입은 실제 SQL 검수 대상으로 유지한다.

읽을 자료는 0041 원 요청/요약·command/receipt/audit, project/member/control, 0070 writer head/events와 거기서 도달하는 공용 command/authorization_receipt/audit 및 approval request/decision/consumption이다. RLS SELECT 정책은 FN15 함수 소유역할만 대상으로 하며, 행의 project 및 고정 함수의 검산 범위를 벗어난 자료를 결과에 포함하지 않는다. app 직접 SELECT를 열지 않는다. SQL 결과는 서버 내부 검산용 최소 열이며 HTTP/UI에는 §5.2의 refs/watermark/gap projection만 전달한다. SQL이 JS private capability·OS proof를 검증했다고 표시하지 않는다.

내부 결과는 원 db/Tx·실제 target/session·project/request/summary/command hash·단계·원 budget에 결박한 독립 불변 snapshot과 private provenance다. sourceScopes·승인 원문이 순수 core 검산에 필요한 경우 내부에서만 소유하고 공개 요약에 복제하지 않는다. Proxy/getter·다른 Tx/source instance·폐기된 수명·await 뒤 인증/원 기한 변경은 거절한다. #human/#ports를 fake base actor로 호출하지 않는다.

공개 범주200refs/전체2MiB와 내부 chain의 기존10000/64MiB는 별도 분모다. 정상 chain을200개로 잘라 SAFE 또는 영구 UNKNOWN으로 만드는 정책을 추가하지 않는다. 기존 chain 상한 내 전체를 검산하고 요약에는 검산된 refs/워터마크만 투영한다. source별 내부 read bytes·wrapper/검산용 복사·누적 결과의 동시 보유 상한은 해당 typed source 상한의 합과 최대 중복사본 수로 별도 유한식을 고정한다. 정착 중 raw query buffer도 제외하지 않는다. 정확 식/원 row 선택열과 원 operation 최소기한 내 완료 가능성은 구현 전 검수 항목이며 새 무제한 read나 타이머 연장으로 해결하지 않는다. 초과/불완전은 source와 상한을 식별한 gap으로 반환한다.

U1에서 아직 작성되지 않은 것은 위 목적제한 함수/정책의 exact SQL signature·열별 정책/쿼리, 두 순수 core 추출의 실제 조립, 내부 메모리 최대식과 source-set/watermark다. 원장 proof 검산과 actual current/fence/계속실행 공급자는 별개이며 후자는 실제 미등록이면 UNKNOWN/수락0이다. 합성 양성은 동일 생산/소비 코드를 fakeDB와 명시 보호포트로 검산하는 증거이고 실 DB RLS/OS 안전성 증거가 아니다. 현재 allowlist42 내 신규0073/reader와 기존 두 core 파일이 이 작업의 접점이며 실제 추가 경로가 필수이면 먼저 반환한다.

### 5.3 CAS 전후·replay의 검산 단계

| 단계 | 현재 authenticated identity | 제어·원 근거 검산 | 호출 금지/실패 처리 |
|---|---|---|---|
| 보호 요약 준비 | 실제 현재 controller | 요청 target은 별도 원문으로 검산하고 원 base 소유와 정확히 결박 | 요청 target으로 controller를 위장하지 않음 |
| 최초 수락 CAS 전 | 실제 정확 target | locked project_control=원 baseControl; 원 command/event의 실제 base subject·근거/hash·scope/기한/coverage 검산 | target에게 public writer.current/currentProjectController 성공을 요구하지 않음; 부재/불명 UNKNOWN |
| 성공 CAS 후·COMMIT 전 | 같은 실제 target | project_control=계획 nextControl; 원 base는 immutable before image/수락·회수 이력과 비교; 새 grant·전후 세대·receipt/audit·비용·기한·정착의 역완결 | old base가 현재 제어자인지 다시 요구하지 않음. 불일치는 Tx 확정 rollback 또는 COMMIT 시작 후 UNKNOWN |
| 같은 command replay | 실제 현재 인증된 원 target | 원 command/hash/target·완전 이력은 검산하되 stored grant와 현재 control의 차이를 분리 | 새 CAS/grant/관측 발급0; 과거 결과를 현재 활성 grant로 승격0 |

CAS 뒤의 최종 재관측은 역할/기준이 바뀌지 않아야 한다는 일반 stable 검사 하나를 재사용하지 않는다. 자기가 만든 예상 전환만 허용하며 actor/client/generation/version 외부 변조나 source/기한·세션 회수는 계속 거절한다. CAS 전에 발급한 근거를 새 principal의 권위로 재발급하거나 과거 writer proof에 새 controlGeneration을 덧씌우지 않는다. 계속실행의 보호 계약이 전환 뒤에도 유효함을 입증하지 못하면 그 실행은 CAS 전에 UNKNOWN으로 남겨 수락하지 않는다. CAS 이후 검산 실패가 있더라도 자동 역전환·재dispatch하지 않는다.

## 6. accept 저장·CAS·replay·COMMIT 불명

### 6.1 실제 열과 새로운 불변 이력
기존 project_control={project_id PK,actor_id,client_id,generation,version,issued_at,revoked_at}, project_members={project_id,user_id,participation,version,joined_at,revoked_at}를 유지한다. membership 변경/OWNER 자동 승격0.

0073 후보는 기존0041/과거 SQL을 변경하지 않고 다음 물리 구조를 추가한다.
- control_handoff_protected_summaries: project/request fullref, version/hash, exact body/metadata, source command, observed_at/valid_until.
- control_handoffs: 기채택 DATA_MODEL 열에 exact command/request/summary·전후 basis·grant/ref/hash·기록 시각을 결박한 append-only 수락 행.
- control_grant_events: REVOKED/ISSUED의 두 불변 행. 기존 current row에 독립 grant id가 없으므로 최초 관측을 과거 발급 ref처럼 합성하지 않는다.
- control_handoff_acceptance_commands/receipts/audits: 원 FN15 source 봉투와 actor/client/request/summary/hash·단일 결과의 양방향 완결.
- control_handoff_storage_reservations 및 필요 최초 계상 anchor: §7의 실비용/불명 보존.
- 새 protected-summary 생성의 command/receipt/audit도 새 원장에 포함한다. 기존0041의 operation CHECK나 v1 고정 원문은 느슨하게 바꾸지 않는다.
- 새로운 mutable acceptance head가 필요하면 정확 물리행·최초 소유·byte/slot을 먼저 명시한다. 불변 이력을 head 하나에 숨기지 않는다.

### 6.1.1 Main 확정 U3 비순환 hash/현재 grant 검산

acceptance basis snapshot은 정확 원 requestRef/summaryRef/commandRef, before/next actor·client·generation·version tuple과 원 기록시각만 hash한다. 하위 grant/receipt/audit/result fullref를 넣지 않는다. commandRef는 결과 hash가 아닌 원 command 입력의 고정 ref를 사용하며 exact 물리 ref codec은 구현 전 검산한다. 생성 순서는 acceptanceRef → REVOKED/ISSUED 이벤트(acceptanceRef 참조) → receipt(원 acceptance와 두 이벤트 refs 참조) → audit(receipt 참조) → 최종 result(모든 refs 수집)다. command inputHash와 결과보관 hash는 구분하며 상호 hash 순환을 만들지 않는다.

최초 project_control에는 과거 grant fullref가 없으므로 최초 anchor/before tuple과 이번 REVOKED 사실로 회수를 기록한다. 과거 ISSUED ref를 합성하지 않는다. 새 grant 현재성은 project_control exact next tuple과 해당 generation의 유일 ISSUED→acceptance→receipt→audit 역완결로 증명한다. 이후 회수된 과거 결과의 refs는 보존하되 현재 grant로 승격하지 않는다. unique/FK와 최종 역검산은 이 DAG에 맞춰 구현한다.

참조는 같은 project의 exact id/version/hash FK, source command/receipt/audit와 immutable body/hash 양방향 검산을 둔다. request별 동일 base generation 수락1, project/새 generation1, command 동일 subject/client/hash1의 unique 조건을 둔다. 오래된 요청을 새 controller 대상으로 바꾸지 않는다.

### 6.2 Tx 순서와 승자
1. authenticateInTransaction으로 실제 수락자 session/client/CSRF/재인증을 검산한다. project→현재/대상 member의 일관된 순서→project_control→command/request→정확 protected summary/head를 잠근다. 기존 auth 및 회수 gate 순서와 충돌하는 새 잠금 순서를 만들지 않는다.
2. commandId가 있으면 먼저 완전 replay 분기로 간다. 원 command/hash/target/request/summary·receipt/audit/전후 grant 이력을 재검산한다. 이미 자기 수락으로 baseControl이 바뀌었는데 최초 분기 검사를 재적용해 성공 결과를 잃지 않는다.
3. 최초 분기는 정확 원 target=현재 authenticated actor/client, 적격 member, 요청 PENDING 원문/기한, 최신 protected summary와 실제 base actor/client/generation/version을 고정한다.
4. §5의 근거를 같은 Tx에서 재생산/현재 대조하고 lifetime·coverage·미정착·지속 실행 disposition을 닫는다. 과거 summary 조회만으로 현재성을 인정하지 않는다.
5. 모든 새 row/projection의 저장비용을 §7로 예약한다. row id/최종 기록시각/hash를 고정한 뒤 command/수락·회수·발급·receipt/audit를 쓴다.
6. project_control UPDATE는 원 actor/client/generation/version/회수상태 exact CAS를 사용한다. 성공 시 target actor/client, generation+1/version+1, issued_at=원 서버 시각, revoked_at=null. 정수 포화는 거절한다.
7. 성공 CAS 뒤에는 §5.3의 AFTER_ACCEPT 단계로 전환하고 잠긴 project_control의 actor/client/generation/version이 이번 원 수락이 만든 nextControl과 정확히 같은지 확인한다. 모든 물리행·전후 grant/수락·receipt/audit의 역참조, 정확 실제비용≤예약, quota 정산, 원 기한·실제 수락자 인증/회수·미정착을 최종 확인하고 COMMIT한다. 원 baseControl은 과거 before image/불변 원행으로 검산하며 old caller-current/base=current를 다시 요구하지 않는다. DB가 JS private 상태나 OS를 직접 검증했다고 표시하지 않는다.

동시 두 accept는 한 건만 성공해야 한다. 다른 본문/대상/summaryVersion·옛 base의 commandId 재사용은 충돌이다. 같은 command/hash는 현재 인증 후 원 결과만 반환하며 새 grant/event/generation을 만들지 않는다. 이후 다른 인계로 원 grant가 회수되었으면 과거 receipt를 남기되 현재 활성 제어로 표시하지 않는다.

COMMIT 시작 후 예외/응답 유실은 commandId와 원 body를 가진 UNKNOWN이다. rollback 호출 성공만으로 COMMIT 불명을 확정 실패로 바꾸지 않는다. 별도 자동 accept·generation 역전환·새 grant 재발급0, 고정 결과/현재 제어 재조회만 허용한다. 확정 rollback은 전체 새 row/CAS/예약 효과를 없애며 기존 제어를 보존한다. 실제 PG 경쟁·COMMIT 증거는 합성 성공으로 대신하지 않는다.

## 7. 저장 한도·물리행 정산

기존 project10GiB·snapshot/요청2MiB·refs200·요약30초와 자동삭제OFF를 유지한다. FN06 전용10000/64MiB를 FN15 전체에 임의 도입하거나 기존 한도를 늘리지 않는다.

현재 ProjectStorageQuota.prepare는 ProjectCommand/OWNER/current-controller 경로이므로 아직 제어권 없는 target accept 앞에 호출하면 잘못된 추가 허가 gate가 된다. 신규 control-handoff-storage.ts는 인증된 FN15 목적·원 request/command/private 계획만 소비하는 내부 예약/정산을 구현한다. 임의 COMMON/verified bool·다른 operation 위장·caller 비용/coverage 입력0이다. 기존 ARTIFACT/CHECKPOINT/SOURCE_LINK_EVENT의 한도/분기/권한은 바꾸지 않는다.

### 7.1 실제 행표
| 작업 | 새 물리행 | 비용 귀속 |
|---|---|---|
| 보호 요약 생성 | protected summary1, 생성 command1, receipt1, audit1, reservation1 | 원 prepare command에 각 실제 행 한번 |
| 수락 | control_handoffs1, grant REVOKED1, ISSUED1, accept command1, receipt1, audit1, reservation1 | 원 accept command에 각 실제 행 한번 |
| 최초 계상 anchor가 필요한 project | anchor1 | 최초 FN15 계상 command에 한번; 과거 실제 grant 발급을 주장하지 않음 |
| project_control | 기존1행 UPDATE, 신규행0 | 최초 실제 계상 소유를 유지. accept마다 새로 청구하거나 최신 command로 옮기지 않음 |
| 기존0041 | requests/summaries/source_commands/source_receipts/source_audits의 실제 모든 행 | 기존 실제 owner source command별 한번. native/일반 command 계상과 disjoint 검산 |

모든 row의 snapshot뿐 아니라 metadata_json, command 원문/result, receipt/audit, 요청 reason, grant 전후 basis·ref/hash, quota plan/phase·actual counters까지 실제 table projection에 포함한다. 원본과 별도 컬럼/물리행에 복제된 payload는 각각 비용이다. refs는 다른 artifact 원문 재계상0이다. reservation plan에 row 전체를 재귀 복제하거나 자기 hash를 다시 포함하지 않는다.

새 작업에서 미리 알 수 있는 row projection 길이+고정 envelope를 계산해 예약하며, 저장 후 실제 table collector 합계로 정산한다. actual>reserved나 역참조/행수/종류 불일치는 COMMIT 전에 거절한다. 자기 reservation row 비용도 제외하지 않는다. phase/숫자/NULL/시각이 변하는 행의 계상 codec은 실제 값/NULL 정보를 보존하는 고정폭 표현으로 안정화하고 원문 canonical hash와 구분한다.

### 7.2 Main 확정 U2 F 통합·최초 계상

0072까지 0041 다섯 원장과 project_control 비용이 기존 U/H에 미포함이라는 조사에 따라 FN15 독립 원장 F를 기존 잔액에 통합한다. used=U0+Factual, held=H0+Ffuture이며 각 실제 행/미생성 예약은 disjoint registry로 정확 한번 소유한다. 별도 합계를 guard 밖에 더해 기존 used 일치 검사를 우회하지 않는다. quota_account/environment_configuration_account/connection_definition_capacity/native_preparation_capacity/document_source_capacity 및 최종 reserve/complete 모두 동일 F를 소비해야 한다.

신규0073 전체 Tx에서 기존0041/control의 최초 anchor와 F 잔액을 초기화하고 새 complete 정의를 원자 설치한다. 기존 실제 source command 귀속과 mutable control 최초 관측 anchor를 구분한다. 기존 row 누락/중복·역참조 불완전·기존 한도 초과면 forward 전체 실패이며 일부 설치/coverage 승격0이다. 현재 control의 최신 command로 소유를 옮기거나 과거 생성 ref를 합성하지 않는다.

신규 생성은 0059 quota_adopt_creation(uuid,uuid,uuid,uuid,jsonb)의 Artifact total used 대입과 즉시 complete 사이에 정확 생성 anchor/Factual을 연결한다. manifest bytes/hash는 Artifact만 유지하며 FN15 비용을 Artifact manifest인 것처럼 바꾸지 않는다. account가 없는 정상 새 project는 정확 project/control INSERT와 원 createProject command·authorization receipt·audit·draft_creation_intent의 완성 계보를 확인하는 지연 trigger로 anchor만 만든다. xmin/시각 하나만으로 생성 권위를 만들지 않고 기존 quota_adopt_creation의 실제 관계 검산을 보존한다. anchor 생성만으로 quota VERIFIED 승격0이다. 기존 project의 최초 anchor 유실은 일반 쓰기에서 재생성하지 않고 무결성 오류로 닫는다.

F 원장/anchor/reservation의 고정폭 계상 codec은 실제 값·NULL을 보존하고 plan/hash의 자기 참조를 만들지 않는다. reservation과 정산 자체의 실제 비용 및 미래 미생성 부분도 Factual/Ffuture에 분리해 complete로 역완결한다. 구체 함수명·projection·고정폭/NULL codec·예약 자기 비용식·초기화 잠금/지연 trigger의 exact predicate는 구현 전 검수 항목이다. 기존 예약 분기/한도·일반 OWNER public caller는 불변이다. 위 SQL 함수 정의 교체는 신규0073 안에서 수행하며 기존0059/과거 SQL 원문은 수정하지 않는다. 실제 quota 모듈 수정이 필요하다고 확인되면 정확 추가 경로를 먼저 반환한다.

UNKNOWN hold는 자동 해제·삭제하지 않는다. 실제 확정 rollback/고정 정산 원행을 확인한 경로만 release하며 결과 불명은 조회만 한다. source-only SQL 파일 작성과 실제 적용·GRANT/기존 권한 변경은 별개다.

## 8. 일반 변경과 OWNER 관리권한 분리 — r4 U4 내부 조립안

수락 grant는 OWNER 승격이 아니다. 기존 currentProjectController와 public OWNER helper를 바꾸지 않고 별도 일반변경 guard를 둔다. 정확 operator/project/actor/client/controlGeneration·현재 미회수 control과 실제 수락 grant 역완결을 검사하고 기존 authorizeMaterial의 명시 operation 정책/DENY/기한/일회승인·현재 세션을 계속 소비한다. membership만 HANDOFF_ELIGIBLE이거나 control tuple만 맞는 것으로 허가하지 않는다. generic Repo가 documentOperations 전체를 새 일반변경 guard에 넘기는 방식은 금지한다.

### 8.1 공유 grant 검산과 호출 분류

신규 control-handoff/control-grant.ts는 acceptance→ISSUED/REVOKED→receipt→audit/최종 command 관계의 순수 검산과 최소 고정 DB projection reader를 분리한다. FN15 수락 모듈을 import하지 않아 Repo→accept→Repo 순환을 피한다. 일반 auth Tx가 실제 row를 읽고 검산한 immutable packet만 일반변경 guard/프로젝트 상세/FN15 current 판정에 소비한다. raw currentGrant=true·존재 count·caller fullref만으로 허가하지 않는다. 검산 결과는 같은 project/actor/client/generation/현재 control에 결박하며 각 await 뒤 다시 current/기한·회수를 확인한다. 과거 수락 성공이 현재 grant라는 뜻이 아니다. 최초 수락 때의 summary30초/원 요청·당시 세션/재인증 기한은 당시 유효성을 불변 이력으로 검산하는 조건이다. 현재 grant 조회에 그 과거 summary의 현재 미만료·old base의 현재성·원 세션의 현재 생존을 다시 요구하지 않는다. 현재 권한은 현재 active 로그인·사용자/client/회원·미회수 및 exact control actor/client/generation과 수락/발급/회수·receipt/audit의 불변 역완결로 검산한다. 계획 없는 grant TTL/자동회수·세션 변경만의 자동 강탈은 추가하지 않는다. 과거 접속시각·문서를 현재 OS 안전 근거로 사용하지 않는다.

1차 일반문서 소비 후보는 saveDocumentDraft/recordContentReview/confirmDocument/proposeDocumentChange/importDocument/uploadArtifact/linkDocumentSource/proposeDocumentSourceChange/detachDocumentSource다. requestApproval/decideApproval은 아래 별도 후보·requiredDecider 조건을 더한다. 이는 operation별 정확 분기표이며 모든 domain을 허가하는 새 전체 allowlist가 아니다. 위 operation도 원 form/source/원작성자·특수승인/정책 조건에서 거절될 수 있다. 나머지 documentOperations와 assignmentContentCommand·saveCheckpoint/실행·등록·native·백업 등의 전용 소비선은 기존 OWNER helper를 유지한다. 별도 매핑 없이 이 WI의 HANDOFF_ELIGIBLE 일반기능 완료 범위로 세지 않는다.

| 실제 접점 | r4 필요한 한정 변경 | 반드시 남길 조건/미완료 경계 |
|---|---|---|
| access/project-command.ts:63~69, command:162 | 원 currentProjectController 불변; Repo.command가 위 ordinary 문서/승인 operation일 때 별도 guard로 분기 | savePermissionPolicy는 별도 OWNER/current·재인증 bootstrap; 그 외 operation은 기존 helper. authorizeMaterial/원 receipt·replay/감사 불변 |
| projects/repository.ts:209~229 | 기존 상세 DTO에서 HANDOFF_ELIGIBLE의 self HELD는 실제 현재 FN15 grant 검산 성공 때만 반환 | OWNER/VIEWER 기존 표시·조회/원 sourceDeclaration OWNER 경계 보존. grant 부재/회수/불완전은 HELD0; 기존 UNASSIGNED로 투영하며 exact 오류가 무결성 실패이면 성공 응답으로 숨기지 않음. 새 DTO/역할 필드0 |
| design-trace/editor-api.ts:45~50 documentControl | OWNER 또는 HANDOFF_ELIGIBLE이 서버 검산 HELD+session actor/client+양의 generation을 만족할 때 기존 generation 소비 | VIEWER·OTHER_CLIENT/UNASSIGNED 거절, stale response/fence·원 document buffer/UNKNOWN 보존. 클라이언트 role만으로 허가0 |
| documents/project-files.ts:41/57 | upload의 본문 수신 전·실제 저장 전 두 guard를 같은 일반변경 조건에 연결 | origin/CSRF/idempotency·Artifact bytes/hash/검사·정책·quota 유지 |
| documents/project-documents.ts:59 및 save:156~ | proposal replay의 guard를 ordinary 분기와 정합; save/propose/import의 실제 storage 경로를 소비 | 문서 form은 SYSTEM 또는 실제 user 소유 USER_COMMON만 허용(:165); 수락으로 다른 사용자 공통양식/Artifact 원문·원작성자 선택 권한을 만들지 않음. 원 command/버전/hash/본문·receipt 귀속 보존 |
| projects/project-storage-quota.ts:99~ | #current의 해당 ordinary operation만 새 grant guard 사용; prepare/reserve/start/publish/settle/replay 전체에서 같은 원문/current 소비 | saveCheckpoint 등 미매핑 operation은 기존 OWNER. 한도/미정착/단발/원 projection/불명 예약 보호 불변 |
| documents/project-source-links.ts:40/102/106/113 | AUTO 또는 원 정책 아래 ordinary LINK/CHANGE의 옵션/prepare/check/최종 command에 같은 현재 grant 검산 | 옵션 조회는 가짜 command/승인소비0; DENY/없음 거절·기본포트412·원 Artifact·OS 미검증 보존. options 응답은 current 권위가 아님 |
| approvals/project-approvals.ts:36/201 | 일반 승인 신규 요청의 effective-current는 원 requester/client/controlGeneration에 대한 OWNER 또는 검산된 현재 handoff grant로 판정 | 특수 후보의 OWNER/원 작성자/client는 그대로. 원 요청의 requiredDecider/scope/policy/기한·소비단발 유지. 옛 generation 요청을 새 수락자에게 이전하거나 snapshot 재작성0 |
| 신규0073의 quota/문서 trigger 조립 | 아래 §8.3의 정확 ordinary branch에서만 실제 grant를 SQL로 검산 | 0059/0072/0003 과거 파일 불변·일반 bool/GUC 우회0·새 grant만으로 정책/소비 무시0 |

### 8.2 OWNER·특수승인·원 주체 보존

- savePermissionPolicy는 authorizeMaterial 예외 bootstrap이므로 별도 OWNER guard를 보존한다. 수락자 role을 OWNER로 바꾸지 않는다.
- saveProjectMembership는 OWNER·최근 재인증·현재 제어·정책·마지막 OWNER/자기 승격 방지다. 현재 미구현이면 이 WI로 기능을 새로 만들지 않는다.
- requestKnowledgeShare 출발 OWNER 및 baseline-sources OWNER/승인 후보 OWNER·원 요청자 조회·결정 requiredDecider를 보존한다.
- 공개 writer/native/등록·backup·특수 승인 후보의 명시 OWNER/원 작성자/원 client 검산은 일반 guard로 대체하지 않는다. 실제 원문 접근·등록권한이 없으면 계속 거절한다.
- linkDocumentSource/proposeDocumentSourceChange의 기본 AUTO와 REQUIRE_APPROVAL의 특수 OWNER target 검산을 분리한다. approvals/project-approvals.ts:79의 proposeDocumentSourceChange/detachDocumentSource는 기존 assertSourceDetachApprovalTarget를 통과해야 한다. 그 OWNER 후보 guard/원 target은 읽기 고정이며 HANDOFF_ELIGIBLE를 통과시키기 위해 수정하지 않는다. 따라서 AUTO 일반 source 경로와 달리 이 특수승인 경로는 여전히 거절될 수 있음을 UI/결과/완료 범위에 표시한다. 원 정책을 AUTO로 바꾸거나 승인 소비를 생략하지 않는다.
- requestApproval/decideApproval은 새 현재 세대와 새 요청에 대한 원 일반 허가를 소비한다. 후보 requestedSubjectRef·controlGeneration·requiredDecider·원 scope/hash·정책·기한은 그대로이며 옛 승인 요청을 수락 grant로 되살리지 않는다. requiredDecider가 현재 수락자와 다르면 그 사람으로 위장하거나 자동 결정하지 않는다.

### 8.3 SQL 저장·quota에서 남는 실제 OWNER 접점

TypeScript guard만 바꾸어 source 저장 완료라고 하지 않는다. 최신0072 quota_current:330은 OWNER를 요구하고, 0059 quota_account:79는 OWNER만 잠그며,0072 guard_document_import_write:514도 OWNER member를 JOIN한다. 따라서 신규0073에서 기존 OWNER public caller/분기는 보존하면서 위 ordinary operation의 HANDOFF_ELIGIBLE+실수락 grant+exact 현재 control+원 정책/receipt를 검산하는 목적 제한 내부 분기를 연결해야 한다. quota_account의 기존 공개 OWNER 입력을 전역 완화하지 않으며 ordinary quota용 고정 내부 조회 함수 후보를 같은0073에 두고 TypeScript #current가 실제 원 operation으로 소비한다. 이 함수의 exact signature/소유역할·EXECUTE/정책·U2 F 동일식은 구현 전 검수 항목이다. U1 proof reader의 SELECT 역할을 저장 권한 역할로 전용하지 않는다.

0003_project_documents.sql:37~64의 guard_document_draft_write는 OWNER 고정이 아니라 실제 command·receipt·control generation·원 author/client/hash를 검사한다. 그러므로 이를 OWNER 회귀로 오인해 완화하지 않는다. document version의 실제 작성자는 새 authenticated actor이고 과거 원문/author는 불변이다. 개인 USER_COMMON form·원 Artifact/원 import/proposal 선택 guard의 소유조건도 전역 완화하지 않는다. 새 수락자가 접근 가능한 실제 form/원자료가 없으면 해당 작업은 명시 거절되며 다른 사람의 원문을 자동 공개하지 않는다.

신규0073의 문서/Artifact/import/proposal/source trigger는 현재 최신 정의 본문을 기준으로 exact ordinary branch만 추가하며 기존 원 operation·승인·hash/bytes·한도/역완결을 보존한다. trigger 본체를 임의 성공 callback에 위임하지 않는다. 실제 일치 row/실 grant 검사 없이 TypeScript 성공을 DB 검산으로 대신하지 않는다. 추가 guard가 발견되면 정확 함수·operation·필요 조건을 먼저 반환하고 미완료로 표시한다. 기존 과거 SQL 파일 수정은 허가하지 않는다.

### 8.4 수락한 current의 FN15 후속 인계 소비

ControlAccessPage.tsx:41/52/73/101의 CONTROLLER 목록/prepare 버튼은 현재 OWNER만 허용한다. control-request-read.ts:126 canController 역시 OWNER이며 control-handoff-summary-store.ts:82/269와 control-discovery-read.ts:148이 소비한다. UI만 role을 추가하면 서버에서 계속 닫히므로 이 실제 경로를 함께 연결한다.

control-handoff-pg.ts:observe의 실제 OWNER/HANDOFF_ELIGIBLE member 복원 뒤 동일 auth Tx에서 현재 handoff grant packet을 검산한다. public v1 observation에 caller bool을 추가하지 않고 원 source instance/Tx/access identity에 결박한 private 결과를 controller 판정에 공급한다. 기존 OWNER 판정은 유지하고 HANDOFF_ELIGIBLE는 그 실제 current packet이 있을 때만 목적 제한 controller 판정을 통과한다. 기존 public OWNER helper를 일반화하지 않는다. OWN 조회와 CONTROLLER 조회를 합치거나 다른 사람의 과거 raw proof를 공개하지 않는다.

기존 public checkControl/원 state DTO의 HELD·actor/client/basis를 서버가 실제 grant 검산 뒤 생산하고, 같은 source/기한/원 auth 소유를 UI와 prepare·discovery가 소비한다. 새 DTO 필드나 role 승격은 없다. 새 current가 만드는 보호 요약/다음 수락은 원 request/base·기한을 다시 검산하며 v1 SYNTHETIC_ONLY/acceptanceEnabled=false의 원문/해시·과거 조회는 불변이다. 후속 준비에서 실 current/fence 공급자가 없으면 새 controller여도 UNKNOWN/수락0이다. FN16 export 전용 OWNER 관측(control-handoff-pg.ts:462)은 이 FN15 controller 확장의 대상이 아니며 그대로 보존한다.

### 8.5 r4 한정 검증·남는 경계

실제 Repo detail→documentControl→upload/normal command/quota/store→receipt의 양성·grant 없는 가짜 self control/회수/다른client·옛generation·무정책/DENY/만료·특수OWNER 승인 거절을 fakeDB/메모리 UI로 검증한다. Repo와 generic guard가 같은 순수 grant 검산을 소비하고 별도 fabricated HELD를 쓰지 않는다. 실제 저장 SQL은 정적 source/행 관계와 실제 PG 인수를 분리한다.

새 현재 HANDOFF_ELIGIBLE의 checkControl/CONTROLLER 발견·원 request 조회·새 보호 summary prepare→다음 target 수락의 생산소비도 기존 source/최소기한과 연결해 검증한다. 옛 v1 summary는 계속 수락0이고 old response/ABA/UNKNOWN 원 명령은 보존한다. 승인 목록은 새 일반 요청의 현재성만 바뀌고 옛 요청 REVOKED/만료와 특수OWNER 후보는 변하지 않아야 한다.

미매핑 일반 domain/assignment/saveCheckpoint/실행·등록/native/백업·관리/특수승인 caller와 실제 원문 접근이 막힌 작업은 이40경로로 완료됐다고 하지 않는다. U1 exact SQL/source-set·실 공급자, U2 projection/정산·초기화, U3 exact codec/DAG 검수도 여전히 구현 전이다. 이들은 r4 문서만으로 PASS/실제사용가능이 되지 않는다.

## 9. UI12 원명령·불명·현재성

실제 기존 App→ControlAccessPage→ControlApi→새 route/source를 소비한다. 별도 테스트 UI/복사 handler로 정상 흐름을 대체하지 않는다.

- 본인 원 요청 선택→정확 protected summary 생성/고정 조회→진행/미결·UNKNOWN/gap/기한·이전/대상 표시→명시 reason과 수락 확인→별도 accept 전송→원 결과·현재 checkControl 재조회 순서다.
- 과거 v1은 미확인 요약으로 그대로 조회하고 수락 disabled·이유를 유지한다. 새 보호 공급자 미등록/불완전은 UNKNOWN/수락0이다.
- accept는 source Scope의 원 session object·actor/client·project·request/fullref·summaryVersion/hash·control generation·transport/CSRF에 결박한다. 준비 뒤 변경은 새 관측이 필요하며 자동 명령 재작성0이다.
- 최초 전송 전 원 commandId/정확 JSON/hash를 App의 기존 버퍼 계열에 보존한다. UNKNOWN은 원 body/ID만 결과 조회/명시 재확인하며 원 입력·기준 변경/새 accept 자동 발급/닫기 삭제0이다.
- ABA·페이지/요청 교체·인증 상실·늦은 JSON/hash/old finally는 현재 화면/새 pending을 바꾸지 않는다. 조회 거절 시 raw 상세를 회수하되 원 UNKNOWN 명령은 보존한다.
- 성공 receipt만으로 현재 controller 표시를 합성하지 않는다. 실제 checkControl의 generation/current target를 재검산하고 옛 탭은 조회 상태/재허가 안내로 바뀐다.
- 실행 유지/중지/재개 상태를 제어권 이전 배너로 대신하지 않는다. source-only와 실제 미연결은 표시한다.

## 10. TDD·한정 검수 순서

이 절의 명령은 이후 별도 구현 GO 때만 실행한다. 지금은 모두 NOT_RUN이다.

- [ ] 정확 HEAD/WI SHA/기존 시작 지문·신규 부재/0073 충돌·보호3을 확인한다. Main/다른 writer의 dirty를 보존한다.
- [ ] 모듈 부재 준비 RED와 행동 RED를 구분한다. 같은 근본 보정 실패3회면 추가 시도 전 Main에 증거/현재 diff/지문/writer를 반환한다.
- [ ] 실제 reader를 호출하는 fakeDB를 만든다. 원 schema 열/SQL/실제 hash/receipt/audit·현 역할/세션을 모델링하고 raw bool/count0를 SAFE로 주지 않는다.
- [ ] provider 미등록·PROVIDER_CLAIM/HUMAN_RECORDED/SYNTHETIC·부분 coverage/초과/다른 scope·함수 교체·기한·늦은 query 정착의 수락0을 먼저 RED로 고정한다.
- [ ] 명시 시험의 protected reader/고정 공개 검증 벡터와 실제 source producer→요약→accept→CAS→현재 guard를 정상 연결한다. 실제 키 생성/OS/helper 호출 없이 원 검산 함수를 소비한다.
- [ ] 실제 HANDOFF_ELIGIBLE target 및 OWNER의 다른 client는 FN15 전용 reader에서 원 base 근거를 읽되 public writer.current/verifyWriterAuthorityConsumption의 기존 OWNER/current 검사는 그대로 거절함을 고정한다. 다른 target/project·fake actor/Tx·source instance·조작된 원 command/event subject·승인소비 ref는 거절한다.
- [ ] CAS 성공 뒤 old base-current를 다시 검사하면 자기 전환이 거절되는 반례를 RED로 확보하고, nextControl 정확 검산으로만 정상 COMMIT한다. CAS 뒤 next tuple/새 grant/원 receipt 변조·기한/세션 회수는 전체 rollback 또는 원 COMMIT 불명으로 보존하고 자동 재시도0을 검증한다.
- [ ] 두 accept 경합1승, 같은 ID/다른 body 충돌, 정확 replay 추가행/관측0, 각 INSERT/CAS/최종 역검산/COMMIT 실패 및 COMMIT 응답 유실을 확인한다. 처음에는1승/1충돌을 메모리 직렬화 모델 증거로만 표시한다.
- [ ] 원 요청/summary/raw hash 불변, v1 미확인 수락0, 원200refs/2MiB/30초/10GiB·정수포화·정확 비용/누락·중복·예약부족·UNKNOWN 자동해제0 반례를 확인한다.
- [ ] actual UI12/API/원 App buffer 소비로 클릭·원 명령/승인 세대·UNKNOWN·old response/ABA·원 화면 왕복·현재 제어 재조회와 old client 직접 변경/승인 거절을 검증한다.
- [ ] HANDOFF_ELIGIBLE current grant의 일반 변경 정상과 무정책/DENY/타 operation·만료 거절, OWNER 관리/공유/참여 권한 불변을 actual generic guard/caller로 검증한다.
- [ ] 영향 경로만 집중하고 새 파일 구문·root noEmit·diff를 확인한다. 실제 PG/DB RLS/ACL·실두기기/OS·Agent 인수는 NOT_RUN으로 분리한다.

구현 시 정확 명령 후보:
- node --test --test-concurrency=1 tests/unit/FN15/control-handoff-evidence-source.test.ts tests/unit/FN15/control-handoff-protected-summary.test.ts tests/unit/FN15/control-acceptance.test.ts tests/unit/FN15/control-handoff-storage.test.ts tests/unit/FN15/control-acceptance-schema.test.ts tests/unit/UI12/control-acceptance.test.ts
- node --test --test-concurrency=1 tests/unit/FN15/control-source-integration.test.ts tests/unit/UI12/control-api.test.ts
- node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
- git diff --check

기존 독립 보호 reader/관리권한 시험의 기준 SHA가 그대로면 불필요한 전체 재실행0. 필요한 변경접점의 추가 인접은 Main이 정확 경로/명령을 선정한다. 실제 PG·브라우저/기기·서비스 QA 계획은 이 WI에서 자동 실행하지 않는다.

## 11. Main 확정 전 남은 항목·승인 경계

| 항목 | 현재 초안의 권장·확정할 사항 | 실패시 |
|---|---|---|
| U1 protected source-set/current | §5.2.1 Main 확정 전용 SELECT 역할/RLS·fixed reader/순수 core·분모 분리의 exact SQL/내부 유한식 검수; actual current/fence 공급자 부재는 별도 | UNKNOWN/수락0, count0·bool로 READY0 |
| U2 실제 저장 계상 | §7.2 Main 확정 F 통합/0073 원자 초기화·신규 creation anchor·complete·고정폭 비순환 비용식의 exact 구현 검수 | IMPLEMENTATION_GO0, 정확 추가 경로를 Main에 반환 |
| U3 물리 제약/결과 | §6.1.1 Main 확정 acceptance→grant events→receipt→audit→result DAG와 최초 before anchor/현재 grant 역완결의 exact codec/FK 검수 | 기존 DTO/0041 불변, 임의 fullref0 |
| U4 역할 경계 | §8 별도 ordinary guard·공유 control-grant·Repo HELD/documentControl·upload/quota/store/FN15 후속 인계의 실제 소비; 미매핑 operation/특수OWNER는 기존 거절 보존 | 역할 자동 승격/조건 삭제0, 추가 경로는 사전 반환 |

U1~U4는 기존 FN15 의미를 기술적으로 닫는 항목이며, DTO/물리형식 미작성만으로 전체 accept 재승인을 요구하지 않는다. Main이 기존 근거 안의 내부 방법·경로·형식을 확정하고 독립 검토한 뒤 exact WI/hash/파일 소유를 dispatch한다.

새 실제 서명 목적/키 발급, 다른 주체/프로젝트의 새 권한, 모바일 조회자의 별도 승인 위임, 자동 강탈·미확인 실행을 안전으로 바꾸는 예외가 필요해지면 그것만 기존 승인 대비 delta로 분리한다. 이 초안으로 채택하지 않는다. 실 DB/GRANT/키/서비스/Agent/OS·비용/실사용자 인수 실행도 별도다.

## 12. 제출·복구·완료 판정

이 문서 작성 결과는 설계 초안이며 구현 PASS가 아니다. 이후 구현자는 시작/끝 지문·정확 변경 목록·RED/준비 오류·명령/exit/count/시간·미검증·live/자원·rollback·writer 반환을 보고한다. Main이 문서/WORK_STATUS/Git·독립 검수·통합을 소유한다.

완료의 최소 단위는 실제 서버의 새 보호 생산/수락 consumer→같은 Tx/CAS/비용/완결→UI12/§8에서 매핑한 일반문서·승인·후속 인계 current 소비까지 source 연결이며 helper/interface만 추가한 상태는 미완료다. 생산 근거가 없는 경우에는 기본 UNKNOWN/수락0을 실제 경로로 검증하고 미등록 선행을 정확히 남긴다. 합성 양성은 실제 OS 안전·실 사용자 제어 전환·전체 FN15/계획 완료가 아니다.

source rollback은 Main이 승인된 checkpoint의 정확 이번 경로만 회수한다. 기존 grant/세대·감사 원문/보관 요청을 삭제하거나 세대를 되돌려 양쪽 권한을 살리지 않는다. 0073은 미적용 상태 유지, 실제 DB downgrade/ACL/자원 정리는 이 WI로 허가하지 않는다.

## 13. 개정 이력

- r1 부모 E2850D9D3E9EC439C13CE039D873A2B04B2001A32E53C88CB77DDDD11052550E: Main canonical/mirror 정합 기준.
- r2: Reviewer I1의 수락자 public current 재사용 오류와 CAS 후 old-base 최종검사 오류를 수정했다. 순수 검산 추출 후보 기존2파일을 추가해 allowlist22로 조정했고 public OWNER/current guard는 불변이다. SQL 목적제한 reader·실 공급자 미구현은 U1, Main 권장 F 통합은 U2 확정후보로 남긴다. 문서 보완만 수행하며 구현/실행 GO0이다.

- r3 부모965600BCC272949CC3980D646C54E31295FEA86988F38F850087754200F6F27B: Main 확정 U1 전용 SELECT 역할/RLS·인증행 잠금 예외와 내부/공개 분모 분리, U2 F 초기화/생성 anchor·잔액/complete, U3 비순환 참조 순서를 본문에 통합했다. U4는 operation별 검토 중이며 exact SQL/비용식·실 공급자 부재를 완료로 표시하지 않는다. 문서만 보완, 구현/실행 GO0.

- r4 부모8B443D8F4D8E08123E900FE8E846E0ABE0850DB3EE5662F7FC4390239EFB8685: Main U4 방향을 별도 ordinary guard/공유 grant·기존 상세 HELD/documentControl·실 upload/quota/store·FN15 후속 인계 소비로 통합하고 후보40경로로 구체화했다. 기존 public OWNER helper/관리·특수승인·원문 권한은 보존하며 미매핑 domain/실 SQL·공급자 미연결을 별도 미완료로 남긴다. 구현/실행 GO0.

## 14. Main source 구현 확정과 위임 범위 — r5

기존 승인 INTERFACES13.6/15.2와 FUNCTION_WORK FN15를 근거로 source 구현을 진행한다. U1~U3 r3 독립 C0/I0 및 U4 r4 독립 C0/I0는 문서 정합 증거이며 구현 합격이 아니다. 40경로(기존27·신규13)/0073 부재·diff check는 HEAD998994a5에서 확인했다. Main의 이 확정은 새 사람 권한·Agent 실행·DB 적용을 허가하지 않는다.

- U1: §5.2의 FN15 전용 SELECT 역할·명시 RLS·정적 SECURITY DEFINER·현재 target/base/next/replay 구분을 구현한다. 기존 OWNER·false 정책·일반 raw 조회·DML을 보존한다. exact SQL signature/열별 쿼리·순수 검산 조립·source-set/watermark·내부 유한 메모리식은 고정된 목적/한도 안의 구현 상세로 Primary가 정하고 TDD·독립 검수에 제출한다. 현재 공급자가 없으면 실제 경로는 UNKNOWN/수락0이며 명시 합성 양성을 실제 공급자 연결로 승격하지 않는다.
- U2: §7의 F 독립 원장/used·held 통합과 기존 프로젝트 forward 원자 초기화·신규 생성 anchor를 구현한다. 기존 예약·manifest·한도·별도 소계·권한 분기는 유지한다. exact 물리 plan·고정폭 cost codec·예약 자체 비용의 유한식·FK/역완결·guard 조립은 구현 상세다. SQL 파일을 작성하고 합성으로 검산하되 PG/role/GRANT/DDL은 실행하지 않는다.
- U3: §6의 비순환 command input→acceptance basis→grant events→receipt→audit→result와 현재 tuple/CAS·역완결을 구현한다. 최초 anchor를 과거 grant 발급으로 만들지 않는다. COMMIT 불명·단절은 원 명령/결과 조회로만 다루고 자동 재호출·다중 grant·세대 역전환0이다.
- U4: §8의 일반문서9 operation·기존 승인 엔진의 정확 분기와 실제 project 상세 HELD/documentControl·upload/quota/store·후속 FN15 인계를 연결한다. 기존 public OWNER helper·관리·특수 승인/원문·원작성자·requiredDecider는 유지한다. 미매핑 일반 domain은 원 FN15/전체 작업계획의 미완료로 남긴다. 이 source package가 전체 FN15의 최종 완료 기준을 줄이지 않는다.
- 구현 순서는 보호 생산/원문 검산과 저장 비용→요약/수락·현재 grant→일반 서버/UI 소비로 이어지되 하나의 연결된 기능을 목표로 한다. 사용하지 않는 adapter나 시험 전용 복사 handler만 작성하고 완료하지 않는다. 내부 단계별 checkpoint는 허용하나 단계 일부를 최종 수락 기능 완료로 보고하지 않는다.
- 새 테스트는 실제 production 호출선/상태/거절·정착·저장 결과를 검산한다. 준비 RED와 실제 행동 RED를 구분하며, 기대값·원 기한·기존 보안 검사는 완화하지 않는다. 모델/합성 DB 검증은 실제 SQL/RLS·두 기기·OS/Agent 인수와 구분한다. 필요한 직접/인접 검증만 선택하고 unchanged 전체 회귀는 반복하지 않는다.
- 실제 키·DB·권한/역할·정책 적용·서비스·Agent·제품 네트워크·OS·실자료/백업 조사·컴파일/물리 QA는 금지다. 제품/시험 source 읽기는 허용한다. 외부 자원이나 별도 임시 QA가 필요하면 생성하지 말고 정확 이름·이유·수명·범위를 Main에 반환한다. 메모리 합성 및 noEmit/메모리 build는 source 검수 범위다.
- Main은 기존 단일 Primary만 code writer로 지정하고 같은41경로를 동시에 수정하지 않는다. Primary는 subagent를 만들지 않는다. 실패·미확정·추가 경로/계약 필요가 있으면 현재 변경과 정확 근거를 반환한다. 내부 구현 방법은 Main이 판단하며 기존 기능 전체의 재승인을 다시 요청하지 않는다. 제품 범위/권한·원문/비용·공개 의미가 실제로 달라지는 delta만 별도 분류한다.
- 완료 제출은 exact 변경 파일/SHA·실행 명령/exit/count/시간·RED/보완·미실행·미검증·자원/실효과0·writer 반환을 포함한다. Main은 독립 검수·집중 재확인·WORK_STATUS·기존 branch checkpoint/private 게시를 맡는다. PR/main 병합·배포·전체 완료는 이 source GO에 포함하지 않는다.

Ruling: 이미 승인된 FN15의 source 구현 상세를 Main 권한으로 확정하고 진행한다 — 별도 사용자 역할이나 실제 효과를 추가하지 않으며, 미작성 SQL/codec만으로 전체 기능 재승인을 반복하지 않기 위함 — 잘못된 내부 상세는 같은 package에서 TDD·독립 검수로 재작업하고 실제 효과는 발생시키지 않는다.
## 15. r6 직접 인접 시험과 빈 관리범위의 증명

### 15.1 시험 경로 추가

허용 경로는 기존40에 tests/unit/UI00/control-access-page.test.ts 한 파일을 더한41개다. 기존 시험의 부모 SHA256은 B460D860C45F47F1BD85C6F76C382B23A44342E7DF2EF4BA2D61533A0132FDBB다. UI의 실제 수락/보호요약 제어 추가로 달라지는 '미구현' 문구·정확 버튼/입력 수를 실제 동작에 맞게 갱신할 수 있다. 초기 IO0·자동 허가/수락0·same-origin/선택 project 격리·확인 전 수락 disabled·v1 미확인/30초·원요청 기한 분리 단언은 그대로 보존한다. 단순 삭제·정규식 완화로 검사를 녹색으로 만들지 않고, 늘어난 실제 UI 제어와 안전한 초기 상태를 구체적으로 검사한다. 기존 기능 범위나 인수 기준의 완화가 아니다.

### 15.2 Agent 미연결과 관리범위의 폐쇄된 부재를 구분

Anvil 자료/제어는 Agent와 독립적이다. 승인 설계9.3·INTERFACES13.6의 제어권 이전과 실행 중단의 구분에 따라, 서버가 발급한 관리범위가 완전히 비었음을 실제로 증명한 경우까지 외부 OS current 공급자를 무조건 요구하지 않는다. 이 가지는 실OS에 어떤 프로세스도 없다는 증명이나 실제 실행·기존 root를 무시하는 예외가 아니다. 기존 current 공급자가 없다는 이유만으로 이 증명을 생성할 수 없다.

필수 생산·소비 조건:
- 정확 생성 intent→project/member/control→createProject command/receipt/audit→생성 완료의 불변 계보를 검산한다. EMPTY 표시나 caller provenance/coverage bool만으로 허가하지 않는다. 기존 root·복원·출처 불명·EXISTING/미확인 source는 이 가지로 안전 승격하지 않는다.
- 고정된 서버 발급 source-set은 실행·grant·writer/native·전달/outbox·허가/준비·예약과 실제 발급 경로를 모두 포함한다. project별 끝 관측·원문/hash/역참조·누락·불명·미정착과 generation/watermark를 생산자가 검산한다. 한 표의 count0·첫 page·임의 source 목록은 충분하지 않다. SYNTHETIC_ONLY 원행도 삭제/무시하지 않고 미결로 분류한다.
- 준비 시점뿐 아니라 accept 직전까지 실제 발급 경로와 공유하는 project/control 잠금·세대 fence로 폐쇄를 보존한다. 빈 조회 뒤 다른 grant/전달이 COMMIT될 수 있으면 증명이 아니다. 외부/파일 발급 경로가 닫혔음을 확인하지 못하거나 source-set/consumer 검산이 누락되면 UNKNOWN을 유지한다.
- 동일 원 인증 Tx/project/base/요청/수락 명령·최소 기한에 결박한 private 결과로만 소비한다. CAS 후 nextControl·원 정책/세대·전후 이력·비용/물리행 완결을 검사하며, 옛 client의 대기 명령/승인은 재허가 없이 새 세대에서 수행되지 않는다.
- 내부 이유/근거는 '발급된 관리범위의 폐쇄된 부재'만 나타낸다. OS 무실행·실제 fence CURRENT·새 실행 권한을 주장하지 않는다. DB 원문/권한/미정착 수집이 실패하거나 source-set 폐쇄가 증명되지 않으면 빈 결과로 대체하지 않는다.

실행·writer가 존재하는 정상 경로는 그대로 유지하며 activeExecutions=0을 일괄 요구하는 새 정책을 만들지 않는다. 현재/fence·계속 실행 공급자가 실제로 없는 경우는 UNKNOWN/수락0이다. 이 가지의 정확 source-set/SQL·수위/메모리식은 고정 목적 안의 구현 검수 사항이다. 완전한 발급 경로 폐쇄가 아직 증명됐다는 문서 판정은 아니며, 실제 코드·반례·잠금 소비 검수 전에는 READY로 보고하지 않는다. 새 OS proof·키 목적·역할/원문 권한을 이 보완으로 추가하지 않는다.

독립 읽기 결과는 원계약 안에서 조건부 가능/전체 폐쇄 증명은 아직 아님이다. 실제 endpoint/source-set이 이를 닫지 못하면 그 정확 누락을 유지하고 다른 구현을 계속한다. 수락 기능 전체 재승인이나 'Agent가 없으니 항상 중단'으로 대체하지 않는다. source-only 구현 GO는 유지하고 실제 키/DB/권한/서비스/Agent/제품 네트워크·실자료 효과0이다.
## 16. r7 새0073 SQL의 LF artifact 보존

허용 경로는 기존41에 .gitattributes 한 파일을 더한42개다. 기존 .gitattributes 부모 SHA256은0AF8D73D5B670B3889E2EB5317301B1C52B9103DC5443F7FD3198EC29483F880이다.

Main은WIP stage의LF→향후CRLF경고와git ls-files --eol/check-attr의i/lf·w/lf·text/eol unspecified를확인했다. 기존 .gitattributes에는 *.sql text eol=lf가있지만 *.sql.pending에는적용되지않는다. 기존migration manifest/runner는읽은UTF-8 SQL의raw SHA256을사용하므로줄바꿈차이를몰래정규화하거나기존checksum정책을바꾸지않는다.

Primary는기존다른규칙과바이트를보존하고다음정확한한규칙만추가할수있다.

db/migrations/0073_control_handoff_acceptance.sql.pending text eol=lf

기존pending전체에새glob을적용하거나과거fixture/SQL을renormalize하지않고global/localGit설정을바꾸지않는다. 최종0073파일·Gitartifact의실제LF바이트/SHA와source checksum을대조한다. 이설정은versioned artifact형식의내부보완이며DB/권한/Secret/서비스/Agent/네트워크실행허가가아니다. 코드writer는계속같은Primary한명이고Main은문서/Git/검수만소유한다. source/SYNTHETIC GO1·실효과GO0과이전미완료/미검증분류를유지한다.