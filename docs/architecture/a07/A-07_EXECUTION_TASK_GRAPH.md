# A-07 Execution Control · Task Graph 계약

`STATIC_ONLY / STATIC_CONTRACT_PASS`. `AV-AGT-029`의 L4/AE/E-SHOT 및 Agent runtime은 `RUNTIME_DEFERRED / NOT_EXECUTED`이며 actual DIR NOT_EXECUTED다.

Execution Control은 Run 상태와 Step 상태를 분리한다. 상단은 Run, WorkInstruction·plan·memory snapshot hash, Phase, 전략, 실패 정책, 동시성, 예약/사용/예측 비용, checkpoint와 Event sequence를 표시한다. 안전 중단은 새 action을 차단하며 `reason`과 `next_action`을 남긴다.

Task Graph node는 Step/Delegation, dependency, input/output hash, path scope, capability, worker/write lease, budget reservation, result contract를 함께 표시한다. cycle 또는 실패 dependency가 있으면 실행하지 않는다. 독립 Step 하나의 성공이 전체 실패를 성공으로 오염시키지 않는다.

권한 없는 조작은 disabled 상태와 이유를 표시한다. 본 문서는 API·DB·브라우저 또는 실행 엔진을 구현하지 않는다.

