# FN08 worker 보호 근거 생산자 — 한정 A안 후보

상태: 미채택. 코드 구현 지시·실제 설치/실행 승인이 아니다.

## 문제와 기존 범위
PR110의 retained 조립기는 원 입력을 검산하지만 ProtectedSource는 미등록이다. signer r5는 AnvilTrustKeyHost.exe 전용이며 worker 신뢰로 전용하지 않는다. 반환 A안 §4.3은 observer/image 근거를 서버의 원 preparation/factory/consume에서 파생하도록 규정했으나 worker 배포 원천·run/observer 생산 규칙은 정하지 않았다. caller processRef·환경변수·Trust 키 root로 이 공백을 채우지 않는다.

## 선택지
- A 권장: 기존 factory의 보호 package/build 경계에 한정된 worker descriptor와 동일 consume 식별값 파생 규칙을 추가한다. 새 공개 endpoint/DB 표 없이 내부 source 연결을 먼저 구현한다. 실제 배포 공급자가 없으면 기본 거절을 유지한다.
- B: 별도 worker 등록 API·원장을 설계한다. 지속 관리와 사용자별 worker 확장에는 유리하지만 현재 단일 고정 worker 연결보다 범위가 크므로 이번에는 권하지 않는다.

## A의 정확한 새로운 의미
### 1. worker descriptor 발행·검산 권위
- 발행 주체는 Anvil의 보호 factory package/build·배포 주체다. 프로젝트 caller나 임의 로컬 파일은 발행자가 아니다.
- signer 전용 catalogue exact role은 변경하지 않는다. factory 전용 descriptor를 별도 목적 `NATIVE_PREPARATION_WORKER_DESCRIPTOR`로 구분한다.
- descriptor는 `{ref,snapshot}`으로 보유하며 동일 id/version의 다른 snapshot은 거절한다. 고정 snapshot: `schemaVersion:1, purpose, nativeFactoryRef, packageRef, buildReceiptRef, rootId, relativePath, workerHash, issuedAt, expiresAt`. ref는 기존 id/version/contentHash이며 contentHash는 기존 canonical SHA256이다.
- descriptorRef는 `id=nativeFactoryRef.id`, `version=nativeFactoryRef.version`, `contentHash=descriptor snapshot hash`인 별도 목적 ref다. 형식만 같은 factoryRef로 대체하지 않는다. 발행 시각·만료는 원 build/배포 기록의 고정 값이며 조회 때 갱신하지 않는다.
- 정확한 nativeFactoryRef 하나에는 보호 배포 주체가 확정한 descriptor 하나만 대응한다. 같은 factory fullref에 두 descriptor·동적 교체·회수 후 재발행을 허용하지 않는다. worker 변경은 새 factory ref/version으로 분리하며 이미 소비한 authority의 scope를 바꾸지 않는다. 이 유일 mapping이 확정된 원 package/build 근거가 없으면 source producer도 거절한다. 따라서 consume 전 원 authority의 nativeFactoryRef가 descriptor를 고정하며 최초 조회가 임의 선택하지 않는다.
- descriptor는 이미 고정된 factory/package/build refs에 결박되는 후행 자료다. 부모 hash가 다시 descriptor hash를 포함하는 순환 형상을 만들지 않는다. 기존 package에 없는 field를 채우거나 재해시하여 과거 승인으로 간주하지 않는다.
- relativePath는 기존 image owner의 `OwnershipEvidenceWorker.exe` 한 값만 허용한다. rootId는 package 배포에서 고정한 논리 식별자다. 절대경로는 host의 보호 설치 mapping에만 있고 서버·HTTP·관측 응답으로 내보내지 않는다. 사용자 입력 경로를 보호 mapping으로 승격하지 않는다.
- 원 package·build receipt·factory ref와 worker bytes의 검산을 통과한 producer만 내부 원 객체를 발행한다. 객체 모양/해시만 맞춘 일반 JSON을 보호 근거로 인정하지 않는다. 실제 설치 검산·회수 근거가 없는 기본 환경은 거절한다.
- descriptor 자체 유효기간은 원 package/build·factory 기한보다 늘릴 수 없고 발행 시각 이전·만료·회수·producer 변경을 거절한다. 회수 또는 현재성 확인 불명은 성공으로 간주하지 않는다. 소비 기한은 descriptor·authority·receipt·현재 등록·원 budget의 최솟값이다. 등록마다 배포 descriptor를 재발행하지 않는다. 개정·회수·만료는 기존 consume의 거절이며 새 descriptor 선택으로 복구하지 않는다. 자동 갱신·다운로드·설치·삭제는 없다.

### 2. 동일 consume의 실행 식별값
- 원 확정 consumeReceipt의 ref.id를 `runId`로 사용하고 최초 `processGeneration=1`로 고정한다. 이 값은 프로세스 실행 성공이나 권한을 뜻하지 않는다. 원 receipt의 고유성이 검산되지 않으면 발행하지 않는다.
- observer snapshot: `schemaVersion:1, purpose:'NATIVE_PREPARATION_OBSERVER_BASIS', authorityRef, consumeReceiptRef, consumeRecordRef, nativeFactoryRef, registrationRef, sourceScopeHash, workerDescriptorRef, runId, processGeneration`.
- observerRef는 원 consumeRecordRef.id와 version1, 위 snapshot canonical hash로 구성한다. consumeRecord 자체의 ref를 그대로 observer라고 부르지 않으며 목적이 다른 별도 파생 ref다. id/version만으로 동등 비교하거나 consumeRecord 원문을 observer로 resolve하지 않는다.
- 서버와 host가 이미 검산한 같은 원 authority/receipt/consume 기록 및 descriptor로 같은 값을 파생한다. 재조회는 동일 결과이며 새 ID/세대/기한을 발행하지 않는다. 다른 factory/등록/descriptor/consume로 바꾸면 원 요청과 불일치로 거절한다.
- 기존 OwnerBridge의 permit 기반 `bridgeRunId`는 private channel 식별자로 유지한다. 위 worker runId로 덮어쓰거나 두 값을 같다고 간주하지 않는다.

### 3. 내부 소비 경로
- 서버: 기존 인증된 NativeOwnershipBasisSource.current 입력의 원 context와 보호 factory descriptor를 검산해 기존 basis 형식으로 반환한다. raw DB client/일반 조회 권한을 공급자에게 주지 않는다.
- host: 보호 설치 mapping·원 descriptor와 같은 context로 OriginalInputs를 생산하고 기존 원 image owner/hash 검산 및 retained 조립기로 전달한다.
- 신규 public endpoint/응답·서명 목적·DB 표·일반 권한을 만들지 않는다. descriptor 운반에 새 공개 형상이 필요해지면 이 범위를 넘어 구현하지 않고 정확 delta를 먼저 보고한다.
- 이 후보의 source 구현은 검증 가능한 build 입력 생산·내부 opaque 객체·파생기·소비 연결까지다. 주입 포트만 만들고 실제 보호 producer가 완성됐다고 보고하지 않는다. 실제 배포 신뢰/설치 근거의 생산이 빠진 단계는 미구현으로 명시한다.

## 허용 구현·검증과 제외
채택 시 코드·합성 시험만 구현한다. 고정 descriptor의 build 원천과 변경 거절, 원 객체 진위, 서버/native 파생 벡터 동일성, 등록/consume/image 교차 거절, 만료/회수/불명 차단, replay 불변 및 mapping 부재 시 첫 primitive0을 확인한다. 실제 C# 동작은 compile/실행 전까지 미검증이며 정적 검사를 실행 PASS로 표시하지 않는다.

실제 파일·자료 조사, 설치/다운로드, ACL·키·DB·권한·서비스·C# 컴파일/로드·프로세스/Agent 실행, journal unsupported 해제, normal grant/current 승격은 제외한다. 실제 root 경로를 새로 정하거나 생성하지 않는다.

## 승인 경계
기존 승인 안의 단순 조립이 아니라 worker image 신뢰의 발급 주체·보호 근거와 실행별 identity 의미를 처음 고정하는 변경이다. 이 후보가 채택되기 전 제품 구현은 하지 않는다. 세부 허용 파일과 source 검증 WI는 채택한 의미를 넘지 않게 Main이 분해한다.
