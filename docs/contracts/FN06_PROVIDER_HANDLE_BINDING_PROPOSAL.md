# FN06 실제 공급자 세션 식별 연결 — 최소 계약 변경 제안

> 2026-10-22 후속 직접 승인: 신산님이 직전 권장 범위에 ‘네 의견대로 승인해’라고 답했다. 원 r2 SHA256 C9D972E7083C64F86B0BE56DC8BF74CD23B20107D0E329F52C16D2432D16E027을 A~C 코드·테스트·미적용 SQL 작성 기준으로 채택한다. 아래 DRAFT/NOT_ADOPTED·착수0은 승인 전 이력이다. 실제 DB 적용·보호 root/ACL/native helper·실 handle/credential·실Agent/비용은 이번 source 채택에서 제외한다. 원예약·기본 privacy 계약은 보존한다. 후속 구현·검증은 WORK_STATUS/WORK_PLAN을 따른다.

- 상태: `DRAFT / NOT_ADOPTED`. 기존 승인 계약·실제 허가를 대체하지 않는다.
- 2026-10-20 PMO 위임 결정: 원예약 불변·별도 제한 claim·thread/turn/현재성/OS소유 분리를 상세 설계의 권장 방향으로 확정했다. **상세설계 작성 진행만 허용**됐으며 아래 자료형/보호 정책·API/SQL·제품 구현은 아직 미채택이다.
- 일자/담당: 2026-10-20 / Project Main 어울.
- 목적: 프로젝트·책임·지식은 Anvil에 유지하면서 실제 공급자 세션으로 후속 지시를 정확히 전달한다. 설정 편집이나 공급자 응답 digest를 실제 연결 완료로 보고하지 않는다.
- 기준: 계획 FN06/FN08/FN09, INTERFACES §12.3. 현재 branch의 5283a2c2까지는 이 제안을 구현하지 않았다.

## 1. 확인된 미연결과 변경 필요성

1. primary codec/start transport는 공개 응답의 고정 사실·digest만 기록한다. digest에서 원 thread/turn 식별자를 복구할 수 없다.
2. `responsible-sessions.ts`의 생성·조회 검증은 `RESERVED`, `externalSessionHandleRef=null`, `CANDIDATE_ONLY`만 허용한다. 준비·결과 소비도 이 예약 계약을 사용한다.
3. 원 예약을 ACTIVE로 덮거나 문자열 handle을 사용자 입력/환경변수로 주입하면 정확 실행·세대/출처를 우회한다. 현재 구현은 그렇게 하지 않는다.
4. 그러므로 단순 UI 연결로 해결할 수 없으며, 보호된 공급자 식별 보관·서버 수신·조회 소비의 새 불변 연결 계약이 필요하다. 기존 예약/codec의 개인정보 비보관 계약을 몰래 바꾸지 않는다.

## 2. 권장 최소안 — 원 예약과 별개 연결 사실

- 원 `agent_sessions`/`role_bindings` 예약과 과거 receipt는 변경하지 않는다. 새 사실을 별도 불변 버전으로 연결한다.
- 서버 보관 후보: 정확 project/assignment/execution/generation, 책임 예약 ref, connection/environment ref, executor 등록 ref, START command/envelope hash, current/permit ref, 공급자 제품/정확 버전, 보호 handle ref, START 응답 digest, 관측 시각·출처/미검증 상태.
- 원 thread/turn·공급자 공개 응답 원문은 서버 일반 프로젝트 문서·로그·UI에 넣지 않는다. 실행기 소유 보호 저장소의 참조만 전달한다. 원문 접근·백업 포함 여부/보호/회수 수명은 채택 전에 확정해야 한다.
- thread와 turn은 별개다. thread 생성 사실을 turn 생성/지시 전달 성공·실행 소유로 승격하지 않는다. 다른 계정/도구/세대는 같은 외부 세션으로 자동 치환하지 않는다.
- 새 사실 상태는 `PROVIDER_CLAIM_RECORDED` 같은 제한 상태를 권장한다. ACTIVE/READY·현재 사용 가능 여부는 별도 current·허가·능력·원문/소유 검증 결과로만 계산하며 이 사실 저장만으로 true가 되지 않는다.
- 기존 `SYNTHETIC_ONLY` 자료를 실제 claim 저장·후속 실제 송신의 근거로 재사용하지 않는다. 합성 fixture는 별도 source-only 검증 범위에 한정한다.

## 3. 저장/조회·후속 지시 필수 조건

1. 실행기 인증/현재 등록·정확 project/execution/generation과 START 원장/허가/기한을 대조한다. 호출자가 준 handle·digest만 믿지 않는다.
2. 같은 START 원장 사건은 멱등 저장한다. 같은 사건의 다른 handle hash·다른 executor/세대·원문 변조는 충돌이며 덮기/새 turn 자동 발행을 하지 않는다.
3. 저장 불명·단절·부분 원장은 UNKNOWN으로 보존한다. 새 START로 복구하거나 실패를 PASS로 소급하지 않는다.
4. SEND/STOP은 예약 ref뿐 아니라 선택한 연결 사실의 정확 ref/hash와 현재 허가·소유를 다시 검사한다. 과거 연결 사실의 존재는 현재 권한이 아니다.
5. 회수·만료·Agent 교체 시 새 전달은 차단하고 과거 사실은 남긴다. 공급자 ACK/완료는 OS writer 회수·업무 검수 합격이 아니다.
6. UI04/UI05는 예약/공급자 식별 수신/현재 사용 가능성/실제 수행·검수의 상태를 분리한다. 원 handle 대신 Anvil ref와 비밀 없는 이유를 보여준다.

## 4. 채택 후 구현/검수 단위

- A: 보호 보관/claim 자료형·current/receipt 검증 및 충돌/유실 순수 TDD. 기존 원장/정책과 분리한다.
- B: 서버 불변 저장·전용 수신/조회·조회 소비의 forward 계약. 적용 전 정확 schema/연산·허가 주체/범위·보호 수명·rollback을 확정한다. 기존 SQL을 고치지 않는다.
- C: UI04/05 및 SEND/STOP의 정확 참조 소비. 예약-only 경로 회귀·교차 project/executor/세대/계정·변조·만료·회수·재시작을 확인한다.
- D: 별도로 허용된 환경에서만 실제 키/등록/DB·현재 소유·Agent·비용 경계를 확인한다. 순수/합성/fixture 성공을 실제 연결로 승격하지 않는다.
- 이번 문서는 A~D 실행 승인, DB 생성/적용, 보호 키/credential·OS/helper/socket·실제 Agent·유료 호출·서비스 복구/배포 승인이 아니다.

## 5. 필요한 정확 결정

- 권장 A안: 이 최소 방향을 상세 source 계약 작성·구현 기준으로 채택한다. 실제 지속 계약/적용은 B의 정확 diff·보호 수명을 다시 고정하며 기존 특정 거절·실행 안전 경계를 유지한다.
- B안: 현 digest-only/예약-only 계약을 유지한다. 새 실제 세션 후속 연결은 미연결로 명시하며 안전한 기존 범위 구현은 계속한다.
- 이 결정은 다음 작업 배정 요청이 아니다. Main이 구현 책임을 유지하고 PMO에는 이 계약 차이에 대한 결정·지원만 요청한다.

## 6. 상세 계약 r2 — 검토할 정확 후보

이 절의 수치·연산·경로는 모두 채택 후보다. 코드/TDD·schema/endpoint 생성 전에 이 절 전체의 계약 채택을 결정한다. 계획 전체 재승인을 요청하는 것이 아니다. 현재 제품/기존 helper/DB/정식 환경은 바꾸지 않았다.

### 6.1 자료형과 일관성

공통 `Ref={id:UUID,version:positiveInteger,contentHash:lowerHex64}`·canonical JSON·UTC ISO 규칙은 재사용한다. 추가 필드/타 프로젝트 ref·정수 범위 밖·잘못된 UTF-8/제어문자는 거절한다.

`ProviderSessionClaimV1`의 정확 필드:

```text
schemaVersion:1
claimId:UUID
kind:THREAD | TURN
projectId:UUID
assignmentRef:Ref
agentSessionRef:Ref
responsibleBindingRef:Ref
connectionRef:Ref
environmentRef:Ref
executorRegistrationRef:Ref
execution:{id:UUID,generation:positiveInteger}
commandId:UUID
envelopeHash:lowerHex64
authorizationReceiptRef:Ref
permitRef:Ref
localAttemptRef:Ref
provider:{product:CODEX_APP_SERVER,version:0.161.0}
parentThreadClaimRef:Ref | null
protectedHandleRef:Ref
source:{method:thread/start | turn/start | turn/steer,
        requestIdDigest:lowerHex64,responseRef:Ref,responsePayloadDigest:lowerHex64}
capturedAt:UTC
usableBefore:UTC
```

- THREAD은 parent=null/method=thread/start, TURN은 같은 project/예약/connection/environment/executor/execution/generation의 THREAD exact ref가 필수이며 method는 turn/start 또는 turn/steer다. source method와 실제 request/response 원장의 종류가 일치해야 한다. r1은 한 실행 세대의 연결만 다룬다. 다른 실행 세대의 기존 세션 재사용·재작업 재개/thread resume·다른 공급자·계정 이전은 후속 명시 연결 계약이 필요하며 이번 기능 완료로 숨기지 않는다.
- usableBefore는 capturedAt 이후 최대24시간이다. 이는 보관 자료의 최대 사용 후보 기한일 뿐 서버 grant/permit/현재 상태 기한을 연장하지 않는다. 최초 발급 당시 grant/nonce 기한과 **기록 수신 시점의 기한**을 검사하며 이후 실제 사용 기한은 매 요청의 현재 허가와 다시 교집합 계산한다.
- payload는 raw handle/본문/계정명·경로를 포함하지 않는다. snapshot의 claimRef는 전체 canonical hash다. 다른 claim이 같은 thread를 말해도 기존 것을 덮거나 같은 세션으로 자동 병합하지 않는다.
- `(projectId,execution.id,generation,commandId,kind,source.requestIdDigest)`가 중복 사건 키다. 같은 본문은 원 receipt, 다른 본문/보호 ref는 `PROVIDER_SESSION_CLAIM_CONFLICT`409다. payload로 actor/현재 권한을 선언할 수 없다.
- **비순환 결박 순서:** 먼저 §6.1의 전체 claim 필드 중 `protectedHandleRef`만 제외한 exact 객체 `bindingInput`을 고정한다(추가 필드0, source는 기존 provider 응답 fact의 ref/digest로서 이 claim을 참조하지 않는다). `bindingHash=SHA256(canonical({domain:'ANVIL_PROVIDER_HANDLE_BINDING_V1',bindingInput}))` → 원문 capsule/DPAPI entropy → ciphertextHash → `protectedHandleRef={id:claimId,version:1,contentHash:SHA256(canonical({format:'DPAPI_CURRENT_USER_V1',bindingHash,ciphertextHash}))}` → protectedHandleRef를 넣은 전체 claim hash/claimRef 순서다. 후행 protectedHandleRef·ciphertextHash·claimRef/서버receipt는 bindingInput에 넣지 않는다.
- claimId/bindingInput은 최초 capture 전에 로컬 불변 준비원장에 고정한다. 재시작/응답 유실 시 새 UUID/기한/암호문으로 같은 사건을 재구성하지 않는다. 원 암호문/원 claim을 재읽어 일치 확인할 수 없으면 UNKNOWN이다.

### 6.2 보호 위치·원문과 수명

| 항목 | 정확 제안 |
|---|---|
| Windows 신규 보호 root | `D:\Project\Anvil\.av3-data\provider-handles-v1`만. 기존 root/자격 파일을 재사용·개정하지 않는다. 생성·owner/ACL 설정은 제품 계약 채택과 별개 실행 경계에서 승인·확인 후만 한다. |
| 파일 이름/잠금 | `{claimId}.dpapi`와 `provider-handles.lock`. UUID만 파일명에 사용하고 caller 경로를 받지 않는다. 기존 전용 root의 실경로·비링크·소유/파일 정체성·배타 wx·유한 read/write/file.sync를 확인한다. 부분/남은 lock 자동 삭제0. |
| 원문 | canonical `{schemaVersion:1,bindingHash,threadId,turnId}` 최대4096바이트. THREAD turnId=null, TURN은 둘 다 고정 문법1~512자. 본문·응답 전체·account token/Secret은 넣지 않는다. |
| 암호화 | Windows DPAPI CurrentUser + 전체 bindingHash의 domain-separated entropy. 제품 전용 CNG/대칭 key는 새로 만들지 않는 안. OS 내부 master-key 처리/같은 사용자 악성 프로세스 내성은 보장하지 않는다. 기존 STORE_CREDENTIAL을 handle 저장으로 재사용하지 않는다. |
| 보호 ref | 암호문 최대8192바이트의 hash와 bindingHash·format/version만으로 불변 metadata ref를 만든다. raw handle의 사전식 hash를 공개 ref로 내보내지 않는다. |
| 허용 창 | usableBefore 최대24h; 각 SEND/STOP의 현재 허가·세대·소유를 다시 검사한다. 만료는 사용 차단이며 실제 Agent 종료/소유 회수는 아니다. 자동 연장·새 세션 자동 생성0. |
| 보관/정리 | 자동 삭제 OFF. 만료/회수는 사용 금지 상태로 보존, usableBefore 이후7일이면 사용자 명시 정리의 후보가 된다. 보관 수가512건 또는8MiB에 도달하면 새 capture를 차단하고 기존 것을 덮지 않는다. 물리 삭제는 정확 참조/의존·승인 후 개별 파일만, 서버의 비밀 없는 과거 claim은 보존한다. |
| 메모리/로그 | 원문은 고정 helper pipe→해당 adapter의 짧은 내부 scope에만 제공. command line/env·브라우저·오류/감사/관측 spool·일반 artifact·Git·일반 백업에 원문/암호문을 넣지 않는다. Buffer는 finally zero, JS 문자열/GC의 완전 소거는 보장하지 않음을 공개한다. |
| 백업/이전 | 일반 프로젝트 백업은 claim metadata와 `LOCAL_HANDLE_NOT_INCLUDED`만 포함한다. 새 PC/Windows 계정·OS 재설치 후 복호 불가는 UNAVAILABLE이다. 프로젝트·헌법·지식/작업 이력은 유지하고 기존 인계 절차로 새 공급자 세션을 별도 연결한다. 원 키/계정을 이동·교체하지 않는다. |

### 6.3 새 연산·주체/허가와 정확 API diff

- 공개 HUMAN 명령에 임의 `bind handle` 연산을 추가하지 않는다. 사용자는 원 handle을 붙여 넣거나 generic savePermissionPolicy로 claim을 만들 수 없다.
- 실행기 전용 새 후보: `POST /api/v1/connectors/:cid/executions/:eid/provider-session-claims`, JSON 정확 본문 `{claim:ProviderSessionClaimV1}` 최대16KiB. 실제 raw handle·파일경로·키/credential 발급은 없다.
- 기존 EXECUTION challenge/nonce/서명·method/path/query/bodyHash의 정확 target 검증을 재사용하되 **새 SESSION_CLAIM target 종류의 허용 목록 확장**이 필요하다. 기존 PERMIT/OBSERVATIONS 등에 끼워 넣지 않는다. RECOVERY credential·만료/회수 credential은 이 POST 불가다.
- 서버는 현재 executor/credential generation·grant·명령/envelope·permit/현재 control/authorization·정확 예약/임무/connection/environment를 DB에서 재조회하고 grant의 해당 기존 START/SEND command 범위와 permit에 결박된 localAttemptRef를 대조한다. 새 source.responseRef는 **실행기의 서명된 신규 주장**이지 서버에서 이미 검증한 원문 ref가 아니다. 서버는 고정 형식/사건·허가 결박과 서명을 검사하되 provider 원문·local ciphertext를 독립 재조회했다고 주장하지 않는다. response ref/digest는 보호 로컬 원장 재검증의 결과라는 실행기 주장이며 계속 PROVIDER_CLAIM_ONLY다. 기존 서버 근거/기한·형식 불일치면 거절, 합성 표식은 actual 저장 불가다. 이 저장만으로 실제 provider 진위/OS 소유/안전 송신 가능이 되지 않는다.
- 응답 정확 후보: `{claimRef,recordedAt,state:PROVIDER_CLAIM_RECORDED,sourceVerification:PROVIDER_CLAIM_ONLY,nonceConsumed:true,credentialIssued:false,executionAuthorized:false,dispatchPerformed:false,workAccepted:false}`. 서버 원자 저장/감사 성공 뒤 반환하며 raw handle·ciphertext가 없다.
- HUMAN 조회 후보: `GET /api/v1/projects/:pid/agent-sessions/:sid/provider-session-claims?limit=20&cursor=...`. 로그인+project membership 및 예약 조회 권한을 재사용하며 metadata만 유한20건(최대50) 반환한다. cursor는 project/session/filter/현재 actor 범위에 묶는 기존 signed-page codec의 별도 purpose를 쓴다. 원 handle 조회 endpoint는 만들지 않는다.
- **만료 후 원 결과 확인 전용:** 새 `GET /api/v1/projects/:pid/agent-sessions/:sid/provider-session-claim-receipt?executionId=UUID&generation=positiveInteger&commandId=UUID&kind=THREAD|TURN&requestIdDigest=hex64&claimHash=hex64`. 과거 실행기 credential/grant/nonce를 다시 쓰지 않고, 현재 유효한 Anvil HUMAN 로그인·해당 project OWNER 또는 현재 허가된 동일 책임예약 담당자의 조회 권한으로만 읽는다. 일반 project 조회자에게 자동 허용하지 않는다. pid/sid와 exact 사건 키·원 claimHash를 전부 대조해 `{found:boolean,receipt:ClaimReceipt|null,observedAt:UTC,historyOnly:true,executionAuthorized:false,dispatchPerformed:false}`를 반환한다. ClaimReceipt는 §6.3 POST 응답 전체다. 동일 사건의 다른 hash는409, 미발견은 found=false/receipt=null이며 당시 미저장/안전을 확정하지 않는다. 현재 로그인/조회권한이 없으면401/403이다. 이 GET은 저장·capture/nonce소비·기한 연장·등록/쓰기권한 회복0이고, UI에 보인 과거 receipt를 새 SEND 허가로 사용하지 않는다. 만료 뒤 새 POST로 우회하지 않는다.
- SOURCE-only 단계의 내부 `resolveProviderHandle(claimRef,commandContext)`는 고정 adapter의 SEND/STOP 직전만 소비한다. helper의 범용 원문 export/임의 경로/대화 도구 호출을 추가하지 않는다. 모든 context ref/hash·현재 command/허가/기한·THREAD/TURN parent를 대조하지 못하면 wire0이다. READ_CONTEXT는 별도 기존 허가가 있어야 하며 이 claim으로 권한을 만들지 않는다.
- `CREATE_PROVIDER_HANDLE`/`RESOLVE_PROVIDER_HANDLE` 보호 helper 연산은 기존 native/OS 실행 경계를 건드리는 **새 미채택 부분**이다. 구현·빌드·호출·키/credential/ACL/root 생성은 이번 설계 승인으로 실행하지 않는다.

### 6.4 새 지속 schema diff와 기존 소비

- 새 후보 파일명 `db/migrations/0030_provider_session_claims.sql.pending`(아직 생성/runner 등록/적용0). 거절된0029를 수정/재사용하지 않는다. 실제 채택 시 사용 중 파일명/runner의 마지막 순서를 재확인한 뒤 새 forward를 등록한다.
- 새 `anvil.provider_session_claims`: project_id/claim_id/version=1/content_hash/snapshot_json, execution_id/generation, command_id, kind, request_id_digest, agent_session_id, executor_id, recorded_at, receipt_id. `(project_id,claim_id)` 및 §6.1 중복 사건 키 UNIQUE. project/기존 명령·receipt의 project-scoped FK, snapshot/ref/원장 대조 guard, INSERT 전용·UPDATE/DELETE 금지다.
- 새 `anvil.provider_session_claim_revocations`: project_id/claim_id/revocation_id, 기존 회수 receipt ref·정확 근거/시각. append-only이며 원 claim을 ACTIVE/REVOKED로 덮지 않는다. 기존 실행/connector 회수의 이력을 그대로 재사용해 effective current를 계산하고 새 권한 회수 연산을 임의 추가하지 않는다.
- DB 연결 주체는 기존 Anvil service의 authenticated transaction이며 실행기/HUMAN에게 직접 SQL 권한을 주지 않는다. 새 DB 사용자/역할·일반 사용자 policy 자동 부여0, public DML 허용0이다. 새 테이블의 FK/불변 trigger/서버 nonce·현재 허가 검증을 함께 사용하며 application-owned DB의 같은 OS/DB 관리자에 대한 무결성 보장은 하지 않는다.
- 기존 agent_sessions/role_bindings/준비/결과 snapshot·원 receipt는 변경0. 새 소비 view에서 `reservationRef`, `providerClaimRef|null`, `availability:NOT_BOUND/UNVERIFIED/UNAVAILABLE`만 별도 표시한다. 최초 r1은 READY/ACTIVE를 반환하지 않는다.
- 소비 변경 후보는 primary codec의 명시 보호 capture port·START/SEND의 기록 단계, 새 서버 claim handler/정확 getter, UI04/05 metadata 조회다. generic codec 기본 동작은 digest-only 유지하고 opt-in 보호 port의 capture 성공만 별도 보관한다. 정규화 fact/로그/원 spool에 raw handle 추가0.
- capture는 고정 schema·정확 pending request/response id·context가 일치하는 **완성된 정상** thread/turn 응답만 받는다. 정상 프레임 분할은 기존 유한 codec에서 재조립하며 완성 전 capture0이다. 먼저 온 thread/turn 알림은 provisional 상태로만 보류하고 그 알림만으로 capture하지 않는다. 뒤의 정확 RPC 응답이 정상 재조립·pending 대조·provisional 해제를 마친 때 한 번만 capture한다. 선행 알림 단독/상충 응답/미완성 EOF/UNKNOWN·오류/예산 초과는 capture 성공이 아니며 후속 송신을 막는다. native 보호 저장·재읽기·hash 확인 불명이면 원 START를 재발행하지 않고 UNKNOWN으로 남긴다.

### 6.5 실패·위협·복구와 검수 기준

| 위험/상황 | 거절·보존·필수 검수 |
|---|---|
| 다른 project/실행/세대/계정·executor/parent ref 혼입 | 잠금·서버 current/receipt 재대조 뒤412/409, capture/전송0. 동일 문자열 handle도 새 신뢰 근거가 아니다. |
| 원문/암호문·파일 바꿔치기/링크·부분 sync | 정확 binding/cipher hash·파일 정체성 검사, UNKNOWN·원파일/lock 보존. 경로/ACL/OS 우회·자동 reset0. |
| 응답 유실/서버 저장 성공 뒤 본문 유실 | 같은 불변 claim/사건 키로만 receipt 확인; 새 START/SEND/새 handle 자동 생성0. |
| 만료/회수·예산/용량·현재 소유 미확인 | 후속 wire0·사용 불가 이유, 실제 Agent 중지/회수 성공으로 승격0. |
| 탈취한 실행기·동일 OS 사용자/메모리 dump | DPAPI만으로 해결한다고 주장하지 않는다. 외부 원문/공급자 진위·OS 소유의 한계를 명시하고 현재 grant/회수로 새 전달 차단, 노출 의심 blob은 일반 사용 제외한다. |
| 백업/로그·관측 원문 유출 | 테스트의 고정 raw 표식이 일반 오류/JSON/SQL 파라미터/metadata/spool·백업 manifest에 없는지 검사. 일반 백업에 blob을 넣지 않는다. |

- source 검수: 정확 자료형·정상/거절, default codec privacy·명시 capture, raw 미노출, scope/parent/중복·충돌/유실/기한, fake 보호 store 실패·재조회, 서버 메모리 transaction 조건을 신규 RED→GREEN으로 확인한다. fake signer/보호/DB는 actual 증거가 아니다.
- 실제 검수는 별도 정확 실행 승인이 있을 때만 전용 새 QA root/DPAPI helper·겹치지 않는 QA DB와 exact SHA에서 수행한다. 그 뒤에만 native/DB/서비스/Agent의 확인 범위를 각각 기록한다. 현재 r1은 이 자원들을 생성하지 않는다.
- rollback: 새 수신/소비를 일반 revert로 차단하고 raw 없는 과거 claim·봉인 blob을 보존한다. 이미 적용된 forward SQL을 DROP/down/이력 rewrite하지 않는다. 구버전은 새 claim 미인식→NOT_BOUND/UNAVAILABLE이며 원예약은 계속 읽힌다. 실제 미확인 writer가 있으면 구버전 배포로 안전 회수를 주장하지 않는다.

## 7. r1 결정 범위

### 2026-10-22 C2 metadata 목록·화면 source 상세 (부분 구현)

- 승인 §6.3 목록 GET을 현재 OWNER·동일 authenticated db/current 잠금에서 구현했다. 기본 limit20/최대50, `(recorded_at,claim_id)` 내림 keyset·정확 row/journal/예약 fullref·원 receipt를 대조한다. cursor는 기존 server signing key의 별도 provider-claim-history-page:v1 purpose와 현재 HUMAN user/client/session/credentialGeneration·project/예약/ref·filter에 결박하고 최초30초 이하 기한을 담는다. 로그인 idle 시각은 매 조회 현재성 gate로 재검사하되 cursor의 정체성 hash에서는 변동 checkedAt/expiresAt을 제외한다. 옛 cursor 기한을 늘리지 않고 만료는 거절한다. 신규key/권한/계정/로그인 계약 변경은 없다.
- 목록 응답은 projectId/agentSessionId/agentSessionRef, items의 exact query+원 receipt, hasMore/nextCursor/observedAt, historyOnly:true/availability:UNVERIFIED/executionAuthorized:false/dispatchPerformed:false다. 현재THREAD만 지원하고 TURN row를 발견하면 빈 목록 성공으로 숨기지 않고 거절한다. TURN 및 현재 RESPONSIBLE nonOWNER 실제 resolver는 후속 미완료로 유지한다. cursor가 인증/허가를 대신하지 않으며 인증 tx COMMIT 대기 뒤 최초 응답기한도 대조한다.
- UI04의 현재 책임 예약에 명시 목록 조회/선택 기록의 원 결과 확인 버튼을 연결했다. project/session fullref·현재 user/client와 조회 회차·unmount를 결박하고, 재조회/오류/이탈 때 기존 결과를 숨긴다. 원 handle 입력/노출·자동 polling·새 SEND/STOP/권한/작업완료 연산은 없다. RESERVED·공급자 주장 수신·현재 사용 가능성 미확인·실제 수행/업무 인수 미확인을 구분한다. 배포된 화면에서 사용 가능하다고 주장하지 않는다.
- 최종 직접28PASS1484.9436ms/type/diff0·UI build351, 가로챈 합성 Edge2PASS7.5초는 제한 source/DOM 증거다. 독립 정적C0/I0 이후 Main이 인증 idle갱신 cursor1RED를 추가해보완했다. 실제PG 정렬/경합/권한/COMMIT·정식 served/login/Agent는 미검증이다. 등록 QA root fn06-provider-history-c2-01 전체5항목만 exact정리하고 부재확인·기존자료/서비스/DB/권한/키0을 유지한다. rollback은 해당 source의 일반 revert이며 원 예약/claim/DB자료 삭제나 forward down은 하지 않는다.

### 2026-10-22 B6~B8 저장·HUMAN 조회 source 상세 (부분 구현)

- HUMAN 단일 receipt GET은 기존 Anvil 로그인 session/client/user와 project/member를 같은 authenticated transaction에서 다시 잠그고 현재 OWNER만 허용한다. serverOwner/createdBy/boundBy/reservedBy로 현재 책임자를 추정하지 않는다. 승인된 nonOWNER RESPONSIBLE 계약은 유지하되 현재 resolver 미구현으로 거절한다. 원 snapshot/hash/예약·명령을 대조하고, 현재 읽기 권한을 최종 확인한 후에만 hash 충돌409를 반환한다. 인증 transaction COMMIT/rollback 대기 뒤에도 최초 최소 응답기한을 검사한다. 전송 도중 회수와의 원자성 보장은 아니다.
- PG 수신 adapter는 기존 SyntheticPgPermitStore의 단일 연결/transaction을 사용한다. claim/result/audit를 메모리에 stage하고 원 signed nonce v2 소비가 끝난 후 정확 보호 함수 anvil.record_provider_session_claim(jsonb,jsonb,jsonb,text,jsonb) 한 번으로 flush한다. 새 claim3표에 app 직접 DML을 부여하지 않는다. 기존 challenge/receipt INSERT 권한은 이번에 축소/확장하지 않는다. 함수 응답/ref/현재 근거·최초 기한을 다시 확인하지 못하면 outer transaction 실패로 돌린다. 실제 COMMIT/PG 원자성은 합성 시험으로 증명하지 않는다.
- 미적용0037에 보호 함수 SECURITY DEFINER·고정 search_path=pg_catalog,anvil·PUBLIC EXECUTE 회수·app 정확 EXECUTE를 작성했다. 잠정 소유자 anvil_v3_provider_claim_writer는 실제 존재/준비 전제일 뿐 생성하지 않았다. NOLOGIN/NOINHERIT·관리/우회 속성0·신규 전용 역할·migrator 임시 ADMIN 회원1·다른 membership/소유/직접 ACL0 등을 preflight하고, 소유권 이전에 필요한 임시 schema CREATE와 membership을 같은 migration transaction에서 회수/후검사하도록 명시했다. 실제 준비와 효과는 미검증이며 migrator나 역할 전환으로 runtime 권한을 우회하지 않는다.
- writer는 고정 의존표 SELECT·claim/mapping/audit INSERT 및 실제 행 잠금에 필요한 기존 auth/project/member/control의 최소 key열 UPDATE만 요구한다. **key열 UPDATE는 실제 키 변경 능력과 무결성 위험을 수반하며 잠금 전용 무해 권한이 아니다.** 임시 CREATE·SET ROLE/membership/inheritance/PUBLIC 잔류와 실제 최소 권한 closure는 적용 전 별도 PG 검증 대상이다. source 명세가 실제 권한 부여 승인은 아니다.
- 신뢰경계: 서버 JS가 기존 ECDSA를 검증하고 DB에는 proofHash가 저장되는 application-owned DB 구조를 유지한다. 함수는 현재 grant/connector/registration/HUMAN/controller·원 START/permit/localAttempt·challenge/proof/nonce와 원 claim/receipt/감사를 대조하지만, 탈취한 app DB 자격으로 기존 증거 그래프 전체를 조작하는 공격에 대한 독립 DB 암호 검증을 주장하지 않는다. 새 key/crypto/extension은 없다.
- 직접 저장4·HUMAN store5·HTTP6의15PASS1591.9886ms/type/diff0은 합성 DB/Fastify.inject source 증거다. 함수/COMMIT 실패·응답 변조·최종 현재성 변경/만료·409 대기 만료를 포함한다. 독립 B8 C0/I1의 queryHash[] 충돌은 {}로 고쳤으며 ACL의 PUBLIC은 grantee0으로 검사하도록 보완해 두 변경에서 추가 C/I를 찾지 못했다. SQL SHA256 7FA12D2AD47764A7EE3E7E3FEA46ECEE1286BEE15C6F1291B499B708F3018418, 실제 SQL 구문/권한/역할 회수/경합/COMMIT 미검증으로 적용 준비 PASS가 아니다. B6/B7 독립 I2는 Main TDD 보완이며 독립 clean 판정으로 소급하지 않는다.
- 현재는 THREAD source만 연결했다. nonOWNER RESPONSIBLE·TURN·목록/UI caller·SEND/STOP 소비/native 보호·실Agent 및 전체 FN06은 미완료다. 실제 migration manifest 등록/DB/role/권한/서비스/Secret/Agent 변경0. 미적용 source의 rollback은 일반 revert이며 기존 DB/원자료에 DROP/down/자동삭제하지 않는다. 아래 최초 검토 요청/착수0 문구는 채택 전 이력이며 현재 source 상태는 본 절과 최신 WORK_STATUS를 따른다.

### 2026-10-22 채택 후 B 저장 상세 결정

- 부모 승인 r2 SHA256 C9D972E7083C64F86B0BE56DC8BF74CD23B20107D0E329F52C16D2432D16E027은 보존한다. PMO 위임 결정으로 claims/revocations 2표에 provider_session_claim_proof_results 보조표1개를 추가하는 source/시험/미적용 SQL 차이를 수용했다. 같은 사건의 새 유효 proofResultRef도 최초 claim/receipt로 결박해야 하므로 다대일 매핑이 필요하다. 기존 execution_receipts exact snapshot을 변경하거나 observation ACK 표를 오용하지 않는다.
- 실제 순서 대조에서 기존 최대0036이므로 예시0030 대신 신규 db/migrations/0037_provider_session_claims.sql.pending만 작성했다. 기존 migration/checksum/manifest 등록·실제 적용은 하지 않았다.
- 새 보조표는 project/execution/generation·proof/claim fullref·bodyHash/원 receipt를 결박하고 유일성·append-only·nonce/claim/감사 양방향 transaction 완결성을 요구한다. app/PUBLIC의 INSERT/UPDATE/DELETE를 기본 거절하며 새 사용자·실제 정책/권한 부여는 없다. 안전한 실제 adapter/보호 insert 연결과 PG 검증은 후속 미완료다.
- 독립 정적 검토의 challenge exact POST 경로 및 원 START digest 누락은 신규 forward에서만 보완했다. 구문·실제 canonical hash 동일성·권한/COMMIT/경합 검증을 수행하지 않았으므로 이 파일을 적용 준비 완료라고 부르지 않는다. 실제 SQL 적용 제외는 유지한다.
- rollback은 미적용 source의 일반 revert이며 실제 DROP/down/기존 SQL 수정은 없다. 이후 적용 승인은 별도 정확 대상·검증·복구 계획을 대조한다. 현재 서비스/Agent·native helper/보호 root/키·credential 생성0이다.


검토 요청은 §6의 **상세 source/데이터 계약 후보 채택 여부**다. 채택하더라도 실제 신규 보호root/ACL·helper/key/credential·DB 적용·서비스 복구·실Agent/비용은 각각 기존 별도 실행 경계로 남는다. 현재는 상세설계만 진행했고 A~C 제품 구현/TDD 착수0이다. 공개 endpoint/SQL 파일을 미리 만들거나 미채택 contract를 live manifest에 등록하지 않는다.
