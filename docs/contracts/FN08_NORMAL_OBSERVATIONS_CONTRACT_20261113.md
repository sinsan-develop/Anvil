# FN08 normal 실행 관측(observations) 계약 r1

상태: D1 A안 2단계(서버 source·합성 검증) 범위의 Main 기술 계약이다. 근거는 다음과 같다.
- `FN06_FN08_P3_NORMAL_TRANSPORT_DECISION_PACKET_20261113.md`(2026-11-13 채택)
- `FN06_FN08_EXECUTION_DISPATCH_PROPOSAL.md` §6의 `/observations` 행
- 합성 관측 정본: `apps/server/modules/executions/execution-observations.ts`, 0018

제안서 표에 있는 `/receipts`·`/heartbeat`는 합성 구현과 같이 관측 사건 종류로 받는다. 수신 상태(RECEIVED~UNKNOWN, STOP_*)와 HEARTBEAT가 여기에 해당한다. 실제 DB 적용·실제 Agent는 범위 밖이다.

## 1. 경로와 인증

`POST /api/v1/connectors/:cid/executions/:eid/observations`

- **인증**: permit과 같다. 실행 Bearer(`av3ex1_`), TLS, `Anvil-Execution-Auth` frame이 필요하다.
- **challenge**: 이 POST 경로, 빈 query, 본문 canonical hash에 결박된다.
- **본문**: 엄격 UTF-8 canonical JSON이고 1 MiB 이하다.

## 2. 본문

```ts
{ events: Event[1..200]; batchHash: string /* canonical(events) SHA256 */ }
Event = { projectId, executionId, executionGeneration, sequence(1..10000), eventId, type, commandId, envelopeHash,
          localRecordRef: Ref, processRef: Ref|null, occurredAt, reasonCode }
```

- **type·reasonCode**: 합성과 같은 목록이다.
- **사건 하나**: 64 KiB 이하다.
- **occurredAt**: 서버 시각+30초 이하다.
- **commandId·envelopeHash**: 이 실행·세대의 원 normal 명령과 같아야 한다.

## 3. 처리

공급자는 없다. 관측은 실행기의 주장이므로 거래는 한 번이다.

1. 인증·challenge·proof를 확인한다. 원 grant가 현재 유효하고 회수되지 않아야 한다.
2. 기존 관측 원장을 읽는다. 내용은 순번·사건 ID·hash 사슬과 ACK 요약이다.
3. 새 사건만 추가한다.
   - 같은 순번에 같은 사건이 이미 있으면 건너뛴다.
   - 같은 순번에 다른 사건이면 409 `EXECUTION_OBSERVATION_SEQUENCE_CONFLICT`다.
   - 같은 사건 ID가 다른 순번에 있으면 409다.
   - 실행 세대당 최대 10000건이다.
4. 추가한 사건이 있으면 ACK 버전을 하나 올린다. ACK는 연속 최고 순번·digest·빈칸·저장 수를 담는다.
5. 같은 거래에서 다음을 모두 기록하고, 확정 COMMIT 뒤 응답한다.
   - nonce 소비(v2)
   - `NORMAL_OBSERVATIONS` 영수증(그 시점 ACK 참조 포함)
   - 관측 행, ACK 행

관측 행의 snapshot 값:
- `transport:'NORMAL_PROTECTED'`
- `verification:'PROVIDER_CLAIM_ONLY'`
- `mode:'EXECUTION'`
- `credentialGeneration`: 현재 binding의 credential 세대

ACK의 `writerReleaseVerified`·`executionAuthorized`·`dispatchPerformed`는 모두 false다. STARTED·STOPPED·HEARTBEAT는 공급자 주장일 뿐 writer 회수나 업무 완료를 확정하지 않는다.

- **같은 packet 재조회**: 영수증에 남긴 **최초 ACK 버전**을 돌려준다. 이후 ACK가 진전했어도 마찬가지다.
- **다른 packet이 challenge를 재사용**: 409다.
- **COMMIT 불명**: 503 `EXECUTION_OBSERVATION_COMMIT_UNKNOWN`이고 자동 재시도는 없다.

응답(`no-store`):

```ts
{ transport:'NORMAL_PROTECTED', proofResultRef:Ref, ack:{ ref:Ref, snapshot:AckSummary },
  cacheControl:'no-store', nonceConsumed:true, executionAuthorized:false, dispatchPerformed:false }
```

## 4. 미적용 forward SQL(0090)

- `execution_observation_current`: normal grant이면 normal 현재성(`normal_exchange_current`)으로 판정한다. 합성 분기는 기존 본문 그대로다.
- **관측 표 trigger를 transport로 나눈다.**
  - SYNTHETIC: 기존 guard를 그대로 쓴다.
  - NORMAL: 새 guard를 둔다. 사건 형식, 원 normal 명령, credential 세대, 서버 marker를 검산한다.
  - 수정·삭제는 기존 guard가 거절한다.
  - 알 수 없는 transport는 CHECK(coalesce)로 막는다.
- **ACK guard**: 기존 본문을 그대로 쓰며, 위 현재성 함수 교체로 normal도 판정된다.
- **`NORMAL_OBSERVATIONS` 영수증**: 검사 함수와 trigger를 새로 둔다. 합성 영수증 trigger의 WHEN에서는 이 종류를 뺀다.
- **0089에서 옮겨 오는 함수**:
  - `normal_request_challenge_valid`: observations POST 대상을 추가한다.
  - `normal_command_consumption_valid`: 영수증 종류에 `NORMAL_OBSERVATIONS`를 추가한다.
  - 둘 다 바꾸는 곳만 다르다.
- `execution_observation_results`(합성 재조회 표)는 normal에서 쓰지 않는다.

## 5. 검증

- 실제 제품 START → credential → 관측 batch 저장 → ACK를 확인한다.
- 같은 packet 재조회는 최초 ACK를 돌려주고, 이후 batch에서 ACK가 진전하는지 확인한다.
- 다음을 거절한다.
  - 순번·ID 충돌, 다른 실행·명령·envelope, batchHash 불일치
  - 본문·경로·채널, challenge 교차 사용
  - 회수
- COMMIT 불명 뒤 재조회를 확인한다.
- 합성 관측 경로는 그대로인지 확인한다.
