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
