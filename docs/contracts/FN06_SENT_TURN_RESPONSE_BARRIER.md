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

### 보호 THREAD와 식별자 없는 현재 metadata 조립

`SyntheticSentTurnProtectedCurrent`는 생성 시 고정 부모 THREAD/fullref를 복제하고 별도 응답 reader의 private callback에서만 THREAD를 얻는다. 독립 현재 metadata에는 `threadId` 키 자체를 허용하지 않는다. pre snapshot의 식별자를 현재값으로 복사하지 않고 보호 조회의 값과 같은지 대조한 뒤 조립한다. 원 부모·명령/시도permit/hash/grant·세대, 현재 자료/소유/이해·기한·취소와 마지막 await 뒤 상태를 확인하며, 고정 부모/입력의 후속 caller 변경을 채택하지 않는다.

현재 metadata의 진위/OS 현재성을 이 조립으로 인증하지 않는다. 서버 fact 대조·자료 소비와 원잠금 post 검사는 외부의 기존 조립에서 계속 필수다. 실제 metadata 제공자·서비스 전체 연결/연속 TURN·native/DB/Agent는 미구현·미검증이며 기본 등록·새 실제 실행은 없다.

### 응답 목적 보호 THREAD 조회

`SyntheticSentResponseHandleReader.use(selection,signal,callback)`는 기존 pre-send reader/current 포트를 구현하거나 목적을 바꾸지 않는다. selection은 exact envelope/원 부모 THREAD와 claimRef·원 시도/permit/grant·preSendBindingHash/instructionContentHash를 고정한다. 서버 응답 전용 purpose/false 권한과 원 기록·현재 fact/세션·역할/세대·기한을 보관 조회 전후 확인한다. TURN 또는 다른 부모/명령·새 SEND용 current 반환을 응답용으로 채택하지 않는다.

기존 보호 store/엄격 capsule decoder의 결과는 내부 callback에만 전달한다. 배열은 정상·거절·callback 오류·취소/timeout 뒤 늦은 반환에도 소거한다. callback 반환값은 외부로 전달하지 않으며 callback에 새 wire/SEND/STOP 권한을 주지 않는다. JS 식별자 문자열을 callback이 보관하지 못하도록 강제하거나 GC 물리소거를 보장하지는 않는다.

기존 protocol store의 합성 RESOLVE 연결은 native 호출이 아니다. 실제 store·OS/DPAPI·현재 권한 제공자 진위, private snapshot으로의 최종 조립과 연속 TURN·Agent/DB 서비스 검증은 미구현·미검증으로 구분한다. 원 보호 reader/새 SEND IDLE·UNKNOWN/재송신 금지와 실행 제외 범위는 유지한다.

### 응답용 private current의 수신 자료 소비

`SyntheticSentTurnMaterialCurrent`는 기존 `SyntheticMaterialReceiver.instructionSource()`의 읽기를 private 현재 조회 전후 소비한다. 원 envelope/부분 refs·수신 receipt·바이트 길이/내용 hash·UTF-8/기존 알려진 비밀 표식을 검사하고, 현재 snapshot의 자료 receipt/hash가 같은지 대조한다. 기존 보관 부분을 다시 수신하거나 새 receipt/permit을 쓰지 않는다. 실패/취소/timeout/최종 기한 뒤 결과는 수용하지 않고 후속 자료 조회도 하지 않는다.

이 소비자의 source는 기존 receiver처럼 독점 소유의 새 Uint8Array를 반환해야 한다. 그 배열은 정상·오류·취소·늦은 완료에도 소거하므로 공유 inbox/cache 배열을 직접 전달하지 않는다. 원 inbox/보관 바이트는 그대로 보존한다. JS 문자열/GC 물리소거를 보장하지 않는다.

별도 private 현재 공급자와 기존 pre-send 보호 reader는 구분한다. 기존 `SyntheticInstructionClientAuthority.current`와 `SyntheticProviderHandleReader`를 BUSY 응답에 전용하거나 purpose를 제거하여 새 SEND 허가처럼 반환하지 않는다. 응답용 보호세션 조회의 실제 공급자·OS/native/파일 내구·DB/Agent 검증은 아직 미구현·미검증이다. 새 공개 API/SQL/권한·기본등록/실행은 없다.

### 서버 fact와 private 현재 snapshot의 내부 조립

응답 전용 Bound 조회는 원 선택의 `attemptBinding:{instructionContentHash,bindingHash}` 및 응답용 basis의 `turnState,grantRef`를 전달한다. 기존 새 SEND 반환에는 추가하지 않는다. 이는 이미 대조한 metadata 전달이며 원 hash/상태 변경·새 허가가 아니다.

`SyntheticSentTurnCurrentBinding`은 기존 `SyntheticSentTurnPostCurrent`의 readCurrent 포트를 공급한다. 원 서버 조회 → 별도 private readCurrent → 같은 서버 재조회 순서로 정확 시도·permit·부모·자료/hash·grant·현재 fact/이해/소유·세션·기한을 결박한다. 서버 BUSY는 같은 private IN_PROGRESS, IDLE은 IDLE일 때만 허용하며, pre snapshot을 현재 상태로 복사하여 사용하지 않는다. 취소/timeout·조회 중 회수·변경·불명·최종 await 후 만료는 거절하고 늦은 결과는 후속 조회/수용하지 않는다. 원 IDLE 전체 hash와 원 잠금 post 검사는 그대로 유지한다.

private readCurrent 구현과 각 포트의 진위·실제 OS/DB·자료 내구 검증은 별도 미구현·미검증이다. 구조 대조를 실제 권한·실행으로 인증하지 않으며 기본 등록/HTTP/새 SQL·실제 Agent/native 호출은 없다. private thread는 내부 메모리만 통과하고 서버 metadata·공개 응답·원장에 추가하지 않는다.

### 서버 원 permit·부모 기록의 응답 전용 결박

`BoundSyntheticProviderSendCurrent.currentSentResponse(envelope,parentClaimRef)`는 기존 인증 transaction에서 응답 전용 basis를 전후 조회하고, 정확한 원 THREAD/DB receipt·scope·command/permit/예약·소비된 nonce/서명 주체와 기한을 대조한다. 기존 새 SEND용 `current()`는 IDLE만 허용한다. 새 반환은 `{purpose:'SENT_RESPONSE_ONLY',executionAuthorized:false,dispatchPerformed:false,attemptRef,permitRef,basis}`이며 reader가 받는 key/fact 형식을 최상위에 제공하지 않는다. basis의 parentThreadClaimRef는 대조한 원 부모 ref다. 조회 중 새 permit/예약 발행이나 nonce 소비·SQL 쓰기는 없다.

이 원 기록 일치는 실제 wire 송신·현재 로컬 잠금/OS 권한의 증명이 아니다. 현재 runtime snapshot의 private handle·자료/이해 refs 조립, 원 잠금 source와의 최종 결합, 실제 DB 실행과 Agent 검증은 아직 미구현·미검증이다. 이 결과만으로 SEND·response 수용을 활성화하지 않는다.

### 동일 원잠금의 post 검증 자료

서버 basis의 별도 `currentSentResponse(db,actor,scope,commandId)`는 기존 인증 tx에서 이미 저장된 명령·현재 HUMAN·소유/권한 fact·예산/자료를 다시 읽는다. 기존 `current()`의 IDLE 요구는 바꾸지 않는다. 응답용 읽기만 IDLE/BUSY 현재 상태를 허용하며 `purpose:'SENT_RESPONSE_ONLY',executionAuthorized:false,dispatchPerformed:false`를 반환한다. 이는 이미 전송한 사실·permit 소비·부모 claim의 증명이 아니므로 그 별도 대조 없이 runtime post current로 채택하지 않는다. 새 SEND/permit/reader 수용 형식과 혼용하지 않는다.

postResponseAuthority.current의 세 번째 내부 인자는 `SyntheticLockedProviderAttemptSource`다. 같은 SEND exclusive 안에서만 원 시도/permit 두 행을 읽으며 전송용 source의 끝난 수명을 재활성화하거나 중첩 잠금을 획득하지 않는다. 입력 JSON·서명·원장 schema에 함수를 추가하지 않는다. post 검사가 끝나거나 취소되면 source를 폐쇄하고 늦은 접근을 거절한다. source를 소비하는 구현은 현재 snapshot 조회 전후 원장 두 행을 재대조하며, 일치가 실제 fsync/현재 OS 또는 서버 권한의 독립 증거는 아니다.

정상, 보호완료 대기, 다른 사건/ref/부모·소유 회수·만료·포트 변경·불명/늦은 완료의 집중 반례와 독립 검토를 수행한다. 실제 post-response 공급자·TURN concrete capture bridge·실저장/현재 상태 관측·Agent 연결은 별도 미구현/미검증으로 구분한다. 공개 API/SQL/credential·실정책/서비스/컴파일 미결은 변경하지 않는다.
