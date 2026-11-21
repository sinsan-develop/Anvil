# FN08 normal START 이전 원 준비 객체 재관측 — 결정 후보

상태: **미채택, 문서만 작성**. 기준 `2df6bd255af76657d40514f8f8c02a1b69e635d8`. 기존 FN07 SDK 생산자 WI §B의 선행을 좁힌 결과이며, 제품·시험·SQL·권한·실행안 변경이나 실제 실행 승인이 아니다.

## 1. 판정과 실제 근거

**원 준비 객체는 성공 반환 즉시 회수되지는 않지만, 현재의 짧은 원 host 수명을 넘어 사용할 수 없다. 기존 영수증만으로 START의 현재성 공급자를 조립할 수 없다.**

| 원 소스 | 확인한 사실 / 한계 |
|---|---|
| `apps/desktop/src/trust-enrollment-owner.cjs`, `returnNativePreparationOwnership` | 성공 시 `completed=true`로 즉시 `factory.close()`를 하지 않는다. `entry.retain(close)`가 같은 receiver에 정리를 결박한다. 원 host의 종료는 authority·permit·등록·credential 기한과 **최초 시각+10초**의 최솟값이다. 별도 Client.run 취소와 retained host의 수명은 구분된다. |
| 같은 파일, receiver `dispose` 및 `armDeadline` | receiver 종료·인증/문맥 상실·기한에서 retained cleanup을 호출한다. 보관된 receipt/JS 객체가 살아 있는 native handle을 보장하지 않는다. |
| `apps/connector/native/DesktopTrustKeyHostSource.cs`, `ReturnOwnership`/`RunAsync` | OPEN에서 한 번 만든 `retainedReturn`만 READ/SIGN에 쓴다. host finally는 `retainedFactory.Dispose()` 또는 원 `retainedReturn.Dispose()`를 수행한다. 새 host가 PID/JSON으로 원 객체를 회복하는 경로는 없다. |
| `apps/connector/native/NativePreparationRetainedFactorySource.cs`, `Create`/`Dispose` | 원 image→Job→startup→process를 한 번 생성·보유한다. 성공 직후 Dispose하지 않고 host 수명 종료에서 정리한다. 회수 불명 시 부모/image를 성공 폐쇄로 지우지 않는다. |
| `apps/connector/native/OwnershipEvidenceProcessOwnerSource.cs`, `ReadOriginalPreparedReturnSource`/`ReadSource`/`Dispose` | 원 ConditionalWeakTable에 등록된 객체만 읽고 process/thread/Job/image·시작 시각·기한을 다시 검산한다. Dispose는 원 process 종료 확인과 handle 폐쇄를 요구한다. 종료 불명은 UNKNOWN이며 PID 재열기 근거가 아니다. |
| 같은 파일, `ReadPreparedFactsSource` | `neverResumed=true`는 이 source에 Resume이 없었다는 **로컬 이력 후보**다. 외부 Resume/handle 복제 배제나 실제 suspended 상태의 증명이 아니라고 명시돼 있다. 이 한계를 새로운 증명으로 과장하지 않는다. |
| `apps/connector/native/NativePreparationOwnershipReturnSource.cs` | 서명 요청은 `BOOTSTRAP_PREPARED`, `expectedHeadRef:null`; facts는 PREPARED/everResumed=false만 허용한다. READ 전후의 원 객체 검산은 재사용할 내부 기초이지 새 purpose 서명 권한이 아니다. |
| `apps/server/modules/executions/native-preparation-ownership-return.ts` | 최초 요청/수용 사건은 BOOTSTRAP_PREPARED이고 반환 receipt는 `executionAuthorized:false`, `dispatchPerformed:false`다. 이 receipt는 최초 관측의 수용 증거다. |
| `contracts/runtime/ownership-observation-v1.ts:84` | 기존 CURRENT는 RUNNING/everResumed=true를 요구한다. 이 분기·기존 원장 해석은 변경하지 않는다. |

따라서 현재 source만으로 가능한 것은 **아직 유효한 같은 객체의 새 읽기 후보**다. 실제 OS 검증·물리 미재개 보증·normal 현재 fact의 권위까지 확보됐다고 볼 수 없다. 이 조사에서는 실제 handle 존재나 회수 성공을 관측하지 않았다.

## 2. START에서 막히는 정확 위치

- `normal-start-coordinator.ts::#current`는 START permit 전에 정확 envelope/key/grant/localAttempt/sourceObservationRefs/osOwnershipRef와 30초 이내 현재성·미만료를 요구한다. 공급자가 없으면 START_READY와 FIRST3에 도달하지 못한다.
- `native-proof-runtime-entry.mts::createOwnedSpoolController/assemble`는 외부 `input.current`를 요구한다. `normal-start-polling.ts`는 실제 current 공급자를 생성하지 않는 조합이고, 현재 제품에서 `createWorkerStartPolling`을 시작하는 구체 공급자는 연결되지 않았다.
- `normal-start-permit.ts::NormalPermitCurrentSource.observe`는 서버의 원 사실 생산자다. 부재 시 `EXECUTION_PERMIT_CURRENT_REQUIRED`다. 서버는 writer OWNED, source/OS 등 검사 VERIFIED_CURRENT를 별도로 요구한다. 준비 객체 관측 하나로 writer·파일 관측·정책·예산 사실을 만들어낼 수 없다.
- 기존 `SyntheticPgOwnershipCurrentResolver`/`SyntheticOwnershipFreshProducer`는 SYNTHETIC_ONLY 및 이미 SEND/permit에 결박한 CURRENT 흐름이다. normal 최초 START 이전 공급자로 전환하지 않는다.
- C §7의 permitSnapshot은 SEND permit **이후** 응답이다. 이를 START current의 원천으로 사용하면 순환한다. SDK child를 먼저 만들어 이 선행을 충족하는 것도 허용하지 않는다.

## 3. 최소 결정안: 별도 PRESPAWN 관측 목적

권장 결정 범위는 **첫 START 준비의 원 객체를 새로 재관측하고, 서버와 실행기가 같은 수용 증거를 사용하는 목적 한정 계약**이다. 아래 이름/형상은 후보이며 구현된 API가 아니다. 기존 CURRENT를 PREPARED까지 넓히거나 BOOTSTRAP 영수증의 checkedAt을 갱신하지 않는다.

### 요청·보고·수용

1. 원 실행기에서 START_ATTEMPTED를 기록한 뒤 서버에 `NORMAL_START_PRESPAWN_OBSERVATION` 요청을 명시한다. 새 목적은 START_SESSION/CONTEXT_REVIEW/전체 READ에만 한정한다. 원 installation/project/connector/execution·세대, registration fullref/키 지문, grant·credential 세대, START commandRef/envelopeHash, localAttemptRef, sourceObservationRefs 순서, 최초 authority/consume/ownership receipt·anchor/head/processRef를 exact 결박한다. 임의 PID·경로·argv·env는 받지 않는다.
2. 서버가 현재 권한·등록·grant·원 준비 수용과 head를 검산하고 일회 requestRef/nonce, requestedAt/expiresAt을 발급한다. 서명 바이트에는 protocol/purpose와 위 전체 결박, observer/host·worker 배포 신원, nonce 및 시간을 포함한다. 헤더 선택이나 caller의 `verified:true`는 권위가 아니다.
3. **같은 원 host와 원 factory 객체가 아직 살아 있을 때만** 새 purpose 전용 native 읽기/서명을 수행한다. 기존 원 process/thread/Job/image 재판독을 재사용하되, 읽기 전후 원 객체·peer·등록·기한·취소를 검사한다. 반환은 정확 원 processRef와 새 observedAt, 원 대상의 관측 사실 및 서명뿐이다. 기존 BOOTSTRAP 서명기로 purpose를 바꿔 서명하지 않는다.
4. 서버는 exact nonce/request/head/등록·서명·시간을 검산해 append-only 수용 증거를 만든다. 같은 packet의 명시 재확인은 원 결과만 반환하고, 변경 packet·다른 attempt·이미 소비한 nonce는 거절한다. 실행기 응답에는 원 수용 ref와 결박·시각·만료만 제공하며 자료 본문/credential/키/경로를 추가하지 않는다.
5. 실행기 `NormalStartCurrent`와 서버 `NormalPermitCurrentSource`는 **같은 수용 증거**를 다시 읽고 원 요청에 결박한다. permit은 기존 거래 밖 fact 호출→재거래 검산 순서를 유지한다. 현재 `FactScope`에는 localAttemptRef/osOwnershipRef가 없으므로 서버 내부 observe 입력에 원 검산 request의 해당 refs를 전달하거나, 명령별 단일 수용 증거를 조회한 뒤 permit 요청과 exact 대조하는 방식을 정해야 한다. 최신 한 건을 임의 선택하지 않는다.

### 반드시 별도 결정할 의미

- 이 새 증거가 증명하는 것은 **원 준비 객체의 현재 보유/신원**이다. 실제 RUNNING, Agent 시작, writer 확보, 파일 격리, 실행 완료나 STOP 권위가 아니다.
- 현재 permit의 osFence는 기존 실행 사실을 요구한다. 새 PRESPAWN 증거를 첫 START 준비에 한해 어떤 검사 의미로 수용할지 명시해야 한다. 단순히 기존 VERIFIED_CURRENT 문자열을 채워 넣는 내부 구현으로 처리할 수 없다. 기존 RUNNING CURRENT 검산·저장 이력은 그대로 보존한다.
- 제안하는 새 phase의 의미는 `PRESPAWN_RECHECK`: **같은 원 준비 객체가 요청 이후에도 원 보유자에게 있으며 원 설치·process/thread/Job 신원과 허용된 준비 상태가 현재 물리 근거로 확인됨**이다. 최초 BOOTSTRAP 사실이나 로컬 `everResumed=false`만으로 이 상태를 발급하지 않는다. 첫 START에 대한 `checks.osFence.state=VERIFIED_CURRENT`는 (1) 새 phase를 수용하는 목적 한정 정책이 채택됨, (2) 같은 원 객체의 실제 준비 상태 및 요구된 외부 재개/handle 간섭 배제 근거가 있음, (3) 위 exact nonce·서명·head·attempt·기한 수용이 정착됨, (4) 원 grant/등록/제어와 독립 writer 현재성이 유효함을 모두 만족할 때만 후보로 허용한다. 전체 sandbox나 source 상태는 이 phase가 증명하지 않으며 별도 원 생산자가 기존 `checks.source` 등 모든 필수 검사를 충족해야 한다. 하나라도 근거가 없으면 osFence를 VERIFIED_CURRENT로 올리지 않고 START/child 효과0을 유지한다. 현재 코드의 로컬 미재개 이력만으로는 (2)가 충족되지 않는다.
- 현재 source의 로컬 미재개 이력만으로 충분하다고 결정하지 않는다. 해당 목적이 실제 suspended 상태/외부 handle 간섭 배제를 요구한다면, 그 물리 증명의 생산자와 보호 조건을 먼저 확정해야 하며 부재하면 공급 불가다.
- normal credential의 현재 허용 경로는 commands/materials GET, permit/observations POST다. 기존 observations를 새 ownership 목적처럼 사용하지 않는다. 위 요청/보고의 목적 한정 전송·인증 대상, nonce 소비 및 append 저장형상은 **추가 계약/forward SQL 검토 대상**이다. 권장안은 기존 실행 challenge/signature primitive를 재사용하는 별도 닫힌 요청·보고 경로이며 실제 URL/operation은 채택 시 고정한다.
- 서버의 source 관측·writer 현재성 공급자도 독립 필수다. 이 후보 채택만으로 NormalPermitCurrentSource 전체 또는 SDK 생산자가 완성되지 않는다.

## 4. 수명·상한·회수

- 새 관측은 원 host의 남은 시간 안에서만 시작·완료한다. 원 host 최대10초/64frame, factory·receiver·authority·grant·credential 기한을 늘리지 않는다. 서명/응답 직전에도 wall 및 monotonic 잔여를 재검산한다. 새 요청 TTL은 최대10초와 모든 원 기한의 최솟값, permit 자체30초/current freshness30초는 상한일 뿐 새 생존시간을 부여하지 않는다. 서버 fact 호출의 기존2초 한도도 유지한다.
- 요청 최대16KiB, 보고 최대64KiB를 후보 상한으로 고정한다. 실제 frame의 기존 상한보다 큰 보고를 한 frame에 넣지 않는다. 기존 유계 분할을 채택할 경우 원 총량/hash/순서·잔여64frame 안에서만 사용하고 불가능하면 거절한다. 원 envelope의 기존2MiB 상한을 확대하거나 이 관측에 본문을 싣지 않는다.
- receiver 종료·기한·인증 상실·원 객체 회수·관측/서명/전송 불명은 새 관측/permit/SDK import/query/spawn 0이다. 실패를 정상 폐쇄로 바꾸지 않으며 원 handle의 정리 불명은 기존 소유 기록에 남긴다. 자동 재생성·기한 갱신·PID reopen·다른 host 승계 0이다.
- **이미 원 host/객체가 끝난 경우 이 안으로 복구할 수 없다.** 실제 사용자 순서가10초 창 안에 끝날 수 없으면, 준비 단계에서 원 객체를 별도 감독자에게 원자 인계하는 유한 보유 권위·endpoint·회수/정착 계약을 먼저 별도 결정해야 한다. 짧은 host를 붙들거나 영수증을 새 lease로 바꾸지 않는다. 새 준비 시도 역시 기존 단회/불명 정책과 별도 허가를 따른다.
- 최초 반환→사용자 START→새 관측→permit이 원10초 안에 끝날 수 있는지는 **미검증**이다. 이 문서는 성공 가능성을 전제하지 않는다. 잔여가 부족하면 요청 전에 거절하며, 긴 원 보유 단계의 별도 결정 없이 시간 상한을 늘리지 않는다.
- STOP CURRENT는 원 실행 child·stopScope의 별도 현재 관측이다. 이 pre-spawn 증거나 최초 준비 worker의 handle로 대체하지 않는다.

## 5. 채택 후 영향·검수·복구

| 구간 | 최소 영향 후보와 검수 |
|---|---|
| 원 보유 객체 | `OwnershipEvidenceProcessOwnerSource.cs`, `NativePreparationOwnershipReturnSource.cs`, `DesktopTrustKeyHostSource.cs`, `trust-enrollment-owner.cjs`: 같은 객체·원 peer·원10초 창, 폐쇄/만료/교차 객체/늦은 응답 거절. 기존 BOOTSTRAP과 정리 유지. |
| 전송 및 서버 수용 | 기존 native/normal credential·HTTPS/서명/요청 issuer와 ownership 원장 경로에 목적 전용 분기 필요. 정확 경로 목록은 채택 인터페이스에 맞춰 WI로 고정. 새 목적·nonce 소비·원 요청/수용 immutable 자료와 rollback reader 검토; 기존 SQL 수정0. |
| START 소비 | `normal-start-coordinator.ts`, `normal-start-permit.ts`, `native-proof-runtime-entry.mts` 및 원 worker 조립: 양측 same evidence/attempt, 거래 밖 관측, 다른 SEND/STOP 수용0, C snapshot 선행 사용0. |

최소 합성 수용: 살아 있는 같은 원 객체의 새 nonce 관측→서버 수용→양측 exact current; 최초 receipt만 제공/회수 뒤 호출/다른 installation·head·attempt·grant/nonce 재사용·변경 packet/만료·지연·회수 불명은 거절. 정상 BOOTSTRAP, 기존 RUNNING CURRENT 및 STOP 조건을 유지한다. source/writer 생산자가 없으면 최종 permit은 계속 거절한다.

실제 native handle/서명/OS·DB 거래·2초/10초 내 종단 시간과 SDK 실행은 별도 검증이다. 합성 성공을 이 증거로 승격하지 않는다. 채택 전 제품 변화0; 채택 후 rollback은 신규 목적 진입을 차단하고 기존 원장/수용 이력을 읽을 수 있게 보존하며, 진행 중 원 객체를 재발급하지 않는 방향으로 고정한다.

이번 산출물은 이 문서 한 개다. 제품·시험 실행·실환경 관측·자료 접근·Git 변경은 수행하지 않았다.

## 6. 제품 호출순서에서 먼저 확인해야 하는 선행

이 절은 PMO의 미채택 검토 뒤 확인한 소스 순서다. 전체 10초 성립이나 물리 증명은 여전히 미검증이다.

| 순서 | 실제 시작점과 보유 주체 | 확인된 선행 또는 단절 |
|---|---|---|
| 일반 개발 서버 시작 | package.json의 `start` → `apps/server/main.ts:23` | `buildApp`에 HTTPS·웹·일반 access만 전달한다. `app.ts`의 normal queue/credential/permit 등은 선택 주입이며 기본 시작점에서 그 생산자를 넘기지 않는다. |
| 최초 사용자의 시작 명령 제출 | `apps/server/modules/projects/routes.ts:375` → `NormalInitialExecution.command` | 기존 활성 `writer_claims` 부재와 별도 현재 관측을 먼저 확인한다. queue는 `writerState:NONE` 및 source·osFence·basis·storage·capability 등의 exact 증거를 요구한다. 이 관측의 실제 제품 공급자도 미연결이다. |
| 같은 준비 객체의 생성과 최초 관측 | 기존 receiver가 `returnNativePreparationOwnership`의 원 host를 연다 | 원 host 시계 시작부터 최대10초 또는 더 짧은 permit/등록/원 권위 기한이다. `NativePreparationRetainedFactorySource`가 자기 image/Job/process를 붙들고 최초 수용 결과를 반환하며, 원 receiver 또는 host 종료에서 회수한다. 이 객체는 증거용 준비 worker이며 향후 SDK child와 별개다. |
| normal grant·자격·writer 보관 | `normal-initial-execution.ts`의 현재성 확인 이후 같은 거래 | 실행·grant·자격 예약·writer `RESERVED`·명령 outbox를 보관한다. grant와 현재 실행 자격은 이 이전에는 사용할 수 없다. 이 저장은 Agent 시작으로 표시하지 않는다. |
| normal START 허가 | worker의 `NormalStartCurrent`와 서버 `NormalPermitCurrentSource` | 원 grant와 exact START attempt의 근거 및 `writerState:OWNED`를 다시 확인한다. 최초 queue의 `NONE`, 예약 `RESERVED`, 원 준비 worker의 최초 결과로 대신할 수 없다. |
| 실제 SDK child | 원 START_READY, 별도 첫 SEND permit, FIRST3 정착 이후 | 기존 준비 worker나 읽기 검산으로 실제 SDK child를 생성했다고 간주하지 않는다. 증거 없는 새 호출과 시간 연장은 없다. |

10초와 관련한 최소 연쇄는 같은 host의 준비·최초 서명, 기존 서버 수용, 사용자의 정상 START 접수, queue의 현재성/정책·grant/예약 처리, 실행기의 정상 자격·START 수신, exact attempt current 요청·서명·수용, 서버 permit이다. 기존 소스에는 최초 사용자 접수를 실제 준비 객체 생성 전에 확정하고 남은 단계가 자동으로 이어진다는 제품 호출선이 없다. 단계별 제한은 유한 정지 조건이며 단계 합계가 10초 안에 성립한다는 관측은 아니다. 기존 사용자 대기 위치를 바꾸거나 이전 클릭을 새 실행 허가로 넓히는 결정을 내리지 않았다. `queueExecutionCommand` 전후 writer의 상태 경계와 독립 source 현재성까지 실제 생산자를 확인하기 전에는 §3의 신규 API/보관 후보를 바로 채택 대상으로 올리지 않는다.

## 7. 사용자 의사 접수와 최초 queue의 경계

`6bdac930` 소스와 PMO·독립 검토를 대조한 미채택 보완이다. FN07의 제품 승인 범위인 FIRST3 이후 SDK child 감독과, 그 전에 보유하는 OwnershipEvidenceWorker의 권위 및 수거를 따로 결정한다.

1. **사용자 의사 접수.** 실행 요청의 정확 본문, 프로젝트, 현재 로그인·제어, 등록과 목적에 결박한다. 사용자 대기를 물리 객체 생성 앞으로 옮길 수 있는 후보이며, 이때 보관할 의사 형상·기한·취소는 미정이다. UI에는 접수만 표시한다. queue 등록·normal grant·실행 자격·writer는 이 단계에서 발급하지 않는다.
2. **최초 queue 확인.** 실제 포트는 `NormalExecutionCurrentSource.observe`다. 기존 `preparationRef`는 저장된 실행 준비와 Options를 가리킨다. queue가 native 최초 수용 영수증 자체를 조회하는 연결은 없다. queue 거래의 최초·후행 읽기 모두 실제 원 증거를 그 거래의 `transactionId`·원 요청 hash에 결박하고, 원 source·OS·정책 검사·writer `NONE`을 유지해야 한다. 의사 접수 당시 결과를 다른 거래의 현재 사실로 재사용하지 않는다.
3. **원 준비 객체와 기한.** 실제 OS 근거에 준비 객체가 필요하면 접수 이후 원 등록·목적·요청에 묶어 생성한다. 기존 HUMAN 정책·책임 예약은 queue의 grant보다 앞에 있고, normal grant·자격은 queue 정착에 뒤따르므로 새 준비 권위가 후행 grant나 normal writer를 선행조건으로 요구할 수 없다. 증거용 worker가 실행/자료 쓰기를 인수하지 않았음을 확인할 물리적 근거가 필요하다. 로컬 미재개 이력만으로 확인하지 않는다.
4. **START 이후.** queue가 정착 후 저장한 writer `RESERVED`와 START permit의 `OWNED`를 구분한다. 같은 START attempt의 준비 객체 관측과 독립 writer/source 현재 근거를 갖춘 경우에만 기존 permit, READY, 첫 SEND/FIRST3, SDK child 순서를 검토할 수 있다. 최초 SID 발급과 SDK child 실행 lease는 이 준비 객체 보유 계약과 별도다.

우선 비교할 두 방향은 다음과 같다. 둘 다 현재 제품에서 승인·실증된 경로는 없다.

| 방향 | 적용 조건과 결정 범위 |
|---|---|
| 기존 원 host 수명을 유지 | 사용자 준비 결정을 물리 생성 전에 끝내고 이후 단계가 기존 최대 10초 및 더 짧은 원 기한 안에 끝나는지 검증한다. 현재 증거는 단계별 중단 한도이며 전체 성공의 시간 근거가 없다. 선행 증거가 없거나 시간이 부족하면 queue 또는 START 시점에 거절한다. |
| 원 객체의 별도 감독 인계 | 10초 순서가 성립하지 않을 때만 별도 결정 후보가 된다. 원 객체와 원 handle을 같은 시도에서 한 번 인계하고, 독립 감독자의 확인·회수 책임과 좁은 목적 및 절대 기한을 고정해야 한다. 새 수치와 허용 보유 범위는 미정이다. 인계·종결 불명은 원 기록과 소유 상태를 보존하고 재인계·재생성·PID 재개방·자동 삭제를 하지 않는다. |

두 방향 모두 기존 관측 의미와 queue/permit의 거절 조건을 보존한다. PMO는 최초 준비 worker의 별도 감독 권위가 이미 채택됐다는 근거를 확인하지 못했다. 현재 단계의 판단은 순서와 검증 근거를 정하는 데 한정한다. 새 endpoint·SQL·권한 또는 실행의 채택 질문은 원 물리 보유 근거와 적정 수명, 별도 writer/source 생산자의 접점을 고정한 뒤에만 발행한다.
