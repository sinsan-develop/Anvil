# FN06 현재 metadata 원자료·소유 관측 경계

## 후속 source 보완 — 응답 예약 미생성

아래 표는 조사 당시 구현의 기록이다. 후속 source에서 기존 current는 유지하고 명시 currentReadOnly를 분리했다. 응답용 Bound 조회는 이 포트를 필수로 요구하며 PG 분기는 같은 현재 검사를 공유하되 정확히 존재하는 credential 예약만 읽는다. 부재 때 생성하지 않고 거절하며, 기존 current()를 읽기 전용으로 위장 호출하지 않는다. 실제 DB/OS 검증은 아직 없다.

PMO는 권장 A를 내부 SYNTHETIC_ONLY source 계약/소비·합성 반례 범위로 선택했다. OS 소유 기록과 command/permit 사건 결박을 분리해 원 osFence anchor의 fullref/hash를 보존하고 순환 self-hash를 만들지 않는다. 원 보관 fullref와 별도 일회 OBSERVE를 대조하는 상세 계약은 다음 선행이며 실제 보관/관측/서버 수용 포트 부재를 명시한다. 실제 권한·native/OS·등록/키/root/ACL·DB/Agent 실행 승인은 아니다.

- 기준: `codex/av3-stage-b`의 `d614956b92964049ee16ec898046868726a359fa` 이후 읽기 조사. 상태: **현재성 공급자 부분 구현 / 실제 OS 소유 관측 연결 미구현**.
- 이 문서는 기존 승인 source 조사와 결정 요청이다. 새 권한·공개 API·SQL/schema·실행·기존 거절을 해제하지 않는다.

## 기존 원자료와 실제로 확인하는 범위

| 원자료 / 코드 | 현재 확인 범위 | 현재 metadata에 그대로 채택할 수 없는 부분 |
|---|---|---|
| `apps/server/modules/executions/execution-challenge-store.ts`의 기존 tx current | DB의 현재 HUMAN/session/client, project/control·명시 정책/예산, grant 회수/만료, host key 결박을 같은 tx에서 재대조 | source/OS는 저장 grant binding이다. current는 credential 예약이 없으면 INSERT도 수행하므로 일반적인 읽기 전용 source로 오인하지 않는다. 이번 실제 DB 실행은 없다. |
| `execution-instruction-store.ts`의 current | 주입된 `SyntheticInstructionQueueFacts.current`를 소비 | concrete facts resolver는 조사한 제품 코드에서 발견되지 않았다. 저장 snapshot을 현재 fact로 복사하지 않는다. |
| `provider-send-current.ts`의 응답 전용 조회 | 위 계약의 basis와 원 THREAD/permit/소비 nonce·주체/기한을 결박 | 주입 fact/OS 제공자의 진위까지 새로 만들지 않는다. |
| `execution-material-receiver.ts`의 instructionSource | 기존 수신 부분/원 receipt/바이트·해시를 다시 읽는다 | 보관 자료의 일치가 OS 소유권·현재 쓰기 허가가 아니다. |
| `execution-observations.ts`와 observation store/spool | 원장 무결성·연속 ACK와 공급자 주장 저장/조회 | 모든 기록은 `PROVIDER_CLAIM_ONLY`, ACK는 `writerReleaseVerified:false`다. STARTED/HEARTBEAT/STOPPED를 현재 OWNED·회수 완료로 승격하지 않는다. |
| `runtime/windows-host.ts`의 `openOwnershipQaHost` / `native/OwnershipHost.cs` | 고정 QA의 Job/process identity와 OBSERVE 형식 구현 | 실행은 고정 2026-10-17 만료 lease·QA run/profile/path에 묶여 있다. 현재 프로젝트/Agent로 전용·자동 실행하지 않는다. `fileSandboxVerified:false`이며 process 관측을 파일 쓰기 격리 증명으로 쓰지 않는다. |
| `execution-instruction-client.ts`의 verifier | current/permitCurrent 소비 인터페이스 | concrete 구현/실제 OS 관측-서버 osFence evidenceRef 매핑은 발견되지 않았다. |

## 필요한 정확한 결정

권장 A: **내부 source 계약만 상세화**한다. 기존 `OwnedProcessRef`의 run/generation/job/PID/startTicks/executableHash와 현재 프로젝트/실행·세션/원시도·osFence evidenceRef를 어떤 보관 레코드와 독립 OBSERVE 결과로 대조할지 정한다. 기존 QA host를 전용하거나 새 호스트를 실행하지 않는다. OS 관측 부재·불일치·오래됨·중지/회수·다른 세대는 metadata 생성 실패로 남긴다. `fileSandboxVerified:false`로 자료 쓰기 격리를 인증하지 않는다. 이 계약 작성/소비 source와 합성 반례까지 먼저 진행하고 실제 host/native/등록·root/ACL·키·DB/Agent 실행은 별도 정확 범위로 유지한다.

대안 B: OS current 제공자는 미구현 상태로 보존하고, 이미 존재하는 서버/자료·보호세션 연결을 부분 구현으로 남긴 채 독립 승인 기능을 진행한다. 실제 Agent 연결 준비 완료는 주장하지 않는다.

금지 대안: pre snapshot 복사, 기존 provider 관측/QA 과거 PASS의 현재 OWNED 승격, 만료 QA lease·옛 PID/Job 재사용, 원장/검사 기준 완화는 선택지가 아니다.

현재 확인은 파일 읽기와 참조 검색뿐이다. 실제 OS/helper/native/서비스/DB/Agent 호출·권한 변경0이며, 이 조사 결과를 실제 소유 관측 PASS로 기록하지 않는다.
