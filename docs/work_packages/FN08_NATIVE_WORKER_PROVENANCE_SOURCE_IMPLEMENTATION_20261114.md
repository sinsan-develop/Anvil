# FN08 worker 보호 근거 source 구현 지시서

> 수행자는 승인 계약과 이 지시서를 함께 읽고 단계별 TDD·단일 writer로 수행한다. 구현은 기존 Primary, Main은 관리·검수·문서·통합을 맡는다.

## 목표·근거
Stage C FN08/D1에서 승인된 worker descriptor 생산·동일 consume 식별값 파생을 기존 서버 반환과 native retained 입력에 연결한다. 기술은 기존 TypeScript/Node build와 C# source다. 새 framework·공개 API·DB표를 추가하지 않는다.

- 원 계약: docs/contracts/FN08_NATIVE_WORKER_PROVENANCE_PRODUCER_CANDIDATE_20261114.md.
- 원 SHA256: A769DEC827F78A486CD7C6EC9EBD9D84308572AFD29481F10DDA73F647331250.
- 직접 채택 기록: docs/04_test_reports/AV3/FN08_NATIVE_WORKER_PROVENANCE_A_ADOPTION_20261114.md.
- 시작 기준: codex/av3-d1-producer-binding / 4867a91d23053f7fdf6b9fb040e494f7358d1a22, main7efc5111(PR110).
- Main 문서 변경은 보존한다. 다른 writer는 없다. Primary commit/push/병합 금지.

## 정확 허용 경로 15개
제품8:
```
apps/desktop/scripts/native-worker-build.cjs
apps/desktop/scripts/verify-native-worker.cjs
apps/desktop/scripts/native-physical-factory-build.cjs
contracts/runtime/native-worker-provenance-v1.ts
apps/server/modules/executions/native-worker-ownership-basis-source.ts
apps/connector/native/NativePreparationWorkerProvenanceSource.cs
apps/connector/native/DesktopTrustKeyHostSource.cs
apps/desktop/scripts/desktop-trust-key-host-build.cjs
```
시험7:
```
tests/desktop/native-worker-build.test.cjs
tests/unit/FN06/native-worker-provenance-contract.test.ts
tests/unit/FN06/native-worker-ownership-basis-source.test.ts
tests/unit/FN06/native-preparation-worker-provenance-native.test.ts
tests/unit/FN06/native-physical-factory-build.test.ts
tests/unit/FN06/native-preparation-ownership-return-store.test.ts
tests/desktop/desktop-trust-key-host-build.test.cjs
```
추가 경로 필요 시 이유를 Main에 전달한다. 단순 인접 assertion 보완은 의미 불변 여부를 검토해 Main이 결정하며 계약을 넓히지 않는다.

## 전역 제약
- signer r5의 exact role/키 권한 및 기존 helper artifact 형상은 보존한다. worker/helper/signer hash를 대체하지 않는다.
- descriptor의 factory별 유일 불변 mapping, 원 build 시각·기한, 목적별 ref/hash, parent 순환 금지를 승인 원문 그대로 구현한다.
- runId=consumeReceipt.ref.id, processGeneration=1. observer는 별도 목적 snapshot hash이며 consumeRecord.ref.id/version1을 사용한다. 원 bridgeRunId는 변경하지 않는다.
- producer는 일반 JSON·hash 재계산·호출자 supplied boolean으로 보호 권위를 만들지 않는다. 원 build 검산 결과와 opaque object 계보를 보유한다. 실제 보호 배포/설치/회수 공급자 부재는 명시 거절이다.
- 실제 source 파일 읽기와 합성 시험만 허용. 사용자 자료/백업 조사·설치·ACL·키·DB·권한·서비스·C# 컴파일/로드·프로세스·Agent 실행, journal 제한 해제 금지.

## 업무·검수 순서
### 1. 고정 worker build 생산·검산
- [ ] 실제 신규 Node producer/검산기 RED: 원 package/factory/build 근거 없이 worker bytes나 형상만 맞춘 결과 거절.
- [ ] 기존 OwnershipEvidenceWorker.cs 고정 source/entry의 build 입력·RAM PE 결과를 검산한다. compiler를 실행하지 않는다.
- [ ] 기존 helper build 결과를 변경하지 않고 원 artifact provenance를 제한된 내부 소비 접점으로 연결한다. 단순 callback 반환을 보호 생산자라 표시하지 않는다.
- [ ] worker hash·rootId·시각·부모 개정/교체 및 같은 factory에 다른 descriptor 거절. 기존 helper 직접 회귀만 확인.

### 2. descriptor·동일 consume 파생과 서버 연결
- [ ] 정확 ref/snapshot과 issuer 원객체 검산을 구현하고 직렬화복제/prototype/필드복제/Proxy·accessor 위조를 거절한다.
- [ ] 서로 다른 authority/receipt/consumeRecord/bridge UUID의 canonical bytes·예상SHA 고정 벡터를 작성한다. descriptor/factory는 같은 id/version·다른hash를 검산한다.
- [ ] 서버 실제 basis 공급자 → 기존 return store/planner → request/anchor의 run/observer/worker 결박을 제품 코드로 검증한다. 기존 포트를 연결하고 미등록 null 거절을 유지한다.
- [ ] await 중 회수·취소·만료·clock후퇴·producer 교체·늦은성공 및 replay불변을 검증한다. 새 기한/descriptor 발행0.

### 3. native 생산자·host source 연결
- [ ] 같은 파생 원문/필드/시간/숫자 형식을 C# source에 연결한다. 고정 벡터와 정적으로 대조하며 실제 C# 결과 일치라고 쓰지 않는다.
- [ ] 보호 mapping·descriptor 모두 확인된 경우에만 OriginalInputs를 생산한다. caller 경로/Trust키root 대체 금지. mapping 또는 근거 한쪽만 있으면 첫 primitive 전에 거절한다.
- [ ] 기존 retained 원객체·정리/UNKNOWN·budget·sourceflags 의미를 보존하고 host의 기본 생산자 연결을 추가한다. 실제 배포 공급자 미등록 상태를 성공 활성화하지 않는다.
- [ ] 고정 native build source 목록/직접 인접 assertion을 갱신한다. C# compile은 실행하지 않는다.

### 4. 반환·독립 검수
- [ ] root typecheck·필요 직접 Node/TS 시험·diffcheck. 기존 Desktop174 진단은 baseline/current/new 구분하고 전체PASS로 쓰지 않는다.
- [ ] 최종 15경로 hash·정확 명령/exit/개수·RED/GREEN·미실행·원천 생성/소비 표를 Main에 반환한다.
- [ ] 검수 중 파일을 동결하고 수정 필요 시 먼저 알린다. Main이 독립 C/I 검토와 직접검증 후 기록·통합한다.

## 리뷰 집중점
1. 일반 JSON이 보호 발행자 원 객체로 승격되는 경로.
2. 같은 factory의 descriptor 교체로 같은 consume observer hash가 달라지는 경로.
3. helper/worker hash 또는 bridgeRunId/worker runId의 혼용.
4. await 후 회수·부모 변경을 놓치고 오래된 결과를 수용하는 경로.
5. 미등록 보호 설치 공급자를 합성 fixture로 대신하고 기본 동작 완료라 주장하는 경로.

전체 계획 및 실환경 완료가 아니다. 업무 단위 source 결과만 수용하며 후속 실제 supplier/OS 검증의 미완료를 구체적으로 남긴다.
