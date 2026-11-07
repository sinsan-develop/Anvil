# FN09 원자료 등록 정책과 합성 START 정책의 인계 결정

상태 `DRAFT / NOT_ADOPTED / SOURCE_GO0`. 부모 [발급·전달 단계 후보](../contracts/FN09_ISSUANCE_DELIVERY_PHASES_ADDENDUM_CANDIDATE_20261107.md) §4의 A, SHA256 `D4DCBC7FF0655E1D4564DD90707B8C2F92F55EDDFB82655F6BD532F774411BDD`. 소스 기준 `10a12f1a`. B안과 실제 발급·전달은 이 결정의 범위 밖이다.

**결정 문장** — 원 START 원자료 S/Q와 등록 영수증을 그대로 보존하고, 후속 합성 START에 사람이 별도로 승인한 최신 정책 버전을 명시하여 같은 실행 ID·세대와 원 범위에서 기존 두 실행 규칙을 모두 통과할 때만 기존 합성 큐에 기록하도록 허용할까요?

## 1. 각 정책을 적용하는 자리

| 시점 | 검산하는 정책과 원자료 | 저장 및 반환 |
| --- | --- | --- |
| 최초 `registerExecutionStartOrigin` | 원 등록 명령과 현재 등록 규칙, 원 actor/Session/H/제어, WAITING 단계·할당·준비·역할 및 논리 세션, 원 보호 출처와 한도 | 기존 S의 `observedPolicyRef` 및 원 C/A/U/R, 원 Q, 원 절대 만료를 그대로 봉인한다. |
| 기존 보호 exact GET·목록·등록 replay | 기존 `readExecutionStartOrigins`와 원 보호 출처 조회. 원 등록 정책 fullref/hash는 원 저장 명령·권한 영수증·감사·정산과 검산한다. | 기존 역사 결과만 반환한다. 현재 START 가능 여부를 판정하거나 표시하지 않는다. |
| A 합성 START의 보호 source | 동일 actor·client·Session/H·제어, 동일 PoolClient/txid로 원 S/Q와 원 C/A/U/R를 검산한다. **현재 읽기 허용**과 WAITING/head·할당·준비·정의·환경·역할·논리 세션·맥락 및 한도 **fresh** 보호는 각각 다시 검사한다. | 원 자료와 현재 source가 같은 정확 refs 및 bytes인지 대조한다. 등록 시 정책의 과거 ref와 현재 source가 사용한 정책 ref가 달라도 이 사유만으로 거절하지 않는다. |
| A 합성 START의 두 runtime 검사 | 기존 START payload의 `permissionPolicyRef`에 명시 선택한 최신 fullref를 넣는다. 같은 Tx에서 기존 `authorizeRuntimePolicy`로 `authorizeExecution`과 `queueExecutionCommand` 각각을 검사한다. | 후속 command request hash 및 command/authorization receipt/audit의 기존 policy ref에 후속 ref를 결박한다. 기존 fact/grant/봉투에는 그 경로의 원 정책·영수증 관계를 유지한다. 새 원 origin 소비 표식은 기록하지 않는다. |

현재 코드의 `execution-start-origin-queue-basis.ts:130–180`에는 S의 등록 정책이 START 입력과 같아야 한다는 대조와 fresh source의 정책이 과거 S와 같아야 한다는 대조가 따로 있다. A 경로에서 두 대조의 **비교 대상만** 바꾼다. 첫 비교는 기존 queue의 실제 최신 runtime 검사에 맡기고, 두 번째는 같은 Tx에서 현재 읽기 정책과 fresh source가 관측한 최신 정책 및 전후 읽기 정책의 fullref를 비교한다. `execution-start-origin-sources.ts:64–82`의 기존 fresh 모드는 등록 규칙으로 source를 검증하므로, A용 내부 진입에서만 `readExecutionStartOrigins`를 쓰도록 목적을 고정한다. 등록용 `FRESH`와 기존 `HISTORY`는 그대로 유지한다. 이 진입은 기존 읽기 정책과 모든 fresh 출처 검사를 함께 실행한다. 과거 등록 명령을 수정하거나 START 명령을 등록 요청으로 재작성하지 않는다. 현재 등록 규칙의 존재는 새 원자료를 등록할 때 검사하고, 기존 S 사용에는 현재 보호 읽기·fresh 출처·두 runtime 규칙을 요구한다. 읽기·출처·runtime의 회수는 각각 fresh START 거절 사유다.

명시 후속 정책의 기존 표현은 `project-command.ts`의 `ExecutionRule`과 parser에 이미 있다. 합성 fixture에서 원 정책 P1을 보존한 채 같은 실행 ID·세대·sourceScopes·한도와 두 작업을 가진 P2의 현재 정책 행을 기존 실제 소비 경계에 제공한다. 정책 UI와 실제 정책 작성·권한 부여는 이번 구현에 추가하지 않는다. A 구현은 정책 자동 생성·갱신·권한 보충을 하지 않는다. `runtime-policy.ts:192–216`의 현재 정책 일치, 동일 HUMAN, 실행 범위·소스 포함 검사와 DENY 우선, 별도 승인이 필요한 경우의 기존 거절을 보존한다. A가 넘기는 입력은 원 S의 범위 전체이며, UI/호출자가 scope 일부를 지우거나 새로운 범위를 추가할 수 없다. 규칙의 범위 매칭 자체는 현 계약을 유지한다.

준비 reader의 추가 결박도 보존한다. `project-execution-preparations.ts:155–184`는 원 intent·snapshot/result/hash와 작성자를 검산하고 등록 준비에서는 보호 정의·환경과 원 Options를 재조회한다. `readStartOriginSources:72–96`는 fresh 초안·역할 head·맥락 metadata, 정의 및 환경 현재성을 추가한다. 준비 intent에는 permissionPolicyRef가 없고, 이 reader는 과거 준비 권한 ref를 현재 P2와 같다고 요구하지 않는다. 다만 그 하위 정의·환경 reader의 현재 보호 정책은 계속 적용한다. 원 P1의 당시 허가 수명은 저장된 S/Q expiresAt의 상한으로 남고, 현재 보호 정책·두 runtime 규칙의 P2 수명은 후속 호출에서 별도로 얻는다. 과거 정책을 재허가하거나 P1의 만료를 P2로 연장하지 않는다.

## 2. 원 자료와 큐의 접합

1. 내부 합성 조립은 기존 START 명령, 명시 S/Q fullref 및 합성 `BudgetUnits` 수요를 별도로 고정한다. 원 stage/assignment/preparation/context/role/logical binding, executionId 및 generation, 원 HUMAN H/제어를 대조한다. S/Q의 credential ID와 E1은 미발급 예약의 결박 검사에만 사용한다. queue의 기존 합성 grant/credential 식별자를 Q에서 승계하거나 Q를 발급 상태로 바꾸지 않는다.
2. 실제 basis 생산자가 exact13 준비에서 기존 exact11 intent를 만들고 원 한도로 claim을 검증한다. 원 Options bytes와 hash, 준비 ref 및 맥락 ref를 그대로 전달한다. 추가 ref를 공개 START 외피나 기존 `QueueBasis`에 넣지 않는다. A용 원자료 선택과 만료 관측은 **같은 큐 호출 안의 내부 전용 자료**로만 보관한다. 원 resolver의 기본 경로에는 적용하지 않는다.
3. 원 큐가 정책 두 작업·budget reservation·합성 current 포트를 소비한다. 기존 사실 검산에 더해 A 결합부는 합성 fact의 assignment/preparation, basis/최신 지시, 논리 세션·역할 바인딩, H/제어, 후속 정책 ref를 원 입력과 대조한다. 사실의 나머지 runtime 관측은 기존 명시 합성 포트에서만 얻는다. S/Q로 fact의 실제 관측이나 `VERIFIED_CURRENT`를 생성하지 않는다. 뒤늦은 정책/출처 결과를 받거나 다른 요청으로 바뀌면 원 호출의 자료를 반환하지 않는다.
4. 실행 큐의 유효 종료는 **원 S/Q expiresAt, 원·현재 Session/H/제어 검산, 현재 읽기·fresh 출처·예산, 두 runtime 규칙, 원 합성 fact의 제한 중 가장 짧은 값**이다. DB 절대 만료는 그대로 사용하고, DB 관측 전 단조 mark에서 잔여 시간을 고정해 await 중 수명 연장을 차단한다. 등록 때 원 기한이 더 짧았다면 최신 정책은 이를 연장할 수 없다. A용 기한은 큐의 private 호출 자료로 넘겨 기존 grant가 산출되기 전 permissionPolicy 기한의 상계로 반영한다. 최초 영속 쓰기 직전과 registrar 이후 반환 전 같은 Tx/시계·만료를 다시 대조하고 실패하면 원 Tx가 롤백한다. 이 검산은 실제 DB COMMIT 순간의 시간 보증과 구분한다.
5. 현 `currentProjectController` 프로젝트 잠금과 정책 head 잠금을 유지한다. 동일 executionId의 기존 행 검사 및 키, 원 command replay/hash와 material 완결 검산으로 합성 큐 중복만 차단한다. replay는 현재 큐 호출선에 남아 있는 fresh 보호/정책 검사를 우회하지 않는다. 원 등록 이력 보호 조회는 독립이다. 성공 시 같은 Tx에서 기존 START command/receipt/audit, 실행·합성 grant·usage reservation·writer claim·envelope, CONTEXT/OPTIONS 자료 및 `HELD_SYNTHETIC_ONLY` outbox를 정착한다. 결과 불명이면 자동 재명령·다른 정책/ID 선택·재전송 없이 원 명령을 보존한다.

## 3. 채택 이후에만 열리는 변경 후보

| 저장소 상대 경로 | 이유 |
| --- | --- |
| `apps/server/modules/executions/execution-start-origin-sources.ts` | A 전용 내부 fresh 보호 읽기 목적. 등록·역사 기본 호출 불변. |
| `apps/server/modules/executions/execution-start-origin-queue-basis.ts` | A 비교 대상과 원 S/Q·현재 보호·호출별 단조 종료의 내부 전달. 기존 exact basis와 기본 호출 불변. |
| `apps/server/modules/executions/execution-commands.ts` | 명시 A 합성 조립만 기존 queue에 연결하고 원 선택·current 및 원 만료 상계를 저장까지 소비. |
| `tests/unit/FN09/execution-start-origin-fixture.ts` | 실제 origin 저장과 정책 버전 전환·기존 queue 행을 같은 메모리 Tx 모델에 연결. |
| `tests/unit/FN09/execution-start-origin-queue-basis.test.ts` | 원 정책 불일치의 행동 RED에서 A의 실제 queue/material/outbox GREEN 및 음성. |

기존 runtime-policy, registrar, 권한/예산 파서, 명령 외피, 보호 조회 API, SQL, UI는 이 후보에서 변경할 필요가 없다. 운영 기본 큐에 합성 포트를 설치하지 않는다. 구현 지시 전 이 목록과 각 기준 지문을 따로 고정한다.

## 4. 인수할 메모리 여정

- **정상 및 원 RED.** 실제 origin 등록 서비스가 P1로 S/Q와 C/A/U/R를 저장한다. 합성 fixture가 원 executionId/세대·범위·한도와 두 작업을 가진 P2의 실제 저장 행 형태를 현재 정책 조회에 제공한다. 이를 실제 정책 명령 producer 검증이나 실제 권한 부여로 세지 않는다. 그 사이 S/Q와 원 등록 증빙 bytes/hash는 동일해야 한다. 실제 basis→`ProjectInitialExecutionQueue.command`→실제 registrar를 실행한다. 현재 소스에서는 P1/P2 대조에서 실패하고 A에서는 후속 명령의 ref/영수증은 P2, S/Q는 P1인 채 동일 실행의 기존 합성 저장이 끝나야 한다. 같은 Tx의 두 runtime 검사, 두 자료 그룹의 원 ref/bytes/hash와 대기 outbox, 실제 전달 및 실행 권위 false를 확인한다. 현재 사실 포트만 기존 방식의 명시 합성으로 공급한다.
- **교차 및 회수.** S↔Q 바꿔 끼움, actor/client/Session/H/제어·실행/세대·logical binding·원 scope/한도 교체, 후속 정책 stale, 두 작업 중 하나 누락·DENY, 보호 읽기나 출처 회수, 취소된 단계, 서로 다른 Tx, 후속 await 중 만료를 각각 효과 전 또는 원 Tx 롤백으로 검증한다. 보호 읽기가 유효한 기존 이력은 원 ref로 계속 검산하고, 읽기/출처 접근이 회수되면 본문을 반환하지 않는다.
- **중복 및 불명.** 동일 명령 replay의 추가 큐/자료/charge 0, 다른 명령의 동일 실행 ID와 동시 시도의 추가 저장 0, COMMIT 응답 유실 시 자동 새 명령 및 전달 0을 검증한다. 실제 PostgreSQL 잠금·정착은 미검증으로 기록한다.

이번 결정은 origin별 영속 소비 증빙·재발급 규칙, actual START/current/grant/E, 실제 권한·키·SDK·Agent·실제 DB와 서비스 실행, Native/HTTP 전송을 포함하지 않는다.
