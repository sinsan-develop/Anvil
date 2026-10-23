# FN06/FN08 실제 writer 권위 — 최소 delta 결정 후보 v2

## 0. 판정·요청 범위

- 2026-10-23 / Main 어울. **설계·지원 후보이며 미승인·미구현·미적용**이다. PMO의 읽기/후보 작성 지시만 적용한다.
- 기준 source `8d5e02b693f7abfd66ac01ca06b430244ca7686c`, 기존 branch `codex/av3-stage-b`. 기존 D1 승인 패킷 raw SHA256 `5459268F30DBD81600CFE48EA497845268330A67A2A22A95F7B081C72921D2C3`의 정확5표는 보존한다.
- 결정 요청: §3의 대안 중 **B(기존5표·합성표 보존 + 실제 writer current/history 2표의 별도 미적용 source 계약)**를 권장한다. 새 표가 반드시 필요하다고 확정한 것이 아니다. 대안 A/C도 의미·소비 영향으로 비교했다.
- 승인되더라도 이번 후속 구현은 **별도 미적용 SQL·런타임 schema/기본 미등록 source·합성 검증·문서**까지만이다. 실제 DB/역할/정책/키/인증서·credential·root/ACL/IPC/socket·compiler/OS/프로세스·Agent·비용/배포는 모두 제외한다.
- 이 후보 작성은 원 D2 단발 실패/소진 및 새 raw4 재compile 미결을 해소하지 않는다. 기존 보호8·0038/FN05/ProviderHandle 특정 거절을 우회하지 않는다.
- **새 원자료 저장소만 추가해도 실제 NONE/격리가 생기지 않는다.** 실제 공급자·강제 수단·현재 보고 진위가 없으면 UNKNOWN/미등록·실행 거절을 유지한다.
- v1 독립정적 C0/I1/M1의 최초보고 부트스트랩 누락과 head fullref 불명확을 Main이 v2에서 보완했다. 후자는 서명/CAS 구현 불가 영향으로 Important로 재분류했다. 원 지적은 보존하며 보정후 독립재검토/actual시험 PASS를 주장하지 않는다.

## 1. 정본과 실제 소비 대조

| 근거 | 재사용할 부분 | 재사용만으로 충족되지 않는 부분 |
|---|---|---|
| WORK_PLAN FN06/FN08, FUNCTION_WORK FN08, DATA_MODEL §9 | 현재 주체/제어·원 명령/중복·소스 범위/실제 회수의 요구 | DATA_MODEL의 writer 모델은 설계이고 실제0017과 같지 않다. DB lock만으로 OS 쓰기 배제 불가 |
| TECH_DECISIONS §3~4/§12 | 서버 권한판정, 실행기 시작 outbound 연결, writer1/외부실행1·한도, Job 관측 | 같은 Windows 사용자 다른 앱까지 DPAPI/Job으로 격리하지 못함. Job은 filesystem WRITE 격리가 아님 |
| 0017_execution_authority.sql:186~196 | 원 SYNTHETIC_CLAIM 이력·미회수 unique 및 grant/명령 관계 | CHECK는 SYNTHETIC_CLAIM 전용. 빈/만료/reclaimed_at을 실제 NONE/쓰기 회수로 해석할 수 없음 |
| 0018/0022 및 0031 소비 | 기존 합성 관측/회수·방법론 전환 거절 유지 | 실제 상태를 기존 칸에 넣으면 guard·grant 의미가 연쇄 변경됨 |
| ownership-writer-history/native-factory-basis | 원 HUMAN/등록/receipt·전후 이력·알려진 미회수 claim 차단 | HISTORY_ONLY/UNKNOWN·권한false. 실제 writer 발급/회수와 초기 NONE 관측 없음 |
| D1 정확5표 anchors/bindings/heads/observations/events | 준비/원 anchor·headCAS·관측 nonce/서명·회수 이력 | heads는 준비 관측 후 anchor를 요구. writer 예약을 여기에 먼저 넣으면 준비→writer→anchor 순환이 생김 |
| ServerExecutionFactV1 / planSyntheticExecutionGrant | 문법·전체 checks/현재성·최소기한·NONE 필수라는 검사 | transport=SYNTHETIC_ONLY·실행false 고정. 이 객체를 actual grant로 재명명/승격하지 않음 |
| execution-challenge-store.currentReadOnly | 원 HUMAN/session/정책·등록키/current 예산·원 receipt 재검사 | 합성 credential 예약은 실제 token 아님. 기존 set_config·행 존재는 OS/source 증거 아님 |
| registration-proof / registration-protocol | P-256 SPKI/fingerprint·정확 서명 원시 연산·회수검사 | 등록 proof는 정확8필드·등록 목적 전용, credentialScope=REGISTRATION_STATUS_ONLY. 새 writer/소스/준비 서명·호출 허가는 아님 |
| 새 Job/JobAssignment SOURCE | 원 Job private 보유·생성시 JOB_LIST 입력의 수명/정리 소스 | 실제 compile/OS NOT_RUN, 원 process/thread/인가/소스 격리 미완료. 실제 writer 증거로 쓸 수 없음 |

위 대조는 source 읽기이며 실제 PG/OS 현재 관측이 아니다. 개발환경의 10/22 exited 기록도 이번 runtime 재확인이 아니다.

## 2. 세 권위 축·책임·보장 범위

| 축 | 실제 발급/관측 책임 | 원자료·서버 채택 | 회수 조건 |
|---|---|---|---|
| OS fence | 별도 인가된 native factory가 원 Job/process/thread/image를 생성·유일보유하고 fresh request에 관측 | D1 anchor/head·원 nonce/request·등록 observer 서명과 retained identity/미재개·Job membership 대조 | 같은 원 run/세대/이미지/자식의 실제 종결/잔류 관측. timeout/Close 표식만으로 회수 아님 |
| project writer 독점 | 서버가 project lock 아래 current head/정확 lease를 예약·CAS. 실행기는 해당 lease/원 factory·source fence를 현재 재검사 | 새 writer ledger 후보가 서버 원 권위. 합성 claim·caller NONE·기한 만료는 원 권위가 아님 | 새 lease 전 원 OS 종결 및 source WRITE 폐쇄 보고 + 현재 서버 회수 사건 필요 |
| source WRITE 격리 | 선택한 OS/provider가 승인 root·실체/링크/범위·권한을 강제로 한정하고 폐쇄 가능해야 함 | source scopes/fullref + 실제 격리 수단/세대·scope hash·fresh 서명 보고. 경로 문자열/DB unique로 대체하지 않음 | 원 권한/프로세스·하위 writer·잔여 WRITE가 실제 폐쇄됐다는 별도 관측 |

- 보장 수준을 `ANVIL_MANAGED_EXECUTORS`와 `ENFORCED_ROOT_WRITES`로 구분한다. 전자는 Anvil 발급 중복만 막는다. 기존 요구의 실제 WRITE 안전성을 만족했다고 낮춰 해석하지 않는다.
- WRITE 임무는 후자와 실제 검증이 있어야 한다. 동일 사용자 임의 앱/관리자까지 배제할 수 없는 수단은 그 한계를 표시하고 해당 WRITE를 허용하지 않는다. 위협 범위 변경은 별도 사용자 결정이다.
- 새 전용 root라고 선언하거나 디렉터리가 비어 있다고 최초 NONE이 되는 것은 아니다. 정확 root의 신규성/실체·외부 노출/기존 writer 없음 및 강제 경계를 확인해야 한다.
- 다른 프로젝트가 같은 실체/링크/상하위 파일을 가리키는 충돌도 source provider가 검사해야 한다. project당 writer1 DB 제약만으로 교차 프로젝트 격리 PASS 불가.
- READ 전용 임무도 Agent가 소스/비허가 경로에 쓰지 못하는 실제 수단 없이는 안전하다고 주장하지 않는다. CONTEXT_REVIEW를 전체 FN06 코딩 검수로 대신하지 않는다.

## 3. 대안 비교

| 대안 | 정확 변경 후보 | 장점 | 위험/보류 이유 |
|---|---|---|---|
| A: 기존5표 확장 | ownership_events의 새 writer/source kind·payload, ownership_heads의 writer epoch/state/lease/tip 열 및 anchor 없는 초기 head 허용, 기존 parser/SQL guard/current 소비 변경 | 새 표0 | 현재 head의 anchor 필수·준비 chain 첫 사건과 충돌. writer 부트스트랩 때문에 기존 osFence 의미·FK/nullability/nonce 소비까지 바뀜. 작아 보이나 기존5표 계약을 넓게 수정 |
| **B: 별도 current/history 2표** | §4의 project_writer_authority_heads/events, 새 내부 schema/reader/명령·관측 계약. 기존5표는 fullref 연결로만 재사용 | 기존 합성/anchor 의미 보존, 준비 전 writer epoch/원 회수·실패 이력 분리 | source-only 승인 delta가 필요. 실제 provider/등록 목적·소스 격리는 별도 선행. 표가 생겨도 actual 권위 활성화되지 않음 |
| C: 기존 writer_claims 확장 | ownership_state CHECK 새 실제 상태, authority_kind·epoch·evidence/tip·ref 열, 구행 합성 구분. 0017/18/22/31 및 grant/회수/current 소비를 forward 보완 | 새 current 표0 가능 | 오래된 합성행의 회수 표식을 actual로 오인할 위험. append 이력은 따로 필요하며 구 guard와 actual 허가를 병행해 영향 큼. 구행 자동 승격/변환 금지 |

**권장 B.** 기존5표와 합성 상태를 보존하는 비용을 선택한다. A/C를 승인 없이 배제·구현하지 않는다. 새 표2도 확정 요구가 아니라 검토 가능한 최소 분리안이다.

## 4. B안의 정확 저장 후보 — 아직 SQL 파일 없음

스키마 anvil. 기존 app/migrator 역할 분리는 재사용하되 실제 역할/GRANT/RLS 적용은 별도다.

### project_writer_authority_events (append-only)

- 식별: `project_id,id,version(1),authority_epoch,sequence,kind,previous_ref,content_hash,payload_json,at,expires_at`.
- 결박: `lease_id?,execution_id?,execution_generation?,subject_json,registration_ref,host_fingerprint,source_scopes_json,scope_hash,command_ref?,authorization_receipt_ref?,audit_ref?,request_ref?,nonce_digest?`.
- payload는 kind별 exact schema·최대2MiB/기존 SourceScopeV1 최대200 target를 재사용. 자유 JSON/원문 Secret·host 실경로 저장0. 준비/anchor/source 보고 fullref는 각 kind에 고정한다.
- kinds: `BOUNDARY_OBSERVATION_REQUESTED,BOUNDARY_OBSERVATION_ACCEPTED,BOUNDARY_ESTABLISHED,RESERVED,NATIVE_CREATE_REQUESTED,OS_OBSERVATION_ACCEPTED,SOURCE_FENCE_OBSERVATION_ACCEPTED,ACTIVATED,REVOKE_REQUESTED,RECLAIM_CONFIRMED,EXPIRED,UNKNOWN`. 부트스트랩의 WRITER_BOUNDARY/SOURCE_WRITE_BOUNDARY는 exact purpose별 별도 request/nonce다.
- PK(project_id,id,version), UNIQUE(project_id,authority_epoch,sequence). 동일 lease의 RESERVED 1회 partial unique. request 수용 kind별 exact request1회 unique.
- UPDATE/DELETE/TRUNCATE 금지. previous_ref의 동일 project/epoch·직전 sequence/hash를 검사하며 자체 contentHash·서명 해시 순환을 만들지 않는다.
- 최초 BOUNDARY_ESTABLISHED는 current HUMAN/OWNER·별도 정책/필요 승인·최근 재인증 + 실제 fresh boundary 보고가 있어야 한다. 단순 새 행/사용자 선언으로 생성하지 않는다.
- head가 없어도 project row lock 아래 예상 authority_epoch를 서버가 고정하고 events의 최신 complete chain/sequence를 읽어 REQUESTED를 먼저 append한다(처음 previous_ref=null). 최초 HUMAN 원명령/receipt/audit·현재subject/등록/정책·scopeHash·purpose·서버nonceDigest/기한을 그 원 REQUESTED에 보관한다. accepted는 이 requestRef를 1회 소비하며 임의 nonce/가짜 lease/head를 만들지 않는다. WRITER_BOUNDARY와 SOURCE_WRITE_BOUNDARY의 requestRef는 서로 다르고 각각 1회만 소비한다.
- 한쪽 보고만 도착했으면 그 수용 이력만 보존하고 head/EMPTY_AT를 만들지 않는다. 최초 BOUNDARY_ESTABLISHED는 같은 epoch/등록/범위의 두 accepted fullref를 결박하고 두 보고의 fresh 기한과 현재 주체/정책을 모두 재검사한다. 먼저 받은 보고가 그 사이 만료되면 새 authority를 만들지 않는다.

### project_writer_authority_heads (current/CAS)

- `project_id PK,id UUID UNIQUE,authority_epoch,head_generation,current_event_ref,phase,lease_id?,execution_id?,execution_generation?,registration_ref,scope_hash,expires_at,content_hash`. id는 서버가 처음 발급한 안정 head ID이며 head_generation은 epoch가 바뀌어도 감소/초기화하지 않는다.
- head fullref는 `{id,version:head_generation,contentHash:content_hash}`다. 해시 대상은 canonical UTF-8 JSON의 정확 `{schemaVersion:1,purpose:'PROJECT_WRITER_AUTHORITY_HEAD',headId,projectId,authorityEpoch,headGeneration,currentEventRef,phase,leaseId,executionId,executionGeneration,registrationRef,scopeHash,expiresAt}` snapshot이며 자기 contentHash/fullref는 포함하지 않는다. lease/execution nullable 값도 명시 null이다. currentEventRef는 **상태 전환 사건 ref**이고 head 자체 fullref와 다르다.
- phases: `UNKNOWN,EMPTY_AT,RESERVED,ACTIVE,RECLAIM_PENDING,RECLAIMED_AT`. EMPTY_AT/RECLAIMED_AT도 시간 제한 관측이며 무기한 NONE이 아니다.
- root/범위·원 명령·준비/anchor/source evidence는 current_event_ref의 정확 불변 사건에 결박한다. head에 자유 boolean authority를 저장하지 않는다.
- project row lock → current writer head → 기존 preparation slot/원 command/approval/budget 순서. 신규 head도 project lock 아래만 초기화해 row 부재 race를 막는다. expected head_generation/tip fullref로 CAS +1.
- 최초 상태 head는 BOUNDARY_ESTABLISHED 뒤 generation1로 만든다. 상태전환 event에는 전이전 expectedHeadRef(null 또는 정확 기존head fullref)만 결박하고 결과headRef를 넣지 않아 해시순환을 피한다. 요청/보고 append는 같은 project lock의 event chain만 증가시키고 그 자체로 state head를 바꾸지 않는다. request가 고정한 expectedHeadRef와 현재 head fullref가 수용/상태전환 직전 달라지면 거절한다. 비상태 event 최신sequence와 상태 head.currentEventRef를 혼동하지 않는다.
- authority_epoch는 강제 복구/환경 재등록 시 단조 증가. 옛 epoch/lease/run/등록 ref로 새 실행 불가. expiry는 EXPIRED/UNKNOWN으로 차단할 뿐 EMPTY/RECLAIMED로 전환하지 않는다.
- 기존 source root/물리 겹침은 host enforcement의 별도 global 현재 검사도 필요. SQL row lock의 보장 범위 밖임을 남긴다.

### RLS/SQL 경계

- source-only 시작은 새2표도 **기본 DML 거절·RLS false·manifest 미등록**으로 둔다. 기존0039/0017·기타 적용 SQL은 수정하지 않는다.
- 향후 실제 허용 설계는 현재 HUMAN/host 전용 protocol 주체·project/등록/현재제어·정책·원 명령/receipt/필요승인과 같은 tx의 guard+RLS로 한정한다. caller project_id/set_config/표 owner 우회만으로 허용0.
- head 지정열 CAS UPDATE 외 UPDATE/DELETE0. app에 스키마/표 owner 권한·범용 역할을 주지 않는다.
- 실제 PG 제약·경합·COMMIT 기한 검증 전 보안 PASS 금지. 기존0039 deferred/SET CONSTRAINTS M1은 별도 미해결로 보존한다.

## 5. operation/API/현재 인증 후보

| 경로/연산 후보 | 주체·권한 | 효과/비효과 |
|---|---|---|
| POST /api/v1/projects/:projectId/writer-boundaries/establish · establishProjectWriterBoundary | 현재 HUMAN/OWNER·단독 제어·새 명시 정책·최근 재인증·필요 일회승인 | 정확 source/등록/환경의 fresh boundary를 최초 사건으로 채택. 원문 선언·DB 부재만으로 EMPTY 생성0 |
| 기존 prepareOwnershipAnchor 내부 reserveWriterAuthority | 기존 준비 HUMAN 허가·원 command/receipt·별도 현재 writer/source evidence | 같은 tx에서 exact lease/epoch를 RESERVED로 고정. 새 범용 Agent 명령·START/SEND 허가 아님 |
| POST /api/v1/projects/:projectId/writer-authorities/:leaseId/revoke · revokeProjectWriterAuthority | 현재 HUMAN/OWNER·정확 ref/세대·명시 정책·필요승인 | REVOKE_REQUESTED/새 배정 차단. 실제 kill/쓰기 폐쇄는 별도 exact 실행 허가·관측 없으면 수행0 |
| GET /api/v1/projects/:projectId/writer-authorities/current | 현재 HUMAN·본인 허가 project 읽기/단독제어 규칙 | no-store·정확 tip/등급/미확인 조회. GET이 새 lease·관측/실행 권한을 생성하지 않음 |
| POST /api/v1/connector/writer-observations (내부 미등록 후보) | exact 등록 host·새 purpose scope·원 일회 request/nonce/기한 | 서버 발급 request에만 보고 수용. REGISTRATION_STATUS_ONLY credential은 거절. 브라우저/Agent 일반 operation 미노출 |

- 위 새 operation/API/권한 목록은 **미승인 변경 후보**다. 지금 기존 allowlist/route/policy나 사용자 권한을 변경하지 않는다.
- 기존 command idempotency/receipt/audit/일회승인·현재 HUMAN/control/credential generation·budget/read-current 검증 코드는 재사용한다. 같은 명령 재확인은 원 결과만 반환하며 새 lease/OS 생성0.
- 기존 registration proof의 목적·정확8필드를 넓히지 않는다. 새 서명 domain:
  - `ANVIL_WRITER_AUTHORITY_OBSERVATION_V1\0`
  - `ANVIL_SOURCE_WRITE_FENCE_OBSERVATION_V1\0`
- 위 두 lease-bound payload는 phase=LEASE_CURRENT, installation/project/authorityEpoch·leaseId/executionId/executionGeneration(모두필수)·registration/observer fullref·requestRef·nonceDigest·expectedHeadRef(필수 head fullref)·scopeHash·factsHash·observedAt/expiresAt를 exact 결박한다. 서로 또는 D1 OS 관측/등록 proof를 교차 수용하지 않는다.
- 최초 head/lease 없는 보고는 별도 domain `ANVIL_WRITER_BOUNDARY_BOOTSTRAP_OBSERVATION_V1` 또는 `ANVIL_SOURCE_WRITE_BOUNDARY_BOOTSTRAP_OBSERVATION_V1` 뒤 NUL 1바이트(0x00)를 붙여 쓴다. 위 lease-bound domain의 `\0`도 문자열 역슬래시/숫자가 아니라 NUL 1바이트다. exact phase=BOUNDARY_BOOTSTRAP·installation/project/authorityEpoch·registration/observer fullref·requestRef·nonceDigest·scopeHash·factsHash·observedAt/expiresAt는 필수이고, leaseId/executionId/executionGeneration/expectedHeadRef는 **전부 명시 null**이다. 필드 생략이나 CURRENT식 가짜 ID/head는 거절한다. 이는 writer lease 또는 실행 보고가 아니라 선택 boundary 관측만 뜻한다.
- 최초 REQUESTED의 purpose/phase/정확 null·scope/등록·nonceDigest를 서명에 대조하고, 원 head 부재·동일 epoch/현재 HUMAN·정책/기한을 다시 확인한 tx에서만 해당 ACCEPTED와 BOUNDARY_ESTABLISHED/최초 head를 생성한다. head가 생긴 뒤 이 bootstrap request/보고로 갱신·예약·재생성하지 않는다. 별도 lease를 RESERVED로 만든 뒤에는 새 LEASE_CURRENT 요청/nonce를 발급하며 bootstrap 보고를 그 관측으로 복사하지 않는다.
- P-256 검증 원시 연산의 재사용 가능성만 확인했다. 실제 protected signer의 새 purpose allowlist·credential scope 발급/실키 사용은 별도 exact 결정/검증 전0이다.
- **native 준비의 서버 진위**는 host가 자기 키로 서명한 caller echo로 증명하지 않는다. 권장 후보는 native 신뢰 구성의 고정 server identity/TLS + exact 등록 주체의 서버 current 조회/일회 consume로 원 receipt/nonce/lease를 직접 확인하는 경로다. 현재 status-only credential로는 불가하며 새 PREPARE_CURRENT 전용 최소 scope가 필요하다. 로컬 bridge를 택하면 별도 IPC 접근 주체/binary·scope/nonce/기한과 서버 current 인증을 추가 검증해야 하므로 더 작다는 근거가 없다.
- 새 서버 private key 생성/신뢰 CA 변경을 자동 전제하지 않는다. 신뢰된 채널/고정 origin과 실제 host 인가 수단이 확정·검증되기 전 native supplier는 미등록·UNAVAILABLE다.

## 6. 부트스트랩·수명·실패 순서

1. 현재 HUMAN 원 명령/receipt와 project lock 아래 최초 head 부재를 확인하고 phase=BOUNDARY_BOOTSTRAP/lease·execution·head=null의 purpose별 원 REQUESTED/nonceDigest를 먼저 저장한다. 실체/source 강제 경계 보고를 exact request/서명에 각각 1회 수용하고 현재 head 부재/epoch/주체/정책/기한을 재검사한 뒤에만 BOUNDARY_ESTABLISHED와 최초 head를 생성한다. 검증 불가/기존 writer 미확인/겹침이면 UNKNOWN·새 factory0.
2. 현재 subject/등록/정책/기한과 EMPTY_AT 또는 원 RECLAIMED_AT 증거를 같은 tx 재검사 → writer epoch/lease RESERVED + prepare 원 receipt/slot. 최솟값 기한은 기존 준비120초·등록/HUMAN/정책/증거의 최소.
3. 아직 anchor 없음은 정상. lease reservation은 preparationRef와 비순환 결박하고, 최초 OS 요청은 D1 BOOTSTRAP_PREPARED의 expectedHeadRef=null만 사용한다. writer reservation을 anchor/실제 process 존재로 표시하지 않는다.
4. 인증된 native current consume 뒤 원 Job/process/thread·root/image를 생성/보유한다. source-only 단계에는 이 실제 효과가 없다. 원자 Job-list 설정만으로 원process/미재개·권한/정리 완료가 되지 않는다.
5. fresh OS 관측 + 별도 source fence 보고를 각 request1회 수용, 정확 receipt/lease/epoch·동일 root/범위와 현재 등록 재확인 후에만 서버가 후속 실제 grant 가능 여부를 판단한다.
6. 기존 ServerExecutionFactV1/planSyntheticExecutionGrant의 SYNTHETIC_ONLY/false는 보존한다. actual 전용 내부 fact/permit schema와 소비자 전환은 이 delta 후속 검토 대상이며 기존 합성객체를 실허가로 변환하지 않는다.
7. 생성 실패/통신 유실/COMMIT 응답 불명/취소/시간 초과는 UNKNOWN 또는 RECLAIM_PENDING. ACK 유실에 새 process/lease 자동 재발급0.
8. 실제 원process/자식 종결 + 원 source WRITE 폐쇄·fresh 회수 보고 + 현재 서버 회수 사건이 모두 있어야 RECLAIMED_AT. 일부만 확인되면 다음 writer 차단 유지.
9. 재시작/epoch 교체는 과거 이력을 보존하며 현재 대조·사용자 재개 전 자동 실행0. expiry는 정리 요청 사유일 뿐 실제 종료/파일권한 회수의 증거가 아니다.

## 7. 필수 검증·결정 후에도 남는 범위

### source-only delta 승인 시

- schema exact key/fullref/hash/서명domain 및 kind/epoch/sequence chain·순환0, oversized/foreign project/registration·옛세대·다른scope 거절.
- 빈/만료/회수표식만으로 NONE 거절, source 없는 WRITE/같은process 다른source fence 거절, 등록 proof/OS 보고/다른purpose 재사용 거절.
- bootstrap 두 요청 경쟁/expected head CAS·원 command 재확인/다른 명령 재사용·한 request 중복 소비의 모델 반례.
- bootstrap의 명시 null/생략/CURRENT 가짜ID·head·다른purpose/report 거절, head가 생긴 뒤 pending bootstrap 거절, RESERVED 이후 새nonce 강제·bootstrap 관측 재사용 거절. head hash exact snapshot/자기참조 부재·currentEventRef와headRef 혼동/옛 hash CAS 거절·비상태 event chain과state head 분리도 대조한다.
- source/tip/HUMAN/등록이 await 중 변경되거나 최솟값 기한이 소진되면 거절·UNKNOWN. 합성 journal의 성공을 실제 PG 원자성으로 보고하지 않음.
- 기본 미등록/권한 없음·REGISTRATION_STATUS_ONLY의 새 API 거절, 기존 합성 grant/회수/5표 계약 인접 회귀.
- mock/fixture/type/static과 actual 증거를 분리. 새 정책을 실제 사용자에게 부여하거나 실제키/DB/native를 시험하지 않음.

### 별도 actual 실행 결정 뒤에만

- 실제 PG RLS/비owner DML·동시 두 writer/초기행 race·rollback/COMMIT응답유실·SET CONSTRAINTS/기한/영속 재시작.
- Windows 원Job/원process/thread/생성시할당·취소/자식이탈/중지 실패·정확scope 정리·잔류0, 실제 source 경로 교체/link/권한·같은/다른 project 물리 겹침.
- protected signer purpose·서버 identity/채널·등록 회수/키세대·별도 IPC 선택 시 신뢰 검증. 실제 외부 Agent의 쓰기/도구 승인·비용 한도/중지 등 FN06 필수 능력과 실제 임무는 별도 검수.
- 관측 불가능/권한 분리 불가면 UNSUPPORTED/UNKNOWN으로 해당 임무 배정을 막고 대안을 제시한다. 표/로그/프로세스 존재만으로 지원 PASS 금지.

## 8. 영향·복구·결정 항목

- B는 기존 합성 데이터/5표/적용 SQL·policy/등록 proof를 보존하지만 새 내부 자료·새 operation/API·purpose/인가 의미가 생기는 **실제 계약 delta**다. D1 exact5 승인에 자동 포함하지 않는다.
- source-only rollback: 새 후보 source를 비활성 상태로 보존하거나 해당 diff를 일반 revert. reset/force/history rewrite·원 실패 이력 삭제0.
- 미래 실제 적용 후에는 append 회수/새 forward 보완으로 복구한다. table/이력 삭제·합성행 승격/역migration·잔류 프로세스 무단kill은 복구안이 아니다.
- 사용자/PMO 결정 요청은 하나의 source 계약 묶음: **B안 새2표·위 operation/API/purpose/현재조회·기본 미등록 source/미적용 SQL·합성 검증을 승인할지**, 또는 A/C 대조/현행 유지로 돌릴지다. 이 답변을 actual 효과 승인으로 전용하지 않는다.
- 별도 미확정 actual 경계: source 강제 수단과 위협 범위, 실제 signer/host credential scope·서버 current 채널, 정확 runtime/OS/DB 자원과 회수 허가. 이를 지금 승인된 것으로 표시하지 않는다.
