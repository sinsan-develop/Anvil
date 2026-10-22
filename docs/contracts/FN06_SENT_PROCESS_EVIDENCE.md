# FN06 응답 목적 프로세스 증거 — 내부 합성 계약 A

## 범위와 현재 상태
- Stage B/FN06의 현재 자료 공급자 선행 상세화다. SYNTHETIC_ONLY 소비 source/합성 반례만 구현한다. 실제 Agent 연결 완료가 아니다.
- 실제 ownership 보관·현재 head/회수 조회, 독립 OS OBSERVE, 이 원자료를 서버 osFence에 수용하는 resolver는 **미구현**이다. 기존 만료 QA host·옛 lease/PID/Job을 실행하거나 전용하지 않는다.
- 기존 응답 전용 currentSentResponse와 예약 미생성 currentReadOnly만 소비한다. 발급 current·SEND IDLE·공개 API·SQL·DB·서비스·권한·native 변경0이다.
- 구조/해시 일치는 제공자 진위나 권한 인증이 아니다. 새 source를 서비스에 자동 등록하거나 기존 metadata의 OWNED/VERIFIED_CURRENT로 주입하지 않는다.

## 1. 불변 보관 두 종류 — 해시 순환 방지
공통 ref는 {id:UUID,version:양의 정수,contentHash:canonicalJson(snapshot)의 SHA256}이다. 모든 객체는 아래 열거 필드만 허용한다.
공통 scope는 projectId/executionId/executionGeneration/sessionBindingRef/roleBindingRef/executorRegistrationRef다. 세 fullref는 서버 현재 fact와 원 envelope에 정확히 일치해야 한다.

1. anchor.snapshot: schemaVersion=1, purpose=PROCESS_OWNERSHIP_ANCHOR, transport=SYNTHETIC_ONLY, scope, processRef, observerRef, recordedAt, expiresAt, state=BOUND, fileSandboxVerified=false, executionAuthorized=false, dispatchPerformed=false.
2. processRef는 기존 OwnedProcessRef와 동일한 runId/generation/jobId/pid/startTicks/executableHash다. UUID run/job, 양의 정수 generation/PID, 양의 17~20자리 startTicks, 소문자 SHA256. PID만 일치하면 거절한다.
3. anchor.ref는 **원 서버 fact.checks.osFence.evidenceRefs에 이미 선택된 정확 fullref**여야 한다. 호출자가 새로 해시한 anchor를 그대로 채택하지 않는다.
4. binding.snapshot: schemaVersion=1, purpose=SENT_PROCESS_BINDING, transport=SYNTHETIC_ONLY, ownershipEvidenceRef=anchor.ref, scope, commandId, envelopeHash, parentThreadClaimRef, attemptRef, permitRef, instructionContentHash, preSendBindingHash, recordedAt, expiresAt.
5. anchor는 permit/binding을 포함하지 않는다. 원 permit이 anchor를 참조하고 별도 binding이 그 permit을 참조하므로 self-hash 순환이 없다. binding.ref를 원 osFence anchor로 바꾸지 않는다.
6. 두 기록은 현재 실 DB/파일 저장소가 없는 불변 참조 계약이다. 새 보관 생성·persistent 쓰기·자동 채택은 하지 않는다.

## 2. 원자료 공급자와 읽기 일관성
- archive.readCurrent(selection,signal)는 기존 자료만 읽어 {anchor:{ref,snapshot},binding:{ref,snapshot},anchorHeadRef,bindingHeadRef,revoked,readAt,expiresAt}를 반환하는 미구현 포트다.
- head는 각각 선택 ref와 exact match, revoked=false여야 한다. 선택 옛 버전만 반환하거나 회수 여부 누락은 거절한다. archive는 서버 인증 actor/현재 control 범위에서 미래 구현되어야 하며 caller 객체를 저장 head로 인증하지 않는다.
- readAt은 이번 호출 시작 이후/현재 이하, 유효기한은 readAt보다 미래이며 최대30초다. anchor/binding recordedAt은 현재 이하, 만료는 기록보다 미래다. binding은 anchor 이후 기록되어야 하고 두 scope/ref/hash는 정확히 일치한다.
- 서버 응답 전용 source → 보관 현재 읽기 → 독립 OBSERVE 1회 → 보관 현재 재읽기 → 서버 응답 전용 재읽기 순서다. 전후 불변 기록/fullref/head/회수·서버 scope/원시도/permit/선택 anchor가 달라지면 결과를 버린다.
- 서버 source는 기존 purpose=SENT_RESPONSE_ONLY/false 권한·원 attempt/permit/부모/grant 및 서버 fact 계약을 검증한다. 이 포트의 실제 원자료 수용 resolver/OS 진위는 이번 소비 코드가 만들지 않는다.

## 3. 일회 OBSERVE와 기한·해제
- consumer 인스턴스는 성공/실패/취소 모두 **한 번만** 사용한다. 임의 재시도/새 permit/세대·SEND 발급은 없다.
- 요청 snapshot은 schemaVersion=1,purpose=OBSERVE_SENT_PROCESS,transport=SYNTHETIC_ONLY,ownershipEvidenceRef,bindingRef,processRef,observerRef,commandId,envelopeHash,attemptRef,permitRef,requestedAt,expiresAt다. 새 UUID+version1+snapshot hash의 request.ref는 일회 상관 식별자이며 credential/실행 권한이 아니다.
- observer.observe(request,signal)는 **현재 별도로 획득한** {requestRef,ownershipEvidenceRef,bindingRef,observerRef,observedAt,expiresAt,facts}를 반환하는 미구현 포트다. archive를 복사해 OBSERVE로 표시하지 않는다.
- facts는 기존 형식 {processRef,state,active,processes,killOnClose,fileSandboxVerified}. RUNNING만 허용, active=목록 길이(1~128), 모든 항목은 {pid,startTicks,inJob,executableHash}, PID 유일·inJob=true·image hash 일치, root PID/startTicks가 정확히 있어야 한다. killOnClose=false,fileSandboxVerified=false 유지. PREPARED/RECLAIMED/불명은 실패다.
- observedAt>=requestedAt이며 현재 이하/최대30초, reply expiresAt<=observedAt+30초다. 실제 OS 신원/시간 제공자 인증과 side-effect 제어는 미래 구현 책임이며 합성 reply로 증명되지 않는다.
- 전체 기한은 생성 옵션1~10000ms, 원 envelope·서버 fact/HUMAN·archive·anchor/binding·OBSERVE 기한의 **최솟값**이다. 어떤 입력도 원 기한을 늘리지 못한다. 매 await 후/최종 반환 직전 clock·AbortSignal 검사, 취소/timeout 이후 후속 조회0, late 응답 무시. 요청·임시 객체는 호출 범위에서 폐기하고 원 보관 기록은 삭제하지 않는다.
- 한 번의 관측 사이 발생 후 되돌아온 ABA 변경·OS TOCTOU까지 증명하지 않는다. 미래 공급자는 head/회수 세대의 단조성·원 OS 관측 진위를 제공해야 하며 본 source에는 실제 동시성 보장이 없다.

## 4. 반환·실패와 검수
- 반환은 {purpose:SENT_RESPONSE_PROCESS_EVIDENCE_ONLY,transport:SYNTHETIC_ONLY,state:SYNTHETIC_MATCHED,ownershipEvidenceRef,bindingRef,requestRef,processRef,observedAt,expiresAt,fileSandboxVerified:false,currentAuthorityVerified:false,writerReleaseVerified:false,executionAuthorized:false,dispatchPerformed:false}.
- caller에 원문/Secret·OS 경로·프로세스 제어 handle을 반환하지 않는다. process identity metadata는 내부용이며 공개 HTTP 계약이 아니다.
- 실패는 SENT_PROCESS_EVIDENCE_UNAVAILABLE. 원 시도 UNKNOWN 보존·재송신/회수완료/파일 WRITE 허가로 전환하지 않는다. process 소유 일치는 filesystem sandbox/source WRITE 허가가 아니다.
- 최소 합성 검수: 정확 원 anchor/사건/별도 요청 일치, caller 재해시 미채택, scope·세대/역할/Job/PID 재사용·image·hash·parent/permit mismatch, 누락/중복/회수/head변경·stale/최종만료·취소/timeout/late/재사용 거절. 실제 DB·native/OS·Agent/전체 FN06 검수는 미완료다.

