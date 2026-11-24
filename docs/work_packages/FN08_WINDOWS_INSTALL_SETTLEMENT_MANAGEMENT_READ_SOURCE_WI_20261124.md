# FN08 Windows 보호 설치 정착 관리 읽기 Source WorkInstruction

- 문서 상태: `SOURCE_WORK_INSTRUCTION_DRAFT_FOR_MAIN_REVIEW`
- 작성 기준: 2026-11-24
- 기준 commit: `fd1a4e195635c9a176bbf893d7bb87d959a1b45e`
- 부모 계약: `docs/work_packages/FN08_WINDOWS_INSTALL_SETTLEMENT_SOURCE_WI_20261124.md`
- 목적: 기존 신뢰 등록 관리 화면에서 사용자가 현재 단일 `OFFERED` 명령을 다시 확인한 뒤, 설치와 분리된 읽기 한 번으로 같은 `REGISTERED`/pinned native host의 보호 설치 정착 사실을 조회한다.
- 비목적: 설치·재설치·복구·실행, 과거 요청 성공 복원, public HUMAN API·role·key·DB 추가, `RequireDurability()` 또는 실제 Windows 지원 gate 개방

## 1. 결정과 현재 기준선

최신 PMO 결정 범위 안에서 Main이 구체화할 A안 후보는 legacy `INSTALL_WORKER` 관리 동선의 현재 `OFFERED` 선택을 재사용하되 설치 action과 읽기 action을 분리한다. 호출되지 않는 `installNormalStartWorker()`와 `READ_NORMAL_START_WORKER_IMAGE_V1`은 이번 경로에 섞지 않는다.

현재 제품의 설치 호출은 다음과 같다.

```text
settings 명시 설치
→ trust-act / INSTALL_WORKER
→ trust-enrollment-owner의 현재 단일 offer 재조회
→ native-worker-installation-coordinator.install
→ pinned host INSTALL_WORKER
→ NativeWorkerDeploymentSource.Install
→ NativeWorkerInstallationStoreSource.Install
```

새 읽기는 같은 화면·현재 offer·등록 owner를 사용하지만 별도 action이다.

```text
settings 명시 정착 확인
→ trust-act / READ_WORKER_INSTALLATION_SETTLEMENT
→ 현재 단일 offer 재조회와 동일성 확인
→ coordinator.readManagementSettlement
→ pinned host READ_WORKER_INSTALLATION_SETTLEMENT_V1
→ deployment management read
→ store restart settlement read-only classifier
```

두 호출은 서로의 결과를 자동 소비하지 않는다. 읽기 전에 설치하지 않고, 읽기 실패·부재·불명 뒤에도 설치·재시도·복구를 자동 시작하지 않는다. 기존 `INSTALL_WORKER`의 입력, effect 표시, 응답, one-shot, unknown 처리는 그대로 유지한다.

## 2. 세 identity와 단일 선택

다음 세 UUID는 서로 다른 의미이며 같다고 추정하거나 대체하지 않는다.

| 이름 | 생성·소유 | 용도 |
|---|---|---|
| `readRequestId` | renderer가 명시 읽기 클릭 때 새로 생성 | IPC replay와 늦은 응답 폐기. marker 조회 key나 과거 설치 request가 아님 |
| `registrationAttemptId` | 현재 `REGISTERED` 원장 row | 현재 등록·key·root·epoch 결박. settlement attempt가 아님 |
| `settlementAttemptId` | 원 명시 설치 클릭의 `installRequestId`를 그대로 기록 | `ACTIVE`와 `INSTALLATION_SETTLED` 두 row의 동일 attempt 결박. 별도 UUID, 승인·실행 token이 아님 |

`settlementAttemptId`는 해당 marker를 만든 최초 `installRequestId`의 exact 보존값이다. 별도 `installRequestId` 필드를 중복 저장하거나 새 settlement UUID를 만들지 않는다. `readRequestId`와 `registrationAttemptId`로 대체할 수 없다.

renderer는 ref·factory·root·hash를 입력하지 않는다. Main owner가 현재 `ShellReceiveOwner`에서 exact 하나의 offer를 다시 읽고 다음 원 facts를 native까지 전달한다.

```text
offerRef
commandId
commandHash
factoryRef = offer.snapshot.command.payload.nativeFactoryRef
registrationAttemptId
registrationRecordHash
```

위 여섯 필드가 management read native wire의 exact selection 입력 전부다. JS는 root identity를 공급하지 않는다. `contextEpoch`는 현재 프로세스의 owner/transport/view 현재성 검사에만 사용한다. marker가 원 설치 당시 epoch를 이력으로 보존할 수는 있지만, 재시작 뒤 같은 값이라고 가정하거나 selector hash에 넣지 않는다. native host는 authenticated `WorkerRecord()`와 원 pinned root에서 `registrationRootIdentity`를 독립 파생·재검산한 뒤 아래 persistent canonical object의 SHA-256을 `managementSelectionHash`로 계산한다.

```json
{
  "schemaVersion": 1,
  "purpose": "NATIVE_WORKER_INSTALLATION_MANAGEMENT_SELECTION_V1",
  "registrationAttemptId": "<uuid>",
  "registrationRecordHash": "<sha256>",
  "registrationRootIdentity": "<native root identity>",
  "offerRef": {"id":"<uuid>","version":1,"contentHash":"<sha256>"},
  "commandId": "<uuid>",
  "commandHash": "<sha256>",
  "factoryRef": {"id":"<uuid>","version":1,"contentHash":"<sha256>"}
}
```

JS가 root identity나 최종 hash를 주장하지 않는다. 부모 marker의 기존 `attemptId`는 원 `installRequestId`를 그대로 기록하며 이 문서에서는 의미를 설명할 때만 `settlementAttemptId`라고 부른다. marker writer는 같은 host에서 계산한 `managementSelectionHash`를 `ACTIVE`와 final row에 함께 기록한다. read-only classifier는 exact hash가 같은 marker attempt 하나만 선택한다.

## 3. read/write source의 공동 결박

부모 WI의 marker model에는 다음 내부 필드 하나만 추가한다.

```text
managementSelectionHash
```

- `ACTIVE`와 `INSTALLATION_SETTLED`는 기존 `attemptId`와 새 `managementSelectionHash`가 exact 동일해야 한다.
- 기존 marker row의 `attemptId`가 기존 `INSTALL_WORKER`의 원 renderer `installRequestId`다. 이 문서의 `settlementAttemptId`는 그 의미를 가리키는 변수명일 뿐 별도 row 필드가 아니다.
- final row는 부모 WI의 container/previous/installation/descriptor/worker identity 검산을 모두 통과해야 한다.
- catalogue header·sequence·previous hash·모든 row·끝 경계가 완전하고 부모 WI의 marker 검산을 모두 통과한 complete valid catalogue에서 동일 selection hash의 final marker가 exact 0건일 때만 `NO_MATCHING_SETTLEMENT`다.
- 기존 root에 expected catalogue/marker가 없거나 catalogue가 누락·partial이면 `NO_MATCHING_SETTLEMENT`가 아니라 `OUTCOME_UNKNOWN`이다. worker/marker namespace 자체가 미구성인 `UNSUPPORTED`와도 구분한다.
- 동일 selection hash의 attempt가 둘 이상이거나 ACTIVE/final pair, settlement attempt, container, identity 중 하나라도 충돌하면 `OUTCOME_UNKNOWN`이다. 최신 하나를 임의 선택하지 않는다.
- 다른 offer, command, factory, registration attempt/record/root의 marker는 후보가 아니며 존재 여부나 수를 renderer에 노출하지 않는다. 프로세스 재시작으로 달라질 수 있는 current epoch만으로 과거 marker를 탈락시키거나 선택하지 않는다.

marker writer와 reader를 같은 legacy management caller에 결박해야 하는 이유는 명확하다. reader만 추가하면 marker가 현재 offer에서 파생됐음을 증명할 수 없고, writer만 추가하면 dead persistent data가 된다. 두 source가 같은 persistent canonical selection hash를 독립 계산하고 원 install request를 `settlementAttemptId`로 보존해야 현재 artifact와 과거 요청 `UNKNOWN`을 분리할 수 있다.

## 4. 읽기 권위와 effect 금지선

명시 읽기는 다음을 모두 만족해야 한다.

1. 화면의 current `trustView`가 같은 `REGISTERED` attempt/epoch다.
2. `receiveView.phase`가 `OFFERED`이고 exact `offerRef`, `commandId`, `commandHash`가 하나다.
3. Main이 offer를 원 서버 source에서 다시 읽고 메모리 원본과 canonical 동일성을 확인한다.
4. offer가 만료되지 않았고 command가 기존 `prepareNativeBoundary`, 같은 project, exact factory다.
5. 현재 등록 row·key·credential·사람 확인과 pinned channel/root가 기존 설치 caller와 같은 검산을 통과한다.
6. native management read는 installation root를 `create:false`로만 연다. root·marker·worker를 만들거나 `Fresh`를 발급하지 않는다.
7. 기존 `createTrustOperation`이 pinned host open/close 관측을 위해 사용하는 `lease.markEffect()`는 같은 host 종류·권한·수명 안에서 그대로 재사용한다. 이 관측 effect를 설치 mutation, queue, key 사용, sign, POST, recovery effect와 동일시하지 않는다.
8. management read는 설치 mutation·queue·key effect를 만들지 않고 기존 install one-shot을 소비·변경하지 않는다. host open/read/close 실패는 별도 read `OUTCOME_UNKNOWN`이며 설치 재시도 근거가 아니다.
9. host close가 `CLOSED_CONFIRMED`가 아니면 읽기 성공 projection을 버리고 `OUTCOME_UNKNOWN`으로 남긴다.

기존 general host가 read 전에 trust root를 새로 만드는 경로는 허용하지 않는다. 현재 등록을 읽는 같은 host가 이미 보유한 root를 사용하거나 purpose 전용 existing-only open을 사용한다. worker installation namespace 미구성은 typed `UNSUPPORTED`이며 새 directory 생성으로 바꾸지 않는다.

## 5. 최소 projection과 상태 의미

성공 wire는 다음 둘 중 하나다.

```json
{
  "state": "WORKER_INSTALLATION_SETTLEMENT_READ",
  "artifact": "ARTIFACT_SETTLED_CURRENTLY_VERIFIED",
  "pastRequest": "UNKNOWN",
  "installationPerformed": false,
  "recoveryPerformed": false,
  "executionAuthorized": false
}
```

```json
{
  "state": "WORKER_INSTALLATION_SETTLEMENT_READ",
  "artifact": "NO_MATCHING_SETTLEMENT",
  "pastRequest": "UNKNOWN",
  "installationPerformed": false,
  "recoveryPerformed": false,
  "executionAuthorized": false
}
```

Windows source 미구성은 기존 convention의 exact `{"state":"UNSUPPORTED"}`로 반환한다. catalogue/marker 누락, partial, 복수, mismatch, identity drift, close 불명은 성공 projection이 아니라 `OUTCOME_UNKNOWN`이다. 다른 offer·등록·epoch는 기존 `CONTEXT_CHANGED`, 기한 경과는 기존 `DEADLINE`을 사용한다. 새 `EXPIRED` enum은 추가하지 않는다.

renderer에는 root, path, SID, file/container bytes, worker bytes, marker/selection hash, registration/settlement attempt ID를 반환하거나 표시하지 않는다. 기존 `worker-install-state`에는 다음 의미만 표시한다.

- 현재 artifact 정착 검산됨 · 과거 요청 결과는 미확인
- 일치하는 정착 기록 없음 · 설치를 자동 시작하지 않음
- 이 환경에서는 보호 정착 판독 미지원
- 결과 미확인 · 자동 재조회·설치·복구하지 않음

## 6. exact 허용 파일과 책임

첫 구현은 아래 caller→native receiver→기존 unsupported guard의 실제 closed chain을 한 단위로 만든다. unreferenced helper만 먼저 추가하지 않는다.

### 6.1 제품 파일

| 파일 | 허용 변경 |
|---|---|
| `apps/desktop/src/settings.html` | 기존 신뢰 등록/원 명령 panel 안에 명시 정착 확인 control 하나 추가. 설치 button과 분리 |
| `apps/desktop/src/settings.js` | current offer가 보이는 경우에만 새 `readRequestId`로 read action 호출, ticket/attempt/epoch/generation 전후 확인, 최소 문구 표시 |
| `apps/desktop/src/policy.cjs` | 기존 `trust-act` exact action allowlist에 `READ_WORKER_INSTALLATION_SETTLEMENT` 하나만 추가. payload field 증가는 없음 |
| `apps/desktop/src/trust-enrollment-owner.cjs` | 설치 branch와 분리된 read branch, exact offer 재조회·current 등록/root 검산, protocol replay, pinned host 호출과 최소 projection 검산 |
| `apps/desktop/src/native-worker-installation-coordinator.cjs` | 설치 mutation effect 없는 `readManagementSettlement` one-shot, 기존 pinned host open/close 관측 effect·current factory·exact response 검산. install/normal methods 불변 |
| `apps/connector/native/DesktopTrustKeyHostSource.cs` | `READ_WORKER_INSTALLATION_SETTLEMENT_V1` exact dispatch, `WorkerRecord()`/root/selection hash 검산, deployment management read 호출 |
| `apps/connector/native/NativeWorkerDeploymentSource.cs` | 실행/image read와 분리된 management read. 기존 `RequireDurability` 선행 경로는 불변 |
| `apps/connector/native/NativeWorkerInstallationStoreSource.cs` | 기존 marker `attemptId` 의미 보존과 selection hash 저장, existing-only restart classifier, 부모 WI의 complete catalogue·exact artifact 재검산 |
| `apps/connector/native/NativeWorkerInstallationRootSource.cs` | 기존 API로 existing-only marker handle/identity를 충족하지 못할 때만 최소 read-only open 추가. create·cleanup 정책 불변 |

`apps/desktop/src/preload.cjs`는 기존 `trustAct(requestId,attemptId,epoch,action)`을 그대로 사용하므로 변경하지 않는다. `apps/desktop/src/shell.cjs`도 기존 `trust-act` handler를 재사용한다. 별도 IPC channel, public API, feature switch를 추가하지 않는다.

### 6.2 시험 파일

| 파일 | 필수 증거 |
|---|---|
| `tests/desktop/settings-worker-installation.test.cjs` | 설치 click 불변, 별도 read click, exact current offer, late/ABA/unknown, path/hash input 0 |
| `tests/desktop/shell-policy.test.cjs` | 새 action exact4 field만 허용, extra ref/path/factory/root 거절, local sender 유지 |
| `tests/desktop/desktop-trust-registration.test.cjs` | current offer 재조회, REGISTERED/epoch/root/channel 교체, read replay, 설치 mutation effect 0, pinned host 관측 effect와 close unknown 분리 |
| `tests/desktop/native-worker-installation.test.cjs` | persistent selection hash와 세 요청/등록/정착 identity 구분, complete catalogue의 0/1/복수, missing/partial/ACTIVE/final, cross offer·registration·root, no fallback |
| `tests/unit/FN06/native-worker-installation-native.test.ts` | native operation→deployment→store 실제 참조, existing-only open, writer/read canonical 결박, 기존 gate·v1 reader 불변 |

실제 변경이 source 접근성이나 host static contract를 건드리면 기존 `tests/unit/FN06/native-worker-deployment.test.ts`의 인접 회귀만 실행한다. 새 범용 fixture, 새 management API test suite, 실제 OS helper를 만들지 않는다.

## 7. 구현 순서와 RED/GREEN 경계

### Task 1 — 실제 closed caller와 unsupported receiver

- [ ] UI/IPC 음성 RED: explicit read control 부재, action allowlist 부재, extra input 거절을 고정한다.
- [ ] native static RED: 새 host operation이 deployment management read와 연결되지 않았음을 고정한다.
- [ ] settings→policy→owner→coordinator→host→deployment의 실제 호출을 연결한다.
- [ ] deployment method는 기존 Windows unsupported guard에서 typed `UNSUPPORTED`로 닫힌다. store parser를 dead helper로 먼저 만들지 않는다.
- [ ] 설치 action·automatic pre-read/fallback·normal-start 경로가 바뀌지 않았음을 확인한다.

### Task 2 — 같은 legacy install writer의 marker binding

- [ ] 원 install request와 exact persistent selection facts가 native host까지 전달되지 않는 RED를 추가한다.
- [ ] host가 selection hash를 계산하고 store writer가 원 install request를 기존 marker `attemptId`로 두 row에 기록한다. 별도 `settlementAttemptId` 필드는 만들지 않는다.
- [ ] marker write admission, quota, close unknown, partial preservation은 부모 WI를 따른다.
- [ ] `RequireDurability()`는 계속 첫 실제 Windows mutation 전에 거절한다. source 작성은 실제 설치 지원이 아니다.

### Task 3 — existing-only management reader

- [ ] exact 한 건 fixture의 artifact-current/past-request-unknown RED와 complete catalogue 0건, catalogue/marker missing·partial, 복수·mismatch 음성을 각각 추가한다.
- [ ] store reader와 Windows existing-only source를 Task 1의 실제 deployment call에 연결한다.
- [ ] 현재 offer-derived selection과 marker hash가 같고 부모 WI의 artifact facts가 전부 맞을 때만 verified projection을 반환한다.
- [ ] `UNSUPPORTED`, no match, `OUTCOME_UNKNOWN`, `CONTEXT_CHANGED`, `DEADLINE`을 서로 바꾸지 않는다.

### Task 4 — 회귀와 독립 검수

- [ ] focused desktop/unit, typecheck, C# static source check, `git diff --check`를 실행한다.
- [ ] legacy install 정상/unknown, normal-start source, v1 reader/rollback, 8 MiB/512 quota가 불변인지 확인한다.
- [ ] 독립 reviewer가 marker로 old request success·권위·실행·복구가 승격되지 않는지 확인한다.

## 8. 완료조건과 미검증

Source 완료조건:

- 같은 화면의 명시 read부터 native existing-only classifier까지 실제 참조가 이어지고 dead helper가 없다.
- writer와 reader가 동일 persistent selection hash를 독립 재계산하고 요청·등록·정착 identity를 혼용하지 않는다.
- 성공 projection은 artifact current와 old request `UNKNOWN`을 동시에 보존한다.
- 기존 pinned host open/close 관측 외 설치 mutation·재시도·복구·실행·서명·queue·key·새 root/Fresh 효과가 0이다.
- public HUMAN API·role·key·DB·권한·quota·수명 변경이 없다.
- 기존 `RequireDurability()`와 actual Windows default unsupported가 유지된다.
- Critical/Important finding 0이다.

다음은 이 작업으로 PASS가 아니다.

- 실제 C# compile/load와 Windows filesystem·handle·restart
- 실제 marker write/read, DPAPI, close·flush·power-loss 내구성
- 실제 설치 지원, 실행 준비, 사용자 인수
- 과거 caller가 성공 응답을 받았다는 증명
- old request를 재시도·성공·정리 완료로 바꾸는 행위

## 9. 영향과 권장 판정

명시 read에는 사용자 action이 필요하므로 기존 panel 안의 control 하나는 불가피하다. 이를 금지하면 실제 caller가 없어 Task 1은 다시 `SOURCE_CONTRACT_ONLY`가 된다. 권장 판정은 별도 route/API가 아닌 같은 local trust screen의 한 control을 A안의 내부 상세로 허용하고, 기존 설치 button과 상태·busy·request ID를 완전히 분리하는 것이다.

원 request 선택은 현재 exact offer에서만 수행한다. offer를 잃은 임의 과거 요청 목록·수기 UUID·latest 추정은 이번 범위 밖이며 c10의 별도 조사 결과가 없으면 추가하지 않는다.
