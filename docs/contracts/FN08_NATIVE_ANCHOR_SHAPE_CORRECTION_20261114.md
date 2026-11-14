# FN08 native anchor 공개 형상 한정 정정안

상태: 2026-11-14 신산님 직접 A안 anchor 형상 정정 채택. 승인 원문 SHA256 `6BF3B5F2734F5F365674E9AC895D226B1EC3359336504F7D5A41728A7ECE95CA`. 코드·미적용 SQL·합성 검증만 허용하며 실제 실행 제외는 유지한다. 원 채택 CFF94F6704B91556A0DBBD21353F5F2D29A8CA0F4340E3C0413A7841B849EFA4의 §4.3 ExistingOwnershipAnchorShape 한 항목만 정정한다. 새 권한·endpoint·서명 목적은 추가하지 않는다.

## 오류와 이유
원 후보는 기존 범용 anchor 형상이 있다고 기술했으나 실제 ownership-request-event/staged 검사는 SYNTHETIC_ONLY와 sessionBindingRef/roleBindingRef를 요구한다. 원 native authority에는 이 두 참조가 없다. 다른 자료의 참조를 가져오거나 임의 생성하지 않는다. 원 §6의 native 부모 분기는 유지하되 공개 snapshot의 정확 형상을 아래와 같이 명시한다.

## 권장 A — 정확 snapshot
```text
candidateAnchor = {ref, snapshot:{
 schemaVersion:2, purpose:'PROCESS_OWNERSHIP_ANCHOR',
 transport:'NATIVE_PREPARATION_RETURN',
 scope:{installationId,projectId,executionId,executionGeneration,executorRegistrationRef},
 parent:{authorityRef,consumeReceiptRef,localAttemptRef},
 processRef,observerRef,recordedAt,expiresAt,state:'BOUND',
 fileSandboxVerified:false,executionAuthorized:false,dispatchPerformed:false
}}
```
ref는 기존 Ref 형상이며 contentHash는 정확 snapshot의 canonical hash다. parent의 세 Ref는 원 요청 body·확정 consume·원 authority와 같은 거래에서 대조한다. scope.executorRegistrationRef는 원 authority.scope.registrationRef와 동일해야 한다. nativeFactoryRef/sourceScopeHash·원 HUMAN/정책은 authorityRef로 복원해 consume/preparation과 같은 거래에서 검산한다. processRef/observerRef는 기존 ownership request의 정확 대상과 같다. recordedAt/expiresAt는 서버가 정하며 원 준비·consume·등록 및 request TTL의 최솟값을 넘지 않는다.

BOUND는 후보 identity 결박일 뿐 OS 소유·writer OWNED·osFence VERIFIED_CURRENT·grant·Agent 실행을 의미하지 않는다. 기존 v1 synthetic snapshot/validator는 그대로 둔다. discriminator/transport/닫힌 parent를 서로 바꾼 입력, 다른 authority/consume/등록/process, hash 불일치와 추가키를 거절한다.

## 범위·대안
A는 기존 목적을 원 native 부모 참조로 정확히 표현하는 한정 정정이다. B는 기존 공개 응답을 유지하며 해당 anchor 연결을 보류하는 안이며 없는 session/role ref를 채우는 선택지는 없다. 채택해도 코드·미적용 SQL·합성 검증만 수행하고 실제 DB·권한 적용·키·프로세스·서비스·Agent 실행은 하지 않는다. 최초 관측/head 수용까지이며 후속 grant/current/resume 미확인은 그대로다.
