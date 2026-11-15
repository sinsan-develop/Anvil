# FN08 정상 START 재수신의 원 관측·ACK 복구

기준 main2e64c062522db41d162c8b1e77ee75f9ff14b2cc, branch codex/av3-fn08-start-replay-recovery. WORK_PLAN Stage C FN08 Windows 실행·중복 방지의 내부 미완료 연결이다. 기존 FN08_NORMAL_SEND_POLLING_SOURCE_20261115의 재시작 원 관측/ACK·cursor 규칙과 START 계약을 유지한다. Primary 단독 제품 writer, Main 기록·검수·통합, 독립 검수 읽기 전용.

## 누락과 구현

START polling은 receiveNormalStart의 자료 GET을 매번 먼저 수행한다. 응답이 내구 기록된 뒤 ACK가 유실되어도 다음 자료 GET이 실패하면 coordinator의 원 관측 복구까지 도달하지 못한다. SEND의 역사 우선 분기와 같은 목적을 기존 START 원장 계약으로 연결한다.

1. 현재 page item·credential·등록·봉투 context·receiptKey/envelopeHash·전체 descriptor와 descriptorHash를 검산하고 기존 intake #journal로 로컬 부분 bytes/순서/hash와 완전 수신 fullref를 확인한다. 새 page proof와 최초 proof는 발급 시점이 다를 수 있으나 다른 descriptor/등록/대상은 허용하지 않는다.
2. 시도 유무 판단과 복구는 기존 명령 잠금 안에서 처리한다. probe와 실행이 분리된다면 실행 시 동일 page/receipt를 다시 검산한다. 시도행의 receivedRef는 실제 완전 수신 ref와 전체 일치해야 한다. 시도 있음+수신 없음/불완전/불일치/손상은 UNKNOWN으로 보존하고 자료 GET·새 시도·permit·wire·위조 관측·cursor 이동0이다.
3. NONE/정상 PARTIAL+시도0은 기존 자료 GET 재개 경로를 유지한다. 완전 RECEIVED+시도0은 불필요 GET을 생략하되 최초 실행 전 startMaterials의 현재 시각·원문 전체 검산·current·permit 검사를 모두 유지한다.
4. 역사 RESPONSE_RECORDED는 원 ref/시각으로 기존 관측을 복구하고 추가 자료GET/permit/wire0이다. 불완전 시도는 기존 UNKNOWN 전환/관측을 유지하고 추가 실행0·cursor 유지다. UNKNOWN도 ACK됐다고 완료로 바꾸지 않는다.
5. 현재 grant/credential/서명/challenge 기한·회수 검사를 우회하지 않는다. 명시 갱신은 기존 같은 grant 계약만 사용하며 과거 permit을 현재 실행 권위로 사용하지 않는다. 원 필수 관측의 contiguous ACK coverage와 page 전체 완료 후에만 cursor를 전진한다. 유실/불명에서 자동 재시도하지 않는다.

## 제품 허용 4경로

- apps/connector/runtime/normal-start-intake.ts
- apps/connector/runtime/normal-start-coordinator.ts
- apps/connector/runtime/normal-start-polling.ts
- tests/unit/FN08/normal-start-polling-journey.test.ts

공유 코드베이스의 타인 변경을 되돌리지 않는다. 새 공개 API/SQL/저장 형상/권한을 만들지 않는다. 실제 DB·권한·키·파일 실자료 조사/설치·서비스·SDK/Agent·C#·P03 실행은 제외하고 RAM 포트만 사용한다. 추가 경로가 필요하면 Main에 정확한 이유/범위를 먼저 전달한다.

## 검증·인계

실제 제품 RAM 여정에서 응답 기록→서버 관측 COMMIT 뒤 ACK 응답유실→재시작/자료 GET 차단을 RED로 재현한다. 보완 후 추가 자료GET/permit/wire0, 원 event ref/시각 유지·서버 중복0·ACK coverage 뒤 cursor 전진을 확인한다. 수신 fullref 불일치·손상/불완전 시도·credential 만료/회수에는 cursor0/새 실행0을 확인한다. 기존 둘째 자료 GET 실패 fixture는 완전수신시 재GET 생략과 충돌하므로 둘째 descriptor/ref 불일치 주입으로 바꾸되 첫 원장 보존·둘째 실패·cursor0·재시작 wire1의 의미는 유지한다. 기대값 완화가 아니다.

직접 polling 여정과 영향 polling/coordinator/intake/START 여정 검사·typecheck·diffcheck, 실제 실행 세션 종단과 최종4지문을 보고한다. RED/GREEN과 fixture 변경 전후 의미를 명시하고 독립검수 뒤 통합한다. 실제 OS 내구성/SDK/Agent/DB·전체 FN08/계획 완료가 아니다. rollback은 4경로 한정 diff 역적용이다.
