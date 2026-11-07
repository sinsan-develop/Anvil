# FN06 등록 정의 결박 HUMAN 보고 상세 결정 후보

2026-11-01 / Main 어울 제안 / **NOT_ADOPTED · 제품/SQL 구현 GO 아님**. 기준 source/private b37655b0bea77b921500a9fffe2fd90ff03ce3e7, 제품 FN06 13524478/FN16 5263f903. 실제 DB·권한·키·서비스·Agent 실행/사용자·백업대상 파일 조사는 계속 제외한다.

## 1. 기존 목적과 실제 계약 차이
작업계획 FN06의 기존 도구 연결·필수6능력 원문/실측 구분은 이미 승인된 목적이다. 이번 후보는 그 목적을 다시 승인받는 것이 아니라 새로 저장한 등록 정의를 사람 보고에 정확 결박할 때 필요한 공개/저장 계약 delta다.

- INTERFACES §12.1의 ConnectionDefinition/CapabilityReport와 채택 HUMAN r2는 구분한다. 현재 claim은 schemaVersion1의 exact9필드이고 connection/environment 두 fullref가 필수다.
- capability-report-input.ts의 snapshot.bindingKind는 CANDIDATE_ONLY 고정, project-capability-reports.ts의 두 참조 검사는 CONNECTION_CANDIDATE/ENVIRONMENT_CANDIDATE의 head/kind/만료를 소비한다.0057의 두 FK도 connection_candidate_versions 전용이다.
- Web 검산과 책임세션 reader도 이 후보 전용 의미를 사용한다. NOT_READY 정의를 후보 행/보고서로 위장하거나 기존 schemaVersion1의 뜻을 바꿔 연결하지 않는다.
- 현재 등록 정의는 명시 environmentRef:null이 가능하며 비null 환경 보호 provider는 미연결이다. adapterKind는 어댑터 종류이고 보고서 tool.adapterVersion과 같은 필드가 아니다.

## 2. 두 접근과 Main 권장
**A 권장 — 명시 v2의 등록 정의용 사람 보고를 분리한다.** 저장/조회 가능한 사람 주장을 기존 도구 후보 보고와 구분하되 모든 실측/실행 권위는 미확인/false로 남긴다. 등록 정의가 환경null이면 보고도 명시null로 보존한다. 실제 환경/Agent 공급자가 없어도 승인된 source 구현을 이어갈 수 있으나 실제 연동 증거를 만들지는 못한다.

**B — 실제 보호 EnvironmentVersion producer/정확 연결을 먼저 완성한다.** 기존 v1을 보존하고 등록 정의 보고는 그 선행 뒤에 상세화한다. 환경 결박을 더 먼저 갖추지만 현재 환경/호스트·경로/보호자료 계약과 실행 제외를 별도로 해결해야 하므로 이 업무의 저장/조회 연결은 미완료로 남는다.

후보 ref를 등록 정의 ref로 재해석하거나 사람이 제출한 VERIFIED를 실제 VERIFIED로 채택하는 접근은 제안하지 않는다. 아래 A의 상세는 Main 제안이며 아직 사용자/PMO의 결정이 아니다.

## 3. A의 입력과 명령
기존 recordCapabilityReport 명령을 재사용하고 payload.schemaVersion으로 명시 분기한다. v1 exact9·후보/환경필수·기한·기존DTO/GET은 보존한다. v2도 exact9필드다.

`schemaVersion:2, connectionRef, environmentRef, tool, observedAt, expiresAt, supersedesRef, capabilities, reason`.

- connectionRef는 같은 프로젝트의 실제 agent_connections/불변 definition 버전/hash만 허용한다. fresh 저장은 같은 transaction에서 고정 definition과 현재 head 일치를 확인하고 후보/hosttrust alias를 거절한다.
- tool.product/version은 해당 definition의 toolProduct/toolVersion과 정확 일치해야 한다. adapterVersion은 기존 최대200자 독립 주장 필드이며 adapterKind로 자동 채우거나 비교하지 않는다.
- environmentRef는 definition.environmentRef와 정확 같아야 한다. 현재 가능한 null은 명시null이며 생략과 다르다. null을 실환경 확인으로 표시하지 않는다. 비null은 실제 같은 프로젝트 EnvironmentVersion 보호 reader가 검산해야 하며 미연결이면 SOURCE_VERIFIER_NOT_CONNECTED412다. 환경 후보로 대체하지 않는다.
- observedAt·6개 capability·최대20개 고유 증거/각cap 최대20·UTF8/비밀 의심·2MiB·documentation URL 등 기존 HUMAN r2의 한도를 보존한다. 새 raw 경로/키/임의 실행 필드는 없다.
- expiresAt는 기존 HUMAN r2와 같이 저장 기준시각+2시간 및 현재 명시 정책 기한 중 짧은 범위 안의 유한시각이다. 인증 세션은 처리 전후 현재성을 확인하며 보고서의 과거 기한을 로그아웃/세션 교체로 재작성하지 않는다. 정의에는 후보 만료가 없으므로 후보 만료를 임의로 합성하지 않는다. 잠금/증거 읽기 후 최단기한을 다시 확인한다.
- supersedesRef는 같은 프로젝트의 v2 보고·동일 connectionRef/environmentRef 관계만 허용한다. v1/다른 정의/다른 고정 버전 보고를 대체하지 않는다. 과거 원문/기한/작성자/증거는 보존하고 이전 보고를 삭제하지 않는다.
- 기존 현재 로그인·OWNER/단독 제어·정확 세대·명시 recordCapabilityReport 정책·원command/hash/멱등·영수증/감사·거절/UNKNOWN을 재사용한다. 기존 HUMAN r2의 AUTO 전용을 유지하며 REQUIRE_APPROVAL/approvalRef는 기존412 경계로 남긴다. 새 승인 유형·자동 정책 부여는 없다.

## 4. snapshot·false 권위
v2 snapshot은 v1의 필드를 유지하되 schemaVersion2, bindingKind=REGISTERED_DEFINITION_ONLY로 명시한다. sourceAssurance=HUMAN_CLAIM, executableObservationRef/probeRunRef/authorizationReceiptRef=null, 파생6능력 measurement.state/controlLevel=UNVERIFIED, executionAuthorized/dispatchPerformed=false를 고정한다.

submittedMeasurementState/요청 controlLevel은 사람 원문으로 보존할 수 있지만 실제 실측/허가로 승격하지 않는다. 설정 head 일치도 도구/계정/환경 현재성 증명이 아니다. 기존 definition.capabilityReportRef:null을 갱신하지 않는다. 보고서가 고정 정의 ref를 가리키는 단방향 관계이며 update/CAS·자동 역연결은 제외다.

## 5. 저장과 유한 상한
기존0057과 v1 자료는 수정·변환·삭제하지 않고 새 forward 미적용 SQL로 분리 저장한다. 제안 내부 표는 `definition_capability_reports`와 `definition_capability_report_evidence` 2개다. 보고서는 서버 소유id/version1의 불변행, 정의 버전 FK/fullref·claim/snapshot canonical/hash·원command/receipt/audit·실주체·증거행을 같은Tx로 결박한다. 기존 report namespace와 같은 프로젝트 ID 충돌을 허용하지 않고 모호한 조회를 거절하는 DB/서버 완결 검산을 둔다.

제안 신규 상한은 프로젝트별 v2 보고10,000개, 모든 보관 v2 claim+snapshot+증거행의 canonical UTF8 합산64MiB다. 만료/과거/대체된 보고도 산입하며 자동삭제/상한초기화0, replay추가0·COMMIT불명은0으로 돌리지 않는다. 상한 초과는429/원명령·보고·감사 같은Tx rollback이다.

현재 VERIFIED 기존원장 used/held와 등록 정의 canonical 합계·새 v2 보고 canonical 합계를 동일 project lock 아래 대조해 더 엄격한 기존10GiB 제한도 함께 유지한다. 정의/보고 및 이후 기존 원장 쓰기 양쪽에 guard가 필요하다. 기존 kind/수치를 위장하거나 옛 v1/전체 프로젝트 자료가 이미 전부 이 원장에 포함됐다고 주장하지 않는다. 보호 원장/정합성이 없으면412/실패로 닫는다. 내부 SQL/표 배치는 구현 preflight에서 고정하되 이 상한·불변/관계/원자성과 기존 v1 보존 의미는 변경하지 않는다.

## 6. 보호 GET·현재성
v1의 기존 GET은 그대로 두고 v2 전용 고정 GET을 제안한다.
`GET /api/v1/projects/:projectId/definition-capability-reports/:id/versions/:version`.
응답 exact7은 기존 보고 DTO 모양을 사용한다: `{projectId,ref,snapshot,currentnessIssues,effectiveForExecution:false,dispatchPerformed:false,checkedAt}`. fullref는 v2 exact snapshot canonical의SHA256다. 새 입력 schemaVersion2와 snapshot binding을 Web도 명시 검산한다.

현재 프로젝트 member 보호와 원보고/command/receipt/audit/증거 검산을 적용한다. fresh writer와 달리 역사 GET에 쓰기제어/원작성 client/OWNER를 새로 요구하지 않는다. 원정의 head/보호조회·보고 기한·증거 현재성을 별도로 확인하고 `REGISTERED_DEFINITION_ONLY,HUMAN_CLAIM_UNVERIFIED,ENVIRONMENT_NOT_DEFINED,CONNECTION_HEAD_CHANGED,CURRENTNESS_UNAVAILABLE,REPORT_EXPIRED` 등의 의미를 구분한다. 원문 snapshot을 새로 쓰거나 과거 보고를 READY로 승격하지 않는다. 증거의 격리/접근회수/해시불일치도 기존 방식으로 구분한다. 원형 무결성 실패와 현재성 미확인을 혼동하지 않는다.

## 7. UI와 이번에 열지 않는 소비
UI11의 별도 등록 정의 보고 구역에서 실제 보호 GET으로 고정 정의를 선택하고 tool 제품/버전을 대조해 원명령 준비→명시 저장→영수증/전용 고정조회로 연결한다. 환경null·사람주장·모든 실제능력 미확인/실행false를 표시한다. 기존 후보 보고 form/조회는 바꾸지 않고 App소유 frozen 원명령·UNKNOWN·저장후GET실패·문맥/늦은401 보호를 유지한다.

책임세션 활성화/새 임무 준비·FN14 실제 능력 판정·probe/test/LLM/CLI 실행에 이 보고를 자동 사용하지 않는다. 그 소비는 실제 증빙/정확 별도 계약이 필요한 후속이다. 전체 Agent 연결 기능 완료를 뜻하지 않는다.

## 8. 구현 전 필수 검수·실행 제외
현재 v1에 정의ref를 넣는404/kind409·environment null 거절을 명확한 기존 경계로 보존하고 v2의 정상/누락null·잘못정의/환경/도구·정책/제어·기한·승인제한·원문/증거격리·상한/동시원장·감사완결/replay/UNKNOWN·old/new namespace 혼동·실제React 저장/조회/늦은401을 검산한다. 기존 v1 단언/합격기준을 낮추지 않는다.

이 후보가 채택된 뒤 Main이 실제파일 allowlist/WI·TDD·독립검수·Main fresh·기존branch 게시를 고정한다. 코드·화면·미적용SQL·합성검증만 제안하며 실제DB/DDL/권한/키/파일조사/서비스/Agent·기존 프로젝트 차단해제는 제외한다. 현재 제품·SQL 쓰기0이며 채택 전 구현하지 않는다.

## r2 보완 — 재확인 순서·현재성 조합·지속 조회
첫 독립 검토 C0/I1의 부모 hash는 C633CFC058F805691709E320EC3157A4498B7D277130F82C63B71EA680422C1B다. 아래는 그 replay 보호 누락을 보정하고, 사용자/세션 교체 후 보고서를 다시 찾을 수 있도록 A의 같은 업무 안에 유한 목록을 구체화한 **Main 추가 제안**이다. 아직 채택/구현 승인이 아니다.

### 재확인과 fresh 저장의 분리
현재 재인증·유효 세션·현재 회원/OWNER/단독제어·정확세대·명시정책을 기존 r2 순서로 검사한 뒤 정확 원명령 replay와 원보고/영수증/감사/hash를 대조한다. replay에는 과거 보고 만료·현재 정의 head·fresh supersedes/증거·새 상한을 소급 적용하지 않고 원결과를 검산해 반환한다. 현재 접근 보호는 생략하지 않는다. 새 저장에만 fresh 기한·현재 head·도구/환경·원증거/관계·신규 상한을 적용하고 replay 신규산입0/불명 결과 보존을 유지한다.

### v2 currentnessIssues의 닫힌 조합
issue는 exact `{code,target}`이고 중복 조합은 없으며 원snapshot hash에 섞지 않는다. target은 null 또는 exact `{kind,ref}`다. 현재 v2의 환경null만 양성 경로이며 비null 환경의 실제 보호 producer는 미연결412로 남긴다. 이를 미래 환경 지원 완료로 미리 표시하지 않는다.

| code | target | 의미 |
|---|---|---|
| REGISTERED_DEFINITION_ONLY | null | 등록 설정 결박일 뿐 실제 도구·실측 증명 아님, 항상 표시 |
| HUMAN_CLAIM_UNVERIFIED | null | 사람 주장, 항상 표시 |
| ENVIRONMENT_NOT_DEFINED | null | 저장 claim.environmentRef가 명시null |
| CONNECTION_HEAD_CHANGED | `{kind:'CONNECTION_DEFINITION',ref:claim.connectionRef}` | 현재 head/fullref 불일치 또는 고정 정의 미존재 |
| CURRENTNESS_UNAVAILABLE | `{kind:'CONNECTION_DEFINITION',ref:claim.connectionRef}` 또는 `{kind:'ARTIFACT',ref:해당CapabilityArtifactRef}` | 해당 현재 보호원본의 조회/판정 불가, 원보고 무결성 실패의 대체값이 아님 |
| REPORT_EXPIRED | `{kind:'REPORT',ref:고정보고ref}` | 원expiresAt 만료 |
| EVIDENCE_UNAVAILABLE | `{kind:'ARTIFACT',ref:해당CapabilityArtifactRef}` | 원증거 소실/현재 접근 불가 |
| EVIDENCE_QUARANTINED | 같은 ARTIFACT target | 현재 격리 |
| EVIDENCE_HASH_MISMATCH | 같은 ARTIFACT target | 현재 원증거 bytes/hash 불일치 |

원보고/command/receipt/audit 자체의 무결성 실패는503으로 닫고 위 issue로 숨기지 않는다. 현재 회원 회수는 기존404 보호를 유지하고 역사 claim을 반환하지 않는다.

### 같은 업무의 유한 보고 목록·화면
기록이 Anvil에 남아도 원UUID를 잃으면 찾을 수 없는 흐름으로 끝내지 않도록 v2 전용 목록을 A에 함께 제안한다.
`GET /api/v1/projects/:projectId/definition-capability-reports?view=REGISTERED_DEFINITION_HUMAN_REPORTS&limit=20`.

- 정확 query는 고정view, 생략/20만 허용하는limit, 선택cursor(최대4096자), 선택connectionRef(최대2048자 canonical JSON exactVersionRef)다. 원문/자유검색·추가key·임의정렬은 받지 않는다.
- 현재 로그인/프로젝트 member 보호 아래 같은 project/선택정의ref의 행만 저장시각·id 역순으로 최대20개·keyset 조회한다. 기존 서명 cursor codec을 재사용해 actor/project/view/정확filter/limit/order/위치를 결박하고 다른조건 재사용을 거절한다. 새 키 생성/권한/실서비스는 실행하지 않는다.
- envelope exact6: `{items,hasMore,nextCursor,observedAt,effectiveForExecution:false,dispatchPerformed:false}`. item exact10: `{ref,connectionRef,environmentRef,tool,expiresAt,recordedAt,reportedBy,sourceAssurance:'HUMAN_CLAIM',bindingKind:'REGISTERED_DEFINITION_ONLY',integrity:'NOT_RECHECKED'}`. 목록은 원증거 bytes/실측/현재 능력을 검사했다고 표시하지 않는다. 선택 후 전용 고정GET에서 전체 무결성/현재성을 대조한다.
- UI11에서 등록 정의의 보호GET 성공 후 명시 ‘이 정의로 사람 보고 작성’으로 고정ref를 새 보고 초안에 전달할 수 있다. 기존 정의 원문/원명령은 수정하지 않는다. 별도 ‘등록 정의 사람 보고 이력’에서 전체/정의별 목록→보고선택→고정조회, 다음/이전과 실패한 동일cursor의 명시 재조회를 제공한다. 새 프로젝트/계정·세션/전송 문맥의 첫commit에서 옛 자료·늦은401을 폐기하고 자동POST/재전송은 하지 않는다.
- v1 후보보고 목록/GET/원형·책임세션/실행에는 확장하지 않는다. 새 전용 목록+고정GET+저장·조회 화면이 이번 A의 한 업무 단위이며 실제 연동/검증/배포 완료는 아니다.
