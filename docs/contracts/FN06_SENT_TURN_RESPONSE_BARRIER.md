# FN06 전송한 TURN 응답 수용 장벽 — source-only 내부 계약

- 근거: 2026-10-23 PMO 위임 결정. SYNTHETIC_ONLY 내부 구현만이며 실제 Agent/native/DB·권한 실행 승인이 아니다.
- 기존 pre-send current의 IDLE·이해·소유·grant·consume·bindingHash와 원장 schema는 그대로 유지한다. 새 SEND 적격성을 post-response 검사로 대체하지 않는다.
- 명시 responseBarrier와 postResponseAuthority를 함께 주입할 때만 활성화한다. 기본 digest-only 및 과거 원장 replay 의미는 유지한다.

## 입력과 반환

`complete({envelope,attemptRef,permitRef,responseRef,fact},signal)`는 완성된 turn/start RPC에만 호출한다. responseRef는 같은 기존 RESPONSE_RECORDED 후보 행의 exact ref다. 후보는 보호 완료 전에 원장 성공으로 기록하지 않는다. 실패 시 후보 대신 UNKNOWN을 기록하므로 미기록 후보 ref 자체는 현재 권한이나 서버 수용 증거가 아니다.

장벽 반환은 `{state:'PROTECTED_PROVIDER_CLAIM_RECORDED',claim,claimRef,ciphertextHash,parent,executionAuthorized:false,dispatchPerformed:false}`다. TURN·부모 THREAD fullref, session/role·연결/환경/executor·실행/세대·명령/envelope·시도/permit·원응답 ref/digest와 기한을 모두 대조한다. 원문 handle은 포트/메타데이터에 추가하지 않는다.

`postResponseAuthority.current({envelope,preSendBindingHash,preSendSnapshot,attemptRef,permitRef,responseRef,parentThreadClaimRef,fact},signal)`는 같은 사건의 현재 권한을 실제 대조하는 내부 합성 공급자 계약이다. 반환은 `{transport:'SYNTHETIC_ONLY',preSendBindingHash,attemptRef,permitRef,responseRef,parentThreadClaimRef,currentSnapshot}`이다.

- preSendSnapshot은 원래 IDLE snapshot 전체이며 기존 hash 그대로 고정한다. turnState를 빼거나 ACTIVE로 바꾸어 새 hash를 만들지 않는다.
- currentSnapshot은 같은 형식의 현재 snapshot이다. checkedAt/expiresAt 및 명시한 상태 전이 외의 필드는 동일해야 한다. contextReviewFact가 있으면 그 checkedAt만 현재성 범위에서 달라질 수 있으며 나머지는 동일해야 한다.
- 허용 상태 전이는 IDLE→IN_PROGRESS(응답한 TURN 진행 중) 또는 IDLE→IDLE(같은 사건 뒤 이미 대기 상태)뿐이다. ACTIVE 문자열만으로 수용하지 않는다. 다른 소유/grant/세션/thread/자료/이해·회수/만료·불명은 거절한다.
- current checkedAt은 현재 이하·30초 이내, expiresAt은 현재 이후·checkedAt+30초 이하다. 모든 기한은 pre-send·permit·envelope·보호 claim·현재 결과의 교집합이다.
- 최종 응답 sync 진입 전 포트 누락/변경·각 await/최종 기한 실패는 미기록 성공 후보 대신 UNKNOWN·재전송0이다. 원 metadata 및 부분 저장은 보존한다. 현재 포트는 구현자의 내부 주장이지 독립 OS/DPAPI/내구·실권한 인증이 아니다.
- 모든 수용 검사를 마쳐 최종 응답 sync가 성공한 경우, 그 sync 중 기한이 지났더라도 이미 기록한 RESPONSE_RECORDED는 과거 RPC receipt로만 반환한다. 새 권한/현재 사용 가능성/업무 인수를 부여하지 않으며 기존 false·UNVERIFIED 표시와 재송신0을 유지한다. 성공 기록을 지우거나 UNKNOWN으로 소급 변경하지 않는다. sync 자체가 불명/실패하면 원 기록을 보존하고 저장 오류로 반환하며 다음 조회도 원장 사실만 대조한다.

## 구현·검수 경계

### 동일 원잠금의 post 검증 자료

postResponseAuthority.current의 세 번째 내부 인자는 `SyntheticLockedProviderAttemptSource`다. 같은 SEND exclusive 안에서만 원 시도/permit 두 행을 읽으며 전송용 source의 끝난 수명을 재활성화하거나 중첩 잠금을 획득하지 않는다. 입력 JSON·서명·원장 schema에 함수를 추가하지 않는다. post 검사가 끝나거나 취소되면 source를 폐쇄하고 늦은 접근을 거절한다. source를 소비하는 구현은 현재 snapshot 조회 전후 원장 두 행을 재대조하며, 일치가 실제 fsync/현재 OS 또는 서버 권한의 독립 증거는 아니다.

정상, 보호완료 대기, 다른 사건/ref/부모·소유 회수·만료·포트 변경·불명/늦은 완료의 집중 반례와 독립 검토를 수행한다. 실제 post-response 공급자·TURN concrete capture bridge·실저장/현재 상태 관측·Agent 연결은 별도 미구현/미검증으로 구분한다. 공개 API/SQL/credential·실정책/서비스/컴파일 미결은 변경하지 않는다.
