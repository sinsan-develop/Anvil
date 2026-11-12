# FN08 normal START 일회 실행 허가(permit) 계약 r1

상태: D1 A안 2단계(서버 source·합성 검증) 범위의 Main 기술 계약. 근거는 `FN06_FN08_P3_NORMAL_TRANSPORT_DECISION_PACKET_20261113.md`(2026-11-13 채택)와 `FN06_FN08_EXECUTION_DISPATCH_PROPOSAL.md` §6(l.85-100)의 permit 행이다. 실제 DB 적용(1단계)·실제 키·실제 Agent 실행(4단계)은 범위 밖이다.

## 1. 경로와 인증

`POST /api/v1/connectors/:cid/executions/:eid/commands/:commandId/permit`

- **인증**: 실행 Bearer(`av3ex1_`), TLS, Host 단일 헤더, `Anvil-Execution-Auth` frame(EXECUTION_REQUEST challenge 참조·proof·서명)을 요구한다. 기존 명령 페이지·자료 GET과 같은 방식이다.
- **challenge**: 대상은 이 POST의 정확한 경로, 빈 query hash, **요청 본문 canonical hash**다. 명령 조회·자료용 challenge와 서로 바꿔 쓸 수 없다.
- **거절하는 헤더**: Cookie·Origin·CSRF·Content-Encoding·Transfer-Encoding, 중복 Content-Length.
- **본문**: `application/json`, 16 KiB 이하, 엄격 UTF-8, canonical JSON.

## 2. 요청 본문

합성 permit과 같다.

```ts
{ envelopeHash: string;            // 원 START envelope hash
  localAttemptRef: Ref;            // 실행기가 먼저 내구 기록한 시도 참조
  sourceObservationRefs: Ref[];    // 원 START sourceScopes의 observationRef(중복 제거, 순서 유지)와 정확히 같아야 함
  osOwnershipRef: Ref }            // 현재 실행 사실 osFence.evidenceRefs에 있어야 함
```

## 3. 현재 실행 사실

- 서버 조립 때 주입하는 `NormalPermitCurrentSource.observe(scope, signal)`가 현재 `ServerExecutionFactV1`을 공급한다. scope는 project·execution·세대·grant·명령이다. HTTP 입력으로는 이 사실을 받지 않는다.
- 공급자가 없으면 412 `EXECUTION_PERMIT_CURRENT_REQUIRED`다. 공급자는 2초 유한·abort로 호출한다.
- 맥락 묶음 공급자 보완(I1)과 같은 방식으로, 공급자는 **잠금·거래 밖**에서 부른다. 거래는 두 번이다.
  1. 첫 거래: 모든 인증·명령 검산 뒤 ROLLBACK한다.
  2. 공급자를 호출한다.
  3. 두 번째 거래: 처음부터 다시 검산하고 공급자 결과를 대조한 뒤 소비한다.
- 공급자 사실은 원 START grant binding과 같아야 하며, 확인 시각·검사·만료·writer만 다를 수 있다(0089 guard와 같은 규칙).
- 사실 검산 항목은 합성 permit `#current`와 같다.
  - writerState OWNED
  - understanding을 뺀 모든 검사 VERIFIED_CURRENT
  - checkedAt이 30초 이내
  - WORK이면 understanding 필요, CONTEXT_REVIEW이면 READ만 허용
  - 등록·실행기·예산·intent·sourceScopes가 원 START와 일치

## 4. 명령 결박

- 원 START 명령은 0083 normal 대기 명령이고 `NORMAL_PROTECTED`로 표시된다.
- 일치해야 하는 항목:
  - commandId
  - envelopeHash(요청과 저장값)
  - envelope의 context·executorRegistrationRef·payload
  - grant(현재 credential의 grant와 같고 회수되지 않음)
  - 실행 세대·credential 세대
- 기한: min(grant, envelope, 실행 사실 expires, challenge, 발급 시각+30초)이다. 이미 지났으면 거절한다.

## 5. 저장과 응답

같은 거래에서 다음을 모두 기록하고, 확정 COMMIT 뒤에만 응답한다.
- nonce 소비(challenge v2)
- `NORMAL_START_PERMIT` 영수증
- `execution_start_permits` 행

`execution_start_permits` snapshot의 내용:
- `state:'NORMAL_START_PERMITTED'`
- `executionAuthorized:true`: 이 permit 기한 안에서 이 명령의 시작 시도 **한 번**만 허가한다는 뜻이다.
- `dispatchPerformed:false`: 서버는 전송하지 않는다.

**실행 세대당 permit은 하나**다(기존 UNIQUE). 이미 permit이 있으면 다른 packet은 409, 같은 packet 재조회는 처음 결과로 수렴한다. COMMIT 결과가 불명이면 503 `EXECUTION_PERMIT_COMMIT_UNKNOWN`을 돌려주며, 자동 재발급은 하지 않는다.

응답(`Cache-Control: no-store`):

```ts
{ transport:'NORMAL_PROTECTED', proofResultRef:Ref, permit:{ ref:Ref, commandId, envelopeHash, issuedAt, expiresAt },
  cacheControl:'no-store', nonceConsumed:true, executionAuthorized:true, dispatchPerformed:false }
```

## 6. 미적용 forward SQL(0089)

0089는 아직 적용하지 않은 source이고, 실제 적용은 D1 1단계에 포함한다.
- `guard_execution_start_permit`: state로 분기한다.
  - SYNTHETIC: 기존 본문을 바꾸지 않는다.
  - NORMAL: normal grant 현재성, 0083 normal 명령, `NORMAL_START_PERMIT` 영수증, 같은 결박 규칙을 검사한다.
- `normal_request_challenge_valid`: permit POST 경로와 본문 hash를 허용한다.
- normal 소비 검증: 영수증 종류에 `NORMAL_START_PERMIT`을 추가한다.
- 앞선 migration 정의를 옮겨 오는 경우, 바꾸는 곳만 한 곳씩 다르게 한다.

## 7. 범위 밖

실제 OS 소유·파일 관측 공급자 구현, 실행기 쪽 permit 클라이언트·adapter 전송, receipts·observations·heartbeat(다음 단위), 실제 DB·키·Agent.

## 8. 검증

- 실제 제품 START → credential → permit 합성 여정을 확인한다.
- 같은 packet 재조회·동시 요청이 수렴하고 두 번째 permit은 거절된다.
- 다음을 거절한다.
  - 다른 경로·본문·query, 다른 명령·세대·grant, 명령 조회용 challenge 재사용
  - 공급자 없음·무응답·사실 불일치(writer·검사·osFence·source)
  - 기한 경과, 회수
- 공급자는 거래 밖에서만 불린다.
- 합성 permit 경로는 그대로다.
