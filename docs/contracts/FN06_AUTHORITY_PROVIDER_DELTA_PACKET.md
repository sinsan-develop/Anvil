# FN06 현재 권한 공급자 — 정확 delta 지원 패킷 v3

## 판정과 이번 요청
- 작성: 2026-10-23 / 책임: Project Main 어울. 기준 branch codex/av3-stage-b, source checkpoint bcd41e622f6d144affe4319c8a18d387e5b005a6. main f976ed5e29e14b13e12729d5b1ccf98f050f2210은 비교 기준일 뿐 변경 대상이 아니다.
- **현재 A의 합성 응답 증거와 metadata gate는 실행 권한 공급자가 아니다.** 실제 네 공급자와 source WRITE 격리가 없으므로 FN06 전체 미완료다.
- 이번 수행은 읽기 조사·설계/지원 패킷·독립 Stage B 구현 선정뿐이다. 아래 제안 저장소/표/API/operation/host는 **미생성·미적용·미승인 후보**다. 이번 문서가 이들을 승인하거나 바로 실행시키지 않는다.
- 권장 최소 결정: 먼저 §3의 D1 권위/데이터 계약 변경을 검토·결정한다. 실제 compile/run/OS/DB/Agent는 분리한 D2~D4의 exact source/hash·현재 상태를 동결한 후에만 요청한다. 지금 즉시 실행 승인 요청은 **0건**이다.

## 1. 현재 근거와 변경되는 의미
| 실제 근거 | 현재 의미 | 바꾸려는 부분 / 유지할 부분 |
|---|---|---|
| execution-grants.ts planSyntheticExecutionGrant | writerState=NONE·현재 fact를 읽는 SYNTHETIC_PLAN/false 권한 | 준비 전 상태와 실제 단독 writer 배정은 구별한다. process anchor만으로 writerState를 바꾸지 않는다. |
| execution-challenge-store.ts current/currentReadOnly | 실제 HUMAN/client/제어·정책/예산·grant 회수/host fingerprint 검사. OS/source는 저장 binding | 인증·회수·기한 유지. 응답은 currentReadOnly 필수/credential INSERT0. 실제 OS resolver는 별도 추가해야 한다. |
| execution-instruction-store.ts SyntheticInstructionQueueFacts | current/claim은 주입 포트, concrete 현재 OS resolver 없음 | 저장 fact를 새 현재로 복사하지 않는 concrete resolver 필요. 기존 큐/원 명령 재발행0. |
| execution-instruction-permits.ts | request.osOwnershipRef가 현재 fact osFence evidenceRefs의 원 fullref여야 함 | caller가 만든 새 anchor hash를 수용하지 않는다. 새 서버 채택 절차가 permit보다 앞서야 한다. |
| windows-host.ts / native/OwnershipHost.cs | 만료 고정 QA root/run/time·합성 worker만. OBSERVE는 retained Job/process handle과 image/start time 대조 | 원 QA 상수·검사를 바꿔 새 허가처럼 쓰지 않는다. 실제 Agent/stdin-out/file sandbox는 이 구현에 없다. |
| sent-process-evidence.ts / sent-process-metadata-gate.ts | 별도 anchor/사건 binding·일회 OBSERVE 상관·false 응답 조건 | SYNTHETIC_MATCHED는 현재 OWNED/VERIFIED_CURRENT·writer 해제/새 SEND 권한이 아니다. |
| DEVELOPMENT_ENVIRONMENT 최신 기록 | 10/22 정식 PG/API/Web exited, Windows3830/5546=0 | 이번 runtime 재관측/시작0. 과거46 migration·격리 PASS를 현재 실환경으로 승격하지 않는다. |

### 이번 읽기에서 얻은 source SHA256 (실행 결과가 아님)
- apps/connector/native/OwnershipHost.cs: 0A5DB92311D8FC3F0A6D0A5209C587BC3B78B6C559212341F06E3205472EEAEA
- apps/connector/runtime/windows-host.ts: D5D60D03C88CF23460723247BBCA29DCC4074A3373591BC663DC807BAC3E890B
- apps/server/modules/executions/execution-challenge-store.ts: DF73B8311F7CD1E421596312BBC57179BCCBA0323969A4DE2AD22F38EE7EC2B7
- apps/server/modules/executions/execution-instruction-permits.ts: 2E62C77B684624F232BF9D59A8372B71CE296C2F5D722F56D659FC0399603495
- apps/connector/runtime/sent-process-evidence.ts: EA10ABC3CADB80AEB7593A1A9A4D468C4B54B24AA07EC106A667453D4A24CD39
- apps/connector/runtime/sent-process-metadata-gate.ts: F385EC63803C887DB11E97D2DB76CFCF1DE8537CB945C530822F2D0BFBBF105A


## 1.1 D1 최종 단일 요청 묶음 (v2 묶음 유지·v3 초기 순서 보완)
**선택지는 'D1 source·미적용 forward SQL·API/권한 계약 구현만 승인' 또는 '현행 유지' 두 가지다.** D1 source와 DB/API를 별개 승인처럼 다시 나누지 않는다. 아래 구현을 한 묶음으로 검토받되 실제 환경에 적용/활성화하지 않는다.

포함: 정확5표와 guard/RLS의 **새 미적용 SQL 파일**, 새 schema/서명 바이트·권한/route 계약 및 서버/실행기 source, 신규 OwnershipEvidenceHost/Worker의 **source 작성만**, 합성 단위/route/서명 반례(기존 합성 시험 키만, 실제 등록키/파일/등록0), 타입/Web build·독립 검토·문서·기존 branch commit/push.
제외: SQL/DB 연결·migration 적용/seed/실정책 부여, C# compile/helper 호출/OS 프로세스·root/ACL, 실제키 사용·새키/credential·인증서, 서비스 시작/반영/Agent·비용·socket·Oracle/배포. D1 route는 기본 미등록·UNAVAILABLE이며 실제 권한 공급자가 없는 경우 fail-closed다.
D1에 포함한 보통 source 보완·동일 범위 합성/타입/Web 검사·정리/기존 branch 게시를 작은 업무마다 재승인 요청하지 않는다. D2~D4의 **실제 효과**와 기존 특정거절/별도 제외만 새 exact 판단 대상이다. 기존 ProviderHandle compile 미결을 D1로 해결했다고 하지 않는다.

### 정확한 5표 / key·불변·head·회수
명칭은 모두 anvil 스키마다. 아래 row에는 project_id,execution_id,execution_generation 및 exact ref JSON/hash·시간을 공통으로 둔다. 기존 표/적용 SQL은 바꾸지 않고 새 forward 번호는 실제 migration inventory와 충돌 검사 후 D1에서 발급한다. **아직 새 SQL 파일은 없다.**

| 표 | 기본/고유 키와 연결 | 보존·허용 효과 |
|---|---|---|
| execution_ownership_anchors | PK(project_id,anchor_id,version), version=1. UNIQUE(project_id,execution_id,execution_generation,anchor_id). scope/session/role/executor/observer fullref·full processRef·snapshot_json/content_hash. preparation_event_ref,adoption_event_ref를 events와 정확 역방향 결박 | anchor snapshot은 현 A의 불변 형식 유지·permit/selfref 없음. 유효 준비 권한 및 실제 관측의 채택 사건이 없으면 row 존재만으로 osFence 수용0. UPDATE/DELETE0. |
| execution_ownership_bindings | PK(project_id,binding_id,version), version=1. UNIQUE(project_id,execution_id,execution_generation,command_id,attempt_id,attempt_version,permit_id,permit_version). anchor fullref FK+원 command/envelope/parent/attempt/permit hash | permit 이후 원사건 별도 불변 기록. anchor를 바꾸거나 다른 permit으로 UPDATE0. |
| execution_ownership_heads | PK(project_id,execution_id,execution_generation). anchor_ref,head_generation>0,current_event_ref,revoked_at?,expires_at | 초기 생성1회·현재 event/ref/hash와 expected head_generation을 대조한 CAS만. head_generation은 반드시 +1, 이전 anchor/head 복귀·삭제/감소0. 회수 후 해당 generation 재활성화0. 새 실행 세대는 별도 현재 제어/실제 writer 회수 선행 없으면 생성0. |
| execution_ownership_observations | PK(project_id,observation_id,version), version=1. UNIQUE(project_id,request_id). request/event/anchor/head refs·nonce_digest·observer registration/fingerprint·서명·facts/hash·observed_at/expires_at | nonce/request는 같은 사건의 REQUESTED→OBSERVATION_ACCEPTED 소비1회와 원자 결박. archive 복사/과거 raw report 삽입0. 삭제/수정0, 실제 원문Secret/키 저장0. |
| execution_ownership_events | PK(project_id,event_id,version), version=1. UNIQUE(project_id,execution_id,execution_generation,sequence). previous_ref,kind,scope_hash,payload_hash,command/authorization_receipt/audit_ref·actor/client/registration_ref,at/expires_at. UNIQUE(project_id,request_id) WHERE kind=OBSERVATION_ACCEPTED | PREPARATION_GRANTED→ANCHOR_ADOPTED→BINDING_RECORDED, OBSERVATION_REQUESTED/OBSERVATION_ACCEPTED, REVOKED/EXPIRED/UNKNOWN의 불변 사건. request nonce 바이트/기한/서명 대상은 REQUESTED payload에 고정하고 accepted는 정확 requestRef 소비. 서명검증 전 ACCEPTED0. 별도 6번째 nonce표를 만들지 않는다. |

RLS/app 효과: 기존 anvil_v3_app만 대상으로5표 SELECT와 anchors/bindings/observations/events INSERT를 제안한다. heads는 지정5열 CAS UPDATE만 허용하고 identity/project/execution/gen 변경은 guard가 거절한다. append4표 UPDATE/DELETE와 모든표 DELETE·TRUNCATE는 금지한다. 현재 인증 사용자·client/session/제어 세대·project의 명시 정책/등록·command/허가/감사를 같은 tx에서 대조하는 BEFORE guard와 행별 RLS(ENABLE+FORCE)를 함께 둔다. 사용자 요청의 project_id나 자유 set_config 값만으로 허용하지 않는다. 직접 connector에 DB 권한/접속을 주지 않고 현재 인증된 서버 tx만 사용한다. table owner/migrator는 app과 분리된 기존 역할을 전제로 하되 실제 역할 적합은 D4 전 읽기 확인이 필요하다. 실제 GRANT/RLS 적용/새역할 생성은 D1에 없다.

### prepare / observe / revoke 권위와 선행
- 생성 주체: 현재 프로젝트 OWNER가 현재 HUMAN session/client·단독 제어 generation·등록 host ref/fingerprint·서명 주체를 고정해 prepareOwnershipAnchor 명령을 요청한다. server는 새 정확 operation의 명시 정책, 필요한 일회 승인 소비·최근 재인증, 같은 프로젝트/임무·선택 환경을 재검사한다. 정책/승인 자동 부여0이다.
- 준비 전용 authorization_receipt는 **새 준비 명령**의 current 권위이며 원 execution grant/permit이 아니다. events PREPARATION_GRANTED에 exact 대상 host/helper/합성 worker hashes·root ID·run/gen·지시한 행위 PREPARE/OBSERVE/CANCEL_PREPARED·최대수명120초를 고정한다. Agent/RESUME/SEND/파일WRITE/STOP/FORCE를 포함하지 않는다. future 실제 resume 시험은 D3의 별도 exact 범위다.
- 준비 전 전제: 프로젝트 현재 writer 없음(NONE)을 인증된 lease/실제 회수 원자료로 확인해야 한다. 기존 writer를 못 보거나 UNKNOWN이면 준비 거절한다. 준비 slot은 project당1개 CAS로 잠그며, '준비 slot 보유'를 actual writerState=OWNED로 쓰지 않는다.
- 관측 권위: OBSERVATION_REQUESTED는 아직 유효한 preparation receipt·현재 head/등록/HUMAN·단독제어 아래 서버가 생성한다. recordOwnershipObservation 보고는 같은 등록 host key·purpose/nonce/request/fullref/기한의 서명을 검증하고 원 request1회 소비 후 보관한다. 등록 status 조회 credential만 보유한 host는 보고 권한0이다.
- prepareOwnershipAnchor와 revokeOwnershipAnchor는 HUMAN 현재 명시 정책 대상, ownership observation 요청/수신은 해당 준비 receipt에 결박한 서버/connector 전용이며 범용 사용자/Agent 명령으로 노출하지 않는다. GET/SELECT도 현재 actor+프로젝트+scope policy를 적용해 다른 프로젝트 ID/건수 노출0이다.
- revokeOwnershipAnchor는 현재 OWNER의 정확 anchor/head generation·명령/필요 승인에만 허용한다. 만료는 원 deadline을 넘기는 순간 새 행동을 차단하며 EXPIRED 사건은 그 사실만 기록한다. 관측 실패는 UNKNOWN이다. 회수/만료/UNKNOWN 모두 실제 프로세스 종료·파일 WRITE 해제/새 writer 배정 증거가 아니다.

### osFence / writer / source는 세 가지 별도 근거
1. osFence: 유효 준비 receipt·등록 host/observer 서명과 원 nonce/request 소비, 원 anchor/head/revoke·full processRef·현재 Job/시작시각/image 관측이 모두 있어야 '해당 준비 process의 현재 소유 관측' 후보가 된다. PREPARED이면 PREPARED로만 보존하고 RUNNING으로 변경0. 현 A false 결과는 이 판정 원자료로 쓰지 않는다.
2. writer: 프로젝트 실행 단독 lease/세대와 현재 할당·전임 writer의 실제 회수 근거가 별도로 있어야 한다. process ownership만으로 NONE→OWNED/RECLAIMED를 만들지 않는다. P02/FN08의 actual writer resolver 부재·UNKNOWN이면 grant/SEND 전체는 계속 거절한다.
3. source: 정확 승인 sourceRoot/상대경로/READ·WRITE 범위와 현재 관측, WRITE면 OS/provider의 실제 격리·회수 근거가 필요하다. fileSandboxVerified=false인 현 helper는 이를 제공하지 않는다. source 격리가 없으면 WORK/WRITE 허용0이다.
새 observation으로 갱신할 수 있는 것은 그 원자료의 **osFence 후보 관측**뿐이다. 새 current fact 생성은 위3축과 HUMAN/정책/등록/예산/이해 등의 전체 검사를 모두 통과한 server resolver만 할 수 있다. 하나라도 없으면 UNVERIFIED/UNKNOWN·dispatch fail-closed를 유지한다. source 계약을 구현한 것과 실제 authority 활성화는 별개다.

### 기존 등록키 재사용의 source 근거 / 미확인
- registration-proof.ts는 P-256 SPKI와 SHA256/ieee-p1363 64바이트 서명을 검증한다. 따라서 암호 primitive 수준의 재사용 가능성만 확인했다.
- 같은 파일 proofBytes는 등록 전용 정확8필드(installationId/registrationId/scopeDigest/fingerprint/serverNonce/clientNonce/expiresAt/protocolVersion)만 받으며 purpose 필드가 없다. observation을 이 형식에 끼워 넣거나 기존 등록서명을 재사용하지 않는다.
- registration-protocol.ts의 실제 registration scope는 HOST_TRUST_REGISTRATION / credentialScope=REGISTRATION_STATUS_ONLY / grants=[]를 재검사한다. 이 신뢰 등록은 prepare/observe/Agent 권한이 아니다.
- D1 제안 observation signing bytes는 ASCII 'ANVIL_OWNERSHIP_OBSERVATION_V1' + NUL 1바이트(0x00) + canonical UTF-8 payload(installation/project/execution/gen/registration/observer/anchor/head/requestRef/nonce/factsHash/observedAt/expiresAt)다. 등록 proof·execution challenge와 교차 수용0의 반례를 포함한다. 원 키 등록 scope를 수정하지 않고 새 preparation receipt가 이 signing purpose의 권한을 정확히 한정한다.
- 실행기에서 기존 실제 개인키를 꺼내 목적별 서명할 수 있는지, 보호 host가 purpose allowlist를 집행하는지, 실제 키 접근이 승인돼 있는지는 **미확인/미구현**이다. D1은 기존 합성 시험 키로 source 검증만 하며 실제 키 조회/사용·새키 생성/회전·등록 변경0이다. 재사용 불가면 새키를 자동 만들지 않고 exact 지원 요청으로 남긴다.


### 최초 head가 없는 준비의 부트스트랩 순서 (v3 명확화)
- 최초 관측 전에 current head가 이미 있어야 한다고 요구하면 '관측→채택→head'와 순환한다. 최초 요청은 기존 준비 receipt와 project lock 아래 고정한 **후보 anchor hash**만 대상으로 하고 expectedHeadRef=null을 명시한다. 이 후보/request 사건은 채택/실행 권한이 아니다.
- BOOTSTRAP_PREPARED 요청: PREPARATION_GRANTED의 미소비 준비 slot·expected event sequence·head 부재를 같은 tx에서 확인하고 OBSERVATION_REQUESTED에 candidate anchor fullref/hash/processRef·preparationRef·phase/nonce/기한을 기록한다. caller 후보만 해시했다고 선택되지 않으며 서버가 고정한 이 원 request 사건과 답변을 대조한다.
- 초기 OBSERVE는 retained handle의 PREPARED/미재개 정체성만 확인한다. 정확 서명/nonce/기한·head 여전히 없음/준비 slot 미회수/동일 generation을 재검사한 tx에서 anchor+ANCHOR_ADOPTED 사건+최초 head를 원자 생성한다. 과정 중 변경/중복/만료면 모두 fail-closed/추가 프로세스 생성0이다.
- CURRENT 요청: 이미 채택된 anchor와 exact current head/event/generation을 대상으로 한다. source 후보 P2 서명 payload에는 phase=BOOTSTRAP_PREPARED 또는 CURRENT와 expectedHeadRef(null 또는 exact ref)를 반드시 포함해 두 용도를 교차 수용하지 않는다.
- 준비 slot은 project row lock+events의 단조 sequence/최신 준비 상태로 직렬화하며 새 6번째 표를 암묵적으로 만들지 않는다. 취소/만료/UNKNOWN도 append 사건으로 남기고 재준비는 실 프로세스/전임 writer 안전 근거 없이는 허용하지 않는다.
- 초기 PREPARED 관측·anchor 채택을 RUNNING·OWNED·VERIFIED_CURRENT로 올리지 않는다. 응답용 현재 evidence는 별도 CURRENT/RUNNING 관측 및 writer/source/HUMAN 등 독립 조건을 계속 요구한다. resume/Agent 실행은 D1/준비 receipt에 포함하지 않는다.
- 이 보완은 v2 D1 묶음의 초기 순서/서명 구분을 구체화한 제안이며 새 실제 효과 승인이 아니다. 10526ebd의 v2 원문은 Git에 보존한다. 사용자 결정은 PMO가 정확 버전/범위를 대조해 결박하며 Main이 D1 승인으로 추정하지 않는다.

## 2. 네 공급자의 위치·권위·인증·수명
아래는 권장 **새 계약**이며 지금 존재하는 저장 권위라고 주장하지 않는다.

| 공급자 | 실제 저장 위치 제안 / 현재 부재 | 권위자와 인증 경로 | 생성/읽기/회수·수명 / 새 영향 |
|---|---|---|---|
| P1 불변 anchor·원사건 binding·현재 head | 서버: 기존 WSL 개발 PG의 새 anvil.execution_ownership_anchors / bindings / heads / events. 실행기: 신규 D:\Project\Anvil\.av3-data\ownership-v1 아래 확인 대기 spool. 둘 다 해당 구조 미구현 | 서버 현재 HUMAN+project 단독 제어/정확 명시 정책·등록 host fullref/fingerprint. local 파일의 self hash만으로 서버 권위가 되지 않음 | 정확 준비 scope에서 append-only anchor, permit 후 별도 binding. head는 project/execution/gen 하나·CAS, revoke는 append event+단조 head generation. 보관 이력 자동 삭제0; 사용기한은 원 준비/등록/허가 중 최솟값. 새5표 중 events/heads 포함 새 forward migration·RLS/명시 app 권한 필요. local root/ACL·영속 쓰기도 새 실제 영향. |
| P2 별도 현재 OBSERVE | 실행 중인 신규 전용 ownership evidence helper의 retained Job/process handle. 결과를 서버 새 execution_ownership_observations에 불변 보관하는 후보 | 서버가 발급한 일회 requestRef/nonce/기한·scope에 현재 등록 host key가 서명. 서버에서 등록/회수/기한/원 anchor·observer binary fullref·request 소비를 검증 | archive 복사0. fresh requestedAt 이후 관측, 응답 최대30초/전체 timeout<=10000ms. 원 run/gen/job/pid/startTicks/image, root/자식 Job membership. replay/누락/회수/관측중 handle 상실=UNKNOWN. 새 서명 대상/nonce 소비/보고 API 의미와 DB 보관 필요. 기존 키 사용 가능 여부 미검증; 새 키가 필요하면 별도 결정. |
| P3 서버의 anchor 채택·현재 fact resolver | 앱 서버 executions 모듈의 신규 ownership-current-resolver.ts 후보; 위 PG 행과 검증 observation만 소비 | 동일 인증 transaction의 HUMAN/제어·policy/grant/budget·등록을 재검사. 서명 검증/원 request 1회 소비와 anchor/head/revoke를 같은 project lock 순서에서 확인 | anchor fullref를 permit 전에 선택. 응답 때도 현재 head/revoke와 새 관측을 대조. 현재의 stored grant binding 재사용만으로 VERIFIED_CURRENT를 만들지 않음. 새 public fact shape는 불필요할 수 있지만 osFence 권위의 **의미 변경**은 별도 결정 대상. source/check별 권위 분리. |
| P4 독립 response metadata resolver | 실행기 신규 sent-turn-observed-metadata.ts 후보; 실제 수신 자료/원 exclusive journal·보호 세션과 P3의 인증된 현재 결과를 조립 | 기존 원 attempt/permit/parent·수신 receipt/fullref/hash·독립 OS 관측·현재 서버 subject를 대조. caller/pre echo0 | threadId는 기존 보호 reader private callback만. 원 IDLE pre hash 불변·응답 BUSY/IDLE만. 만료/UNKNOWN은 중단, 새 permit/wire/회수 성공 생성0. 현 false metadata gate를 권위자로 대체하지 않고 공급자와 consumer를 분리. 실제 journal/보호 파일 내구 검증은 별도 필요. |

### API·정책 제안의 정확 경계
- 내부 port 상세화까지만이면 공개 endpoint·DB/실키 변화0이다. 현재 A가 허용한 범위는 여기에 머문다.
- 실제 서버 보고를 선택한다면 새 POST /api/v1/projects/:projectId/executions/:executionId/ownership-observations 후보와 준비/회수 명령 prepareOwnershipAnchor / revokeOwnershipAnchor, append binding 내부 연산을 따로 정의해야 한다. 지금 기존 route/operation에 몰래 연결하지 않는다.
- 각 요청은 project/execution/gen·host registration/observer fullref·원 anchor/head generation·requestRef/hash/nonce·기한·signature를 고정한다. 본문 path/임의 pid를 실행 대상으로 받지 않는다. 회원이므로 허용하거나 기존 upload 일회 승인을 재사용하지 않는다.
- 위 권한명·새 표·새 API의 계약 후보 확정이 D1이다. 승인 전 실제 schema 파일/route/정책 소비를 구현·적용하지 않는다. 파일명/숫자를 기존 0038 거절 대상으로 덮어쓰지 않는다.

## 3. 순서·단일 writer·비순환성
1. 현재 사용자/등록 host에 **준비 전용** 정확 scope를 부여하는 별도 계약부터 검증한다. 기존 grant/permit을 만들기 위해 미리 소유 프로세스가 필요하다는 순환을 새 implicit 허가로 풀지 않는다.
2. 새 유한 준비 권한 아래 합성 준비 프로세스를 suspended로 만들고 Job에 넣은 뒤, retained handle로 run/gen/job/pid/start/image를 얻는다. 이 단계의 CreateProcess 자체도 실제 OS 실행이며 D2~D3 전에는 수행0이다.
3. 별도 관측·인증 뒤 불변 anchor를 먼저 서버에 채택하고 acknowledgment/fullref를 실행기에 고정한다. ACK만으로 RUNNING·파일쓰기·writer 회수는 인증하지 않는다.
4. 프로젝트의 단독 writer/실제 source 권한은 **별도** 정책/OS 격리 근거로 확인한다. grant 계획의 NONE→배정→dispatch 현재 OWNED 조건을 process 소유와 혼동하지 않고, 동시 배정/회수와 같은 head/CAS 순서로 설계한다.
5. 그 뒤 원 command/permit에서 이미 채택된 anchor fullref만 참조한다. anchor는 아직 없는 permit을 포함하지 않는다. permit 확정 후 별도 사건 binding이 원 command/envelope/attempt/permit/parent와 anchor를 참조한다.
6. SEND 응답 검증은 새 request→현재 OBSERVE→서버 현재/회수→원 잠금 재검사 순서다. 락을 OS 대기 동안 무기한 유지하지 않는다. 짧은 기한 전후 head/등록/원자료를 재대조하고 충돌이면 UNKNOWN이다.
7. head/회수 generation은 단조 증가하고 과거 head 복귀/ABA 재사용0. PID가 같아도 startTicks/job/run/gen/hash가 다르면 거절한다. Job 관측 직후의 exit/새 자식 등 TOCTOU는 완전히 사라지지 않는다.
8. process membership·Job 제어와 filesystem/source WRITE sandbox는 동등하지 않다. 현재 helper의 fileSandboxVerified=false를 바꾸지 않는다. file WRITE가 필요한 실제 Agent 임무는 별도 sandbox·정확 경로/권한 회수 증거 없이는 허용하지 않는다.
9. revoke는 새 조회/dispatch 차단이지 이미 실행 중인 프로세스 종료 증거가 아니다. 정확 retained handle+정지/잔여0 확인 전 RECLAIMED/새 writer/재발행0이다.

## 4. 변경 파일과 단계 분리
| 단계 | 파일/변경 후보 | 포함 / 제외 |
|---|---|---|
| D0 현재 승인 조사 | 본 패킷·FN06_SENT_PROCESS_EVIDENCE·source map·WORK_STATUS, Stage B 실제 source 읽기 | 문서/읽기만. 새 authority/원자료 생성0. |
| D1 별도 의미·데이터 계약 결정 후 source | 신규 contracts/runtime/ownership-anchor-v1.ts, ownership-observation-v1.ts; server executions/ownership-current-resolver.ts, ownership-archive.ts; connector/runtime/ownership-evidence-client.ts, sent-turn-observed-metadata.ts; 해당 unit tests | 새 권위 port·서명 payload/head/CAS 모델. concrete source를 만들되 실제 권한 채택/실행0. 기존 execution-challenge-store·instruction-permit-basis/store에는 explicit current provider만 연결하는 최소 diff 후보. 현재 SYNTHETIC_ONLY 전체를 ACTUAL로 rename하지 않음. |
| D1 단일 묶음의 DB/API source | DATA_MODEL/INTERFACES/FILE_MAP, 새 미적용 forward SQL(번호 미발급), execution routes/등록 키 resolver·명시 정책 source | §1.1 D1 단일 결정의 일부. 기존 적용 SQL·0038 후보 수정/재시도0. 정식 DB 적용은 **D4** 별도, D3은 DB 없는 합성 OS 한정이다. |
| D2 source 동결 후 compile-only | 신규 apps/connector/native/OwnershipEvidenceHost.cs, tests용 OwnershipEvidenceWorker.cs와 해당 tests; build manifest | 기존 만료 OwnershipHost.cs는 보존. source commit/각 SHA·compiler/참조/산출물 exact 동결 뒤 컴파일만 새 결정. 현재 새 파일/완성 hash가 없으므로 **실행 가능 후보 아님**. 기존 ProviderHandle 3파일 compile-only 미결은 다른 대상이다. |
| D3 새 정확 합성 OS QA | 신규 helper와 합성 parent/child(각 최대1개), 신규 root/lease·기존 등록과 분리한 시험 서명/검증 경로(실키 미사용 우선) | 실제 OS 프로세스/root/ACL·스풀 임시 쓰기. DB 없이 OS 경계만 먼저 확인하는 최소 후보. 이 PASS도 실제 서버 권위/Agent PASS 아님. source/new hash 동결 전 실행 요청0. |
| D4 후속 DB/실 Agent | 정식 schema/API·등록/서버 채택→실 profile/stdin-out/sandbox→실 coding Agent | 각 실제 대상/기한/격리·비용/rollback을 별도 특정. 현재 이 패킷이 포괄 승인하지 않음. |

### 향후 D2~D3의 자원 후보 — 예약/생성/실행 아님
- host: 현재 Windows PC, 사용자 SINSAN\\cyhuh의 **신규 exact 시험 프로세스만**. 기존 Node/relay/DB/API/Web·임의 PID·WSL/ysna/Oracle 제외.
- 제안 신규 root: D:\tmp\anvil-v3-fn06-ownership-authority-qa-01. bin/AnvilOwnershipEvidenceHost.exe, bin/OwnedEvidenceWorker.exe, source/, results/, lease.json, receipts/만 후보로 열거한다. 현재 Test-Path=False 확인, 생성0. 부모 전체 realpath/link/owner/ACL은 아직 검사하지 않았으므로 생성 준비 PASS가 아니다.
- 새 실행기가 장기 쓸 root 후보 D:\Project\Anvil\.av3-data\ownership-v1은 현재 부재다. 부모 .av3-data는 Directory/nonlink metadata만 확인했고 ACL/보안 적합은 검사하지 않았다. D3 최소안에서는 이 장기 root를 만들지 않는다.
- compiler 후보: C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe. 기존 provider compile 후보의 hash468092…는 과거 읽기이며 이번 신규 후보 compiler 재검증으로 쓰지 않는다. 새 source/helper/worker bytehash·서명·인자·참조와 binary hash가 없으므로 **compile/run 승인 요청은 준비 안 됨**이다.
- 새 run UUID·issuedAt/expiresAt·host/source manifest를 실행 직전 동결해야 한다. 기존 10/17 lease/QA root/Job/PID 재사용0. 최대 수명10분, 준비 미시작5초/OBSERVE1회<=10초·전체 QA10분, 종료/정리 포함30분 상한 후보다.
- 실제 Agent/사용자 handle·계정/credential·유료 호출·network socket·정식 DB·서비스0을 D3 최소안으로 권장한다. 새 시험 키조차 생성하려면 별도 정확 항목으로 포함하고 자동 생성하지 않는다. 서명 검증 source만 확인할 수도 있으나 OS/등록 진위 인증으로 부르지 않는다.
- cleanup 후보: exact 생성소유 retained handle+start/image/job에 한정 정상 정지→Job/PID 잔여0→실행기 종료→등록 root만 비링크/소유/예상파일 확인 후 제거→독립 부재. FORCE/kill-on-close는 자동 fallback이 아니다. 정상 종료 불가면 UNKNOWN·범위/손실을 보고하고 별도 정지 권한 없이는 타 프로세스 kill/WSL/ACL 재설정0이다.
- rollback: D1 source는 해당 commit 일반 revert 후보(기존 지시 없이 실제 수행0). D2~D3는 생성한 시험 자원만 정리. D4 영속 이력은 삭제/downgrade 대신 새 회수/보완 migration을 별도 설계한다.

## 5. 기존 특정 거절과 새 경계
| 기존 경계 | 이번 처리 | 이 제안과의 차이 |
|---|---|---|
| 0038 특정 거절 | 원문/대상 보존, 재실행·새 이름 우회0 | 새 authority/head·등록/서명/실 OS가 기존 0038에서 허용됐다고 주장하지 않음. 새 SQL은 아직 만들지 않았고 옛 migration을 바꾸지 않음. |
| FN05 DD166F 새 원문 GET/위치 발견 | 미채택/거절 보존 | 네 공급자 제안에 지식 원문 getter·다른 프로젝트 자료 수집을 포함하지 않음. |
| ProviderHandle compile-only 미결 | 신규 판단 없이 compile/run0 | 대상 7ec147c의 ProviderHandle3파일은 ownership authority helper와 다르다. 한쪽 승인을 다른쪽에 전용0. |
| 만료 Ownership QA | 고정 source/lease 보존·호출0 | 새 유한 QA에는 새 source/hash/run/자원 exact가 필요. 기존 상수만 갱신하는 우회 금지. |
| 정식 서비스·DB 정지/복구 미결 | 시작/SQL접속/적용0 | 실제 서버 채택에 정식 DB가 필요해도 이전 단발 복구 승인을 재사용하지 않음. |

권장: **D0 패킷 검토 → D1 권위/데이터 delta 결정 → 승인된 source만 구현/독립 검토·동결 → D2 compile-only exact 요청 → D3 합성 OS exact 요청 → D4 필요한 실제 연결**. 모든 단계를 한 번의 '계속'으로 묶지 않는다.
대안: 실제 권위 공급자는 계속 미구현으로 두고 독립 기능을 진행한다. 이 대안은 FN06 완료나 전체 할 일 없음이 아니다.
금지 대안: false evidence 승격, pre 복사, 만료 QA/거절 runner 재사용, 필수 중지/권한/Secret/파일 감사를 생략한 실제 Agent.

## 6. Stage B 전체 잔여 대조와 독립 선정
현재 업무 등록부13행을 모두 대조했다. 아래는 bcd41e62 기준으로 조사한 소비 코드/등록부의 잔여 구분이며 전체 코드 전수감사나 실환경/사용자 인수가 아니다. 이후 선정한 FN05 보완의 실제 결과는 WORK_STATUS의 2026-10-23 D1 패킷 v2·FN05 기록을 따른다.

| 항목 | 확인한 source/이미 구현 | 남은 부분 / 이번 분류 |
|---|---|---|
| UI00 | shell/routes·same-origin/인증·미저장 상태 틀 | 실제 로그인/단절/재연결·기기 검수 미완료. FN06 OS와는 별개지만 정식서비스/인증 선행 필요. |
| UI01 | ProjectsPage+ProjectAccessSummary/PendingApprovals/AssignmentDrafts, 검색/cursor | 실제 실행단계·다음행동·담당자 metadata는 아직 연결 전. 기존 ProjectSummary에는 id/name/purpose/version/updatedAt뿐. 새 현재 단계 API 의미/서버 원자료 없이는 만들지 않는다. 목록 전체 완료 아님. |
| UI02 | 생성/기존 소스 사용자선언·버전/문서/방법론 선택 | 실제 source 관측/VERIFIED 기준선과 환경/총괄 연결·실여정 잔여. 선언을 검증된 소스로 승격0. |
| UI03 | MethodApplicationPanel의 prepare→write→정확ref 재조회/원 명령 보존, AppliedMethodOriginal/StoredNodeRoutes | 이미 있는 적용 코드를 재작성0. 실제 적용/DB/현재 실행상태 여정 미검증. |
| UI06 | 문서/계획·trace·시안 원문/소스 이력·detach | 최초 LINKED 생성·실제 관측 드리프트는 project-source-links.ts에서 제공하지 않음, source-links는 UNVERIFIED/20한정. 없는 직접ID GET/후속 cursor를 임의 추가하지 않음. 실제 추적/served 잔여. |
| UI10 | KnowledgePage·정정/제외·헌법 적용·기존 원문 선택 | 공유는 아직 요청/복사/사람결정 계약 보완 필요. 새 DD166F GET0. 실제 사용자 여정 잔여. |
| FN01 | 빈/선언 원자 생성·초안/소유/조회·정책 | 선언 이후 실파일 기준선 권위는 별도. 현재 서비스/DB/실여정 미검증. |
| FN02 | 공통/전용·그래프/검토/확정·적용 코드 | 실행 영향 있는 전환은 정확 근거 필요. 기존 구현을 새 업무로 재실행0. 실제 적용 검수 남음. |
| FN03 | 원문/후보/양식·검토/확정·충돌·source detach | 최초 source-link/실드리프트는 별도 권위/계약, served·DB 재조회 미검증. |
| FN04 | 고정 계획/업무·추적/변경요청·영향 이력 | 실제 변경 기준 적용→계획개정→재개 및 실행/시험 trace 미완료. 대상 명령/정책의 별도 계약 필요. |
| FN05 | buildTaskContext·ContextSourcePicker/7슬롯·선별·준비 저장·재사용까지 source 존재 | 실제 Agent 전달/이해·공유는 미완료. **선택 해제 handler가 렌더 시 index를 현재 sources에 splice하는 독립 입력 무결성 공백**을 이번 다음 구현으로 선정. OS/native/새API/DB 불필요. |
| FN11 | 일회 요청/결정/소비·현재 정책·여러 연산 연결 | buildTaskContext REQUIRE_APPROVAL 등 다른 연산은 문서상 미연결이며 새 계약 소비를 별도 결정. 현재 구현된 승인 흐름은 재작성0. |
| IX01 | 연결 단위의 과거 격리/부분 actual 증거 존재 | 등록부 시작 전·전체 실제 사용자 여정 미완료. 현재 정식 서비스/미적용 schema를 재개하는 새 정확 실행 판단 필요. FN06만의 동일 경계는 아님. |

### 바로 이어갈 독립 구현: FN05 맥락 출처 선택 해제
- 증거: WorkspaceContextPreparation의 '이 원문 선택 해제'는 slot.sources.map의 index를 캡처해 functional update의 **현재** 배열에 splice한다. 사이에 같은 슬롯 선택이 변경되면 다른 원문을 해제할 수 있다. 현재 pending/resultRef/uncertain 변화도 updater에서 다시 막아야 한다.
- 구현: context-source-selection.ts에 exact kind/fullref(지시에는 conversationId/messageRef 포함) 기반 순수 해제 helper, 현재 binding/owner/client/slot·pending/result/UNKNOWN 재검사, 원래 source가 없거나 중복이면 변경0. 다른 슬롯/이유/한도/원문 및 남은 선택 순서 유지.
- 파일: 기존 context-source-selection.ts, WorkspaceContextPreparation.tsx, 해당 tests/unit/FN05/context-source-selection.test.ts 또는 새 한정 removal 시험, WORK_STATUS/WORK_PLAN. 새로운 API/SQL/권한·Agent/native/실DB·리소스0.
- 검수: A/B에서 A가 먼저 빠진 뒤 B의 예전 handler가 다른 항목을 지우지 않음, 정확 fullref/같은 ID 다른 버전·슬롯 분리, pending/uncertain/result 전환 및 입력 이탈 무변경, 실제 기존 prepareContextWrite/server 입력 검사로 payload 보존. 직접 unit/handler·타입/build만 비례 확인. 실 DB/served는 미검증.
- 이는 새 기능 범위가 아니라 승인된 FN05 선별·UI 입력 보존의 빠진 무결성 조건이다. '모든 다음 항목이 같은 경계로 불가'라고 판단하지 않았다.
